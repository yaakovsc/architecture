'use strict';

const path      = require('path');
const fs        = require('fs');

// Polyfill Web APIs missing in Node 16 — must run before Anthropic SDK loads
const nodeFetch = require('node-fetch');
const { FormData } = require('formdata-node');
if (!globalThis.fetch)    globalThis.fetch    = nodeFetch;
if (!globalThis.Headers)  globalThis.Headers  = nodeFetch.Headers;
if (!globalThis.Request)  globalThis.Request  = nodeFetch.Request;
if (!globalThis.Response) globalThis.Response = nodeFetch.Response;
if (!globalThis.FormData) globalThis.FormData = FormData;

const Anthropic = require('@anthropic-ai/sdk');
const { AiConfig } = require('../models');


const DEFAULT_MODEL  = 'claude-sonnet-4-6';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8 MB

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

function getApiKey(config) {
  return config?.claudeApiKey || process.env.ANTHROPIC_API_KEY || null;
}

function getModel(config) {
  return cfg(config, 'claudeModel') || DEFAULT_MODEL;
}

function makeClient(apiKey) {
  return new Anthropic({ apiKey, fetch: nodeFetch });
}

// ── Helpers ───────────────────────────────────────────────────────────────
function fileToBase64(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_IMAGE_SIZE) return null;
    return fs.readFileSync(filePath).toString('base64');
  } catch { return null; }
}

function mediaTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
           '.gif': 'image/gif',  '.webp': 'image/webp' }[ext] || 'image/png';
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
  try {
    const config = await loadConfig();
    const apiKey = getApiKey(config);
    return !!apiKey;
  } catch { return false; }
}

/**
 * Analyses a single diagram image using Claude vision.
 * Returns a Markdown fragment string.
 */
async function analyseFragment(systemName, fileName, filePath) {
  const config = await loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) throw new Error('מפתח Claude API לא מוגדר. הגדר ב-Admin → הגדרות AI.');

  const model  = getModel(config);
  const client = makeClient(apiKey);
  const prompt = cfg(config, 'fragmentAnalysisPrompt')
    .replace('{systemName}', systemName)
    .replace('{fileName}', fileName);

  const b64 = fileToBase64(filePath);
  const content = b64
    ? [
        { type: 'image', source: { type: 'base64', media_type: mediaTypeFromPath(filePath), data: b64 } },
        { type: 'text', text: prompt },
      ]
    : prompt + '\n\n[הערה: לא ניתן לטעון את הדיאגרמה. הניתוח מבוסס על שם הקובץ בלבד.]';

  const message = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [{ role: 'user', content }],
  });

  return message.content[0]?.text || '';
}

/**
 * Synthesises all fragment analyses into a cohesive CTO-level Markdown report.
 */
async function synthesiseCTOReport(systemName, fragmentTexts, questionnaireContext) {
  const config = await loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) throw new Error('מפתח Claude API לא מוגדר. הגדר ב-Admin → הגדרות AI.');

  const model  = getModel(config);
  const client = makeClient(apiKey);

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

  const prompt =
    `כתוב דו"ח ארכיטקטורה מקיף ומקצועי בעברית גבוהה ("משלבי") עבור מערכת "${systemName}".` +
    fragmentBlock + contextBlock +
    `\n\n---\n## הוראות לדו"ח\n\n` +
    `הדו"ח חייב להיות בפורמט Markdown מלא, כולל טבלאות ורמות סיכון מודגשות. ` +
    `השתמש בטרמינולוגיה ארגונית ישראלית מקצועית: **תלויות**, **כפילויות משאבים**, ` +
    `**וקטורי תקיפה**, **חוב טכנולוגי**, **שרידות**, **ממשקי API**.\n\n` +
    `הדו"ח יכלול בדיוק את הסעיפים הבאים:\n\n` +
    chapterBlock +
    `\n\nכתוב כאילו אתה מגיש את הדו"ח ישירות לדירקטוריון. שפה מקצועית, זורמת, ישירה.`;

  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    system: cfg(config, 'chatSystemPrompt'),
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0]?.text || '';
}

/**
 * Synthesises an enterprise-level CTO report across all systems.
 */
async function synthesiseEnterpriseReport(systemsData) {
  const config = await loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) throw new Error('מפתח Claude API לא מוגדר. הגדר ב-Admin → הגדרות AI.');

  const model  = getModel(config);
  const client = makeClient(apiKey);

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

  const prompt =
    `כתוב דו"ח ארכיטקטורה ארגוני מקיף ומקצועי בעברית גבוהה עבור כלל המערכות הארגוניות.\n\n` +
    `---\n# נתוני המערכות\n\n${systemsBlock}\n\n---\n` +
    `## הוראות לדו"ח ארגוני\n\n` +
    `הדו"ח חייב להיות בפורמט Markdown מלא, כולל טבלאות ורמות סיכון. ` +
    `השתמש בטרמינולוגיה: **תלויות**, **כפילויות משאבים**, **וקטורי תקיפה**, **חוב טכנולוגי**, **שרידות**, **ממשקי API**.\n\n` +
    `הדו"ח יכלול:\n\n` +
    chapterBlock +
    `\n\nכתוב כאילו אתה מגיש את הדו"ח ישירות לדירקטוריון. שפה מקצועית, זורמת, ישירה.`;

  const message = await client.messages.create({
    model,
    max_tokens: 8192,
    system: cfg(config, 'chatSystemPrompt'),
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0]?.text || '';
}

/**
 * Streams a chat response with system context injected.
 */
async function chat(messages, context, onToken) {
  const config = await loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) throw new Error('מפתח Claude API לא מוגדר. הגדר ב-Admin → הגדרות AI.');

  const model  = getModel(config);
  const client = makeClient(apiKey);

  const systemPrompt =
    cfg(config, 'chatSystemPrompt') +
    `\n\nהנה סיכום המערכת הנוכחית:\n\n${context || 'אין מידע נוסף.'}`;

  let fullText = '';
  const stream = await client.messages.stream({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      const token = event.delta.text;
      fullText += token;
      onToken(token);
    }
  }

  return fullText;
}

module.exports = {
  isAvailable,
  analyseFragment,
  synthesiseCTOReport,
  synthesiseEnterpriseReport,
  buildResponseContext,
  chat,
  isLocked: () => false, // no global lock with Claude API
  invalidateConfigCache: () => { _cfgCache = null; },
};
