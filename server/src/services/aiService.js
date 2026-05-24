/**
 * aiService.js — Ollama wrapper for the Architecture Management System
 *
 * Key design decisions for 4 GB RAM:
 *  - Global processing lock: one Ollama request at a time
 *  - OOM retry with progressive context reduction (images → text-only → trimmed)
 *  - Hard timeout: 3 minutes per request
 *  - Images read lazily (one at a time, never batched)
 */

'use strict';

const http  = require('http');
const https = require('https');
const path  = require('path');
const fs    = require('fs');
const { AiConfig } = require('../models');

const OLLAMA_URL        = process.env.OLLAMA_URL   || 'http://localhost:11434';
const MODEL             = process.env.OLLAMA_MODEL || 'gemma4:e2b';
const TIMEOUT_MS        = 180_000;  // 3 min — generation calls (analysis, synthesis)
const STREAM_TIMEOUT_MS = 600_000;  // 10 min — chat stream may queue behind analysis

// ── Config cache (1 min TTL) ──────────────────────────────────────────────
let _cfgCache = null;
let _cfgTs    = 0;
async function loadConfig() {
  if (_cfgCache && Date.now() - _cfgTs < 60_000) return _cfgCache;
  try {
    const row = await AiConfig.findOne({ where: { id: 'main' } });
    _cfgCache = row || {};
    _cfgTs    = Date.now();
  } catch { _cfgCache = {}; }
  return _cfgCache;
}
function cfg(row, key) {
  return (row[key] != null && row[key] !== '') ? row[key] : AiConfig.DEFAULTS[key];
}

// ── Global processing lock ────────────────────────────────────────────────
let _locked = false;
function acquireLock() {
  if (_locked) {
    const err = new Error('המערכת מעבדת בקשה אחרת. נסה שוב בעוד מספר שניות.');
    err.code = 'AI_BUSY';
    throw err;
  }
  _locked = true;
}
function releaseLock() { _locked = false; }

// ── Low-level HTTP ────────────────────────────────────────────────────────
function ollamaPost(pathname, body) {
  return new Promise((resolve, reject) => {
    const url     = new URL(pathname, OLLAMA_URL);
    const driver  = url.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);

    const req = driver.request(
      {
        hostname: url.hostname,
        port:     url.port || (url.protocol === 'https:' ? 443 : 80),
        path:     url.pathname,
        method:   'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout:  TIMEOUT_MS,
      },
      (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed;
          try { parsed = JSON.parse(raw); }
          catch { return reject(new Error(`Ollama non-JSON: ${raw.slice(0, 200)}`)); }
          if (parsed?.error) return reject(new Error(`Ollama: ${parsed.error}`));
          resolve(parsed);
        });
      }
    );
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama timeout')); });
    req.write(payload);
    req.end();
  });
}

function ollamaStream(pathname, body, onToken) {
  return new Promise((resolve, reject) => {
    const url     = new URL(pathname, OLLAMA_URL);
    const driver  = url.protocol === 'https:' ? https : http;
    const payload = JSON.stringify({ ...body, stream: true });

    let fullText = '';
    const req = driver.request(
      {
        hostname: url.hostname,
        port:     url.port || (url.protocol === 'https:' ? 443 : 80),
        path:     url.pathname,
        method:   'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        timeout:  STREAM_TIMEOUT_MS,
      },
      (res) => {
        // Non-200 means Ollama returned an error body (e.g. model busy, not found)
        if (res.statusCode !== 200) {
          const chunks = [];
          res.on('data', c => chunks.push(c));
          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            let msg = `Ollama HTTP ${res.statusCode}`;
            try { msg = JSON.parse(raw)?.error || msg; } catch { /* use default */ }
            reject(new Error(msg));
          });
          return;
        }
        let buf = '';
        res.on('data', (chunk) => {
          buf += chunk.toString('utf8');
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              if (obj?.error) { reject(new Error(obj.error)); return; }
              const token = obj?.message?.content || obj?.response || '';
              if (token) { fullText += token; onToken(token); }
              if (obj.done) resolve(fullText);
            } catch { /* skip malformed line */ }
          }
        });
        res.on('end', () => resolve(fullText));
      }
    );
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Chat stream timeout — ניתוח רקע עשוי להיות בתהליך, נסה שוב בעוד דקה.')); });
    req.write(payload);
    req.end();
  });
}

// ── OOM retry wrapper ─────────────────────────────────────────────────────
// Attempts up to 3 times with progressively smaller context:
//   Attempt 1: full prompt + images
//   Attempt 2: full prompt, NO images (text-only)
//   Attempt 3: trimmed prompt (60%), no images
async function withOomRetry(promptFn) {
  const strategies = [
    { trimPrompt: false, withImages: true  },
    { trimPrompt: false, withImages: false },
    { trimPrompt: true,  withImages: false },
  ];

  let lastErr;
  for (const [i, strategy] of strategies.entries()) {
    try {
      return await promptFn(strategy);
    } catch (err) {
      lastErr = err;
      if (isOomError(err)) {
        const msg = i === 0
          ? 'הגבלת זיכרון RAM הגיעה. מנסה מחדש ללא תמונות...'
          : 'הגבלת זיכרון RAM הגיעה. מנסה מחדש עם הקשר מקוצר...';
        console.warn(`[AI] OOM on attempt ${i + 1}. ${msg}`);
      } else {
        throw err; // non-OOM error → don't retry
      }
    }
  }
  const oomErr = new Error(
    'הגבלת משאבי המערכת הגיעה. נסה שוב לאחר מספר דקות. ' +
    '(Attempting retry with reduced context window)'
  );
  oomErr.code = 'AI_OOM';
  throw oomErr;
}

function isOomError(err) {
  const m = (err?.message || '').toLowerCase();
  return m.includes('out of memory') || m.includes('oom') ||
         m.includes('killed') || m.includes('enomem') ||
         m.includes('cannot allocate');
}

// ── Helpers ───────────────────────────────────────────────────────────────
function fileToBase64(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 8 * 1024 * 1024) return null; // skip files > 8 MB
    return fs.readFileSync(filePath).toString('base64');
  } catch { return null; }
}

/**
 * Formats NavResponse data as structured Hebrew text for the system prompt.
 */
function buildResponseContext(navResponses, buttonConfig) {
  if (!navResponses?.length) return '';
  const lines = [];
  for (const resp of navResponses) {
    const btn = buttonConfig?.find(b => b.id === resp.buttonId);
    if (!btn || !resp.data) continue;
    lines.push(`\n### ${btn.icon || ''} ${btn.name}`);
    for (const subject of (btn.subjects || [])) {
      const subjectLines = [];
      for (const field of (subject.fields || [])) {
        const val = resp.data[field.id];
        if (!val || (Array.isArray(val) && !val.length)) continue;
        subjectLines.push(`  - ${field.name}: ${Array.isArray(val) ? val.join(', ') : val}`);
      }
      if (subjectLines.length) {
        lines.push(`\n#### ${subject.icon || ''} ${subject.name}`);
        lines.push(...subjectLines);
      }
    }
  }
  return lines.join('\n');
}

// ── Public API ────────────────────────────────────────────────────────────

async function isAvailable() {
  return new Promise((resolve) => {
    const url    = new URL('/api/tags', OLLAMA_URL);
    const driver = url.protocol === 'https:' ? https : http;
    const req    = driver.get(
      { hostname: url.hostname, port: url.port || 80, path: '/api/tags', timeout: 3000 },
      (res) => { res.resume(); resolve(res.statusCode === 200); }
    );
    req.on('error',   () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/**
 * Analyses a single diagram image.
 * Returns a Markdown fragment string.
 */
async function analyseFragment(systemName, fileName, filePath) {
  const config = await loadConfig();
  acquireLock();
  try {
    return await withOomRetry(async ({ withImages }) => {
      const b64 = withImages ? fileToBase64(filePath) : null;
      const prompt =
        cfg(config, 'fragmentAnalysisPrompt')
          .replace('{systemName}', systemName)
          .replace('{fileName}', fileName) +
        (withImages ? '' : '\n\n[הערה: הדיאגרמה לא נטענה עקב מגבלת זיכרון. הניתוח מבוסס על שם הקובץ בלבד.]');

      const body = { model: MODEL, prompt, stream: false };
      if (b64) body.images = [b64];

      const result = await ollamaPost('/api/generate', body);
      if (!result?.response) throw new Error('Ollama returned an empty response');
      return result.response;
    });
  } finally {
    releaseLock();
  }
}

/**
 * Synthesises all fragment analyses into a cohesive CTO-level Markdown report.
 * This is the "Enterprise Hebrew" generator.
 */
async function synthesiseCTOReport(systemName, fragmentTexts, questionnaireContext) {
  const config = await loadConfig();
  acquireLock();
  try {
    return await withOomRetry(async ({ trimPrompt }) => {
      const fragmentBlock = fragmentTexts.length
        ? `\n\n---\n## ממצאי הדיאגרמות\n\n${fragmentTexts.join('\n\n---\n')}`
        : '';
      const contextBlock = questionnaireContext
        ? `\n\n---\n## מידע מהשאלונים\n\n${questionnaireContext}`
        : '';

      const chapters = cfg(config, 'systemReportChapters');
      const chapterBlock = chapters
        .map((ch, i) => `## ${i + 1}. ${ch.title}\n${ch.prompt}`)
        .join('\n\n');

      let prompt =
        `אתה מנמ"ר ואדריכל ראשי (CTO-Level) בחברת הייטק ישראלית מובילה. ` +
        `כתוב דו"ח ארכיטקטורה מקיף ומקצועי בעברית גבוהה ("משלבי") עבור מערכת "${systemName}".` +
        fragmentBlock + contextBlock +
        `\n\n---\n## הוראות לדו"ח\n\n` +
        `הדו"ח חייב להיות בפורמט Markdown מלא, כולל טבלאות ורמות סיכון מודגשות. ` +
        `השתמש בטרמינולוגיה ארגונית ישראלית מקצועית: **תלויות**, **כפילויות משאבים**, ` +
        `**וקטורי תקיפה**, **חוב טכנולוגי**, **שרידות**, **ממשקי API**.\n\n` +
        `הדו"ח יכלול בדיוק את הסעיפים הבאים:\n\n` +
        chapterBlock +
        `\n\nכתוב כאילו אתה מגיש את הדו"ח ישירות לדירקטוריון. שפה מקצועית, זורמת, ישירה.`;

      if (trimPrompt) prompt = prompt.slice(0, Math.floor(prompt.length * 0.6));

      const result = await ollamaPost('/api/generate', { model: MODEL, prompt, stream: false });
      if (!result?.response) throw new Error('Ollama returned an empty response');
      return result.response;
    });
  } finally {
    releaseLock();
  }
}

/**
 * Synthesises an enterprise-level CTO report across all systems.
 * systemsData: Array of { name, fragmentTexts, questionnaireContext }
 */
async function synthesiseEnterpriseReport(systemsData) {
  const config = await loadConfig();
  acquireLock();
  try {
    return await withOomRetry(async ({ trimPrompt }) => {
      const systemsBlock = systemsData.map(s => {
        const frags = s.fragmentTexts.length
          ? `\n**דיאגרמות:**\n${s.fragmentTexts.join('\n---\n')}`
          : '';
        const questionnaire = s.questionnaireContext
          ? `\n**שאלונים:**\n${s.questionnaireContext}`
          : '';
        return `## מערכת: ${s.name}${frags}${questionnaire}`;
      }).join('\n\n---\n\n');

      const chapters = cfg(config, 'enterpriseReportChapters');
      const chapterBlock = chapters
        .map((ch, i) => `## ${i + 1}. ${ch.title}\n${ch.prompt}`)
        .join('\n\n');

      let prompt =
        `אתה מנמ"ר ואדריכל ראשי (CTO-Level) בחברה ישראלית. ` +
        `כתוב דו"ח ארכיטקטורה ארגוני מקיף ומקצועי בעברית גבוהה עבור כלל המערכות הארגוניות.\n\n` +
        `---\n# נתוני המערכות\n\n${systemsBlock}\n\n---\n` +
        `## הוראות לדו"ח ארגוני\n\n` +
        `הדו"ח חייב להיות בפורמט Markdown מלא, כולל טבלאות ורמות סיכון. ` +
        `השתמש בטרמינולוגיה: **תלויות**, **כפילויות משאבים**, **וקטורי תקיפה**, **חוב טכנולוגי**, **שרידות**, **ממשקי API**.\n\n` +
        `הדו"ח יכלול:\n\n` +
        chapterBlock +
        `\n\nכתוב כאילו אתה מגיש את הדו"ח ישירות לדירקטוריון. שפה מקצועית, זורמת, ישירה.`;

      if (trimPrompt) prompt = prompt.slice(0, Math.floor(prompt.length * 0.6));

      const result = await ollamaPost('/api/generate', { model: MODEL, prompt, stream: false });
      if (!result?.response) throw new Error('Ollama returned an empty response');
      return result.response;
    });
  } finally {
    releaseLock();
  }
}

/**
 * Streams a chat response with system context injected.
 * Note: no global lock — chat runs concurrently with background analysis.
 * Ollama (OLLAMA_NUM_PARALLEL=1) queues requests internally.
 * STREAM_TIMEOUT_MS is set to 10 min to survive waiting behind a long analysis job.
 */
async function chat(messages, context, onToken) {
  const config = await loadConfig();
  const systemMsg = {
    role: 'system',
    content:
      cfg(config, 'chatSystemPrompt') +
      `\n\nהנה סיכום המערכת הנוכחית:\n\n${context || 'אין מידע נוסף.'}`,
  };

  try {
    return await ollamaStream(
      '/api/chat',
      { model: MODEL, messages: [systemMsg, ...messages] },
      onToken,
    );
  } catch (err) {
    if (isOomError(err)) {
      throw new Error('הגבלת משאבי המערכת הגיעה. נסה שוב לאחר מספר דקות.');
    }
    throw err;
  }
}

module.exports = {
  isAvailable,
  analyseFragment,
  synthesiseCTOReport,
  synthesiseEnterpriseReport,
  buildResponseContext,
  chat,
  isLocked: () => _locked,
  invalidateConfigCache: () => { _cfgCache = null; },
};
