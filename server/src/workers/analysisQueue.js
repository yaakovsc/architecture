/**
 * analysisQueue.js — Single-lane background analysis worker
 *
 * Architecture:
 *   - In-process queue (no Redis needed) with concurrency = 1
 *   - Triggered by diagram upload/delete events
 *   - Persists state in DB so jobs survive server restart
 *   - "Clean Floor" pre-inference hook clears Linux buffer cache
 *
 * Memory strategy for 4 GB server:
 *   - One job at a time (concurrency = 1)
 *   - Images processed sequentially, never all in memory at once
 *   - Fragment cache avoids re-loading unchanged files
 */

'use strict';

const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');
const { execSync } = require('child_process');

const { Op } = require('sequelize');
const { AiSummary, AiFragment, EnterpriseSummary, Diagram, NavResponse, NavButton, System } = require('../models');
const ai = require('../services/aiService');

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'src/uploads');

// ── Single-lane queue ──────────────────────────────────────────────────────
const _pendingSystemIds = new Set();
let _running = false;
const _queue = []; // items are { type: 'system', systemId } | { type: 'enterprise' }
let _enterprisePending = false;

function enqueue(systemId) {
  // Deduplicate: only one pending job per system at a time
  if (_pendingSystemIds.has(systemId)) {
    console.log(`[Worker] Job for system ${systemId} already queued. Skipping duplicate.`);
    return;
  }
  _pendingSystemIds.add(systemId);
  _queue.push({ type: 'system', systemId });
  console.log(`[Worker] Queued analysis for system ${systemId}. Queue depth: ${_queue.length}`);
  _drain();
}

function enqueueEnterprise() {
  if (_enterprisePending) {
    console.log('[Worker] Enterprise job already queued. Skipping duplicate.');
    return;
  }
  _enterprisePending = true;
  _queue.push({ type: 'enterprise' });
  console.log(`[Worker] Queued enterprise analysis. Queue depth: ${_queue.length}`);
  _drain();
}

async function _drain() {
  if (_running || _queue.length === 0) return;
  _running = true;
  const job = _queue.shift();
  if (job.type === 'system') {
    _pendingSystemIds.delete(job.systemId);
  } else {
    _enterprisePending = false;
  }
  try {
    if (job.type === 'system') {
      await _processSystem(job.systemId);
      // After each system analysis, kick off enterprise re-analysis
      enqueueEnterprise();
    } else {
      await _processEnterprise();
    }
  } catch (err) {
    console.error(`[Worker] Fatal error for job ${job.type}:`, err.message);
  } finally {
    _running = false;
    _drain(); // process next item
  }
}

// ── Clean floor ─────────────────────────────────────────────────────────────
// Drops Linux kernel buffer/page cache before loading the model.
// Maximises available RAM. No-op on macOS/Windows.
function cleanFloor() {
  if (process.platform !== 'linux') return;
  try {
    execSync('sync && echo 3 > /proc/sys/vm/drop_caches', { stdio: 'ignore', timeout: 5000 });
    console.log('[Worker] Buffer cache cleared (clean floor).');
  } catch {
    // Requires root. Silently skip in non-root environments.
  }
}

// ── Progress helpers — never crash the critical path ─────────────────────────
// The `progress` column may not exist on first deploy; always catch errors.
async function setProgress(record, msg) {
  console.log(`[Worker] ${msg}`);
  try { await record.update({ progress: msg }); } catch { /* column may not exist */ }
}
async function clearProgress(record) {
  try { await record.update({ progress: null }); } catch { /* ignore */ }
}

// ── File hash ────────────────────────────────────────────────────────────────
function hashFile(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
  } catch { return null; }
}

// ── Main processing logic ────────────────────────────────────────────────────
async function _processSystem(systemId) {
  const system = await System.findByPk(systemId);
  if (!system) return;

  console.log(`[Worker] Starting analysis: "${system.name}" (${systemId})`);

  // Mark as processing
  const [summary] = await AiSummary.findOrCreate({
    where: { systemId },
    defaults: { status: 'pending' },
  });
  await summary.update({ status: 'processing', errorMessage: null });

  const available = await ai.isAvailable();
  if (!available) {
    await summary.update({ status: 'error', errorMessage: 'שירות Claude API אינו זמין. ודא שמפתח API מוגדר ב-Admin → הגדרות AI.' });
    console.warn('[Worker] Claude API unavailable (no API key configured), aborting.');
    return;
  }

  try {
    // ── Step 1: Check data availability ───────────────────────────────
    await setProgress(summary, 'בודק נתונים זמינים...');
    const diagrams = await Diagram.findAll({
      where: { systemId, isActive: true },
      order: [['createdAt', 'ASC']],
    });
    const imageDiagrams = diagrams.filter(d => d.mimetype?.startsWith('image/'));
    const navResponses  = await NavResponse.findAll({ where: { systemId } });
    const hasData       = imageDiagrams.length > 0 || navResponses.some(r => r.data && Object.keys(r.data).length > 0);

    if (!hasData) {
      await summary.update({ status: 'error', errorMessage: 'אין מסמכים או טפסים מולאו עבור מערכת זו. העלה דיאגרמות PNG או מלא שאלונים.' });
      await clearProgress(summary);
      console.log(`[Worker] No data for "${system.name}", skipping analysis.`);
      return;
    }

    // ── Step 2: Analyse each image file, using cache for unchanged files ──
    await setProgress(summary, `נמצאו ${imageDiagrams.length} קבצים — בודק מטמון...`);

    for (const [idx, diagram] of imageDiagrams.entries()) {
      const filePath = path.join(UPLOAD_DIR, diagram.filename);
      const hash = hashFile(filePath);
      if (!hash) { console.warn(`[Worker] Cannot read file: ${diagram.filename}`); continue; }

      const existing = await AiFragment.findOne({ where: { systemId, diagramId: diagram.id } });
      if (existing?.fileHash === hash) {
        console.log(`[Worker] Cache hit: ${diagram.originalName || diagram.filename}`);
        continue;
      }

      const name = diagram.originalName || diagram.filename;
      await setProgress(summary, `מנתח קובץ ${idx + 1} מתוך ${imageDiagrams.length}: ${name}`);

      const fragmentContent = await ai.analyseFragment(system.name, name, filePath);
      if (!fragmentContent) continue;

      if (existing) {
        await existing.update({ fileHash: hash, content: fragmentContent });
      } else {
        await AiFragment.create({ systemId, diagramId: diagram.id, filename: diagram.filename, originalName: diagram.originalName, fileHash: hash, content: fragmentContent });
      }
    }

    // ── Step 3: Build questionnaire context (navResponses already fetched) ──
    await setProgress(summary, 'בונה הקשר מהשאלונים...');
    const buttonConfig = await NavButton.findAll({ include: [{ association: 'subjects', include: ['fields'] }] });
    const questionnaireContext = ai.buildResponseContext(navResponses, buttonConfig);

    // ── Step 4: Gather all fragment contents ──────────────────────────
    const fragments = await AiFragment.findAll({ where: { systemId } });
    const fragmentTexts = fragments.map(f => `### דיאגרמה: ${f.originalName || f.filename}\n${f.content}`);

    // ── Step 5: Synthesise the CTO report ─────────────────────────────
    await setProgress(summary, `מסנתז דו"ח CTO מ-${fragments.length} פרגמנטים...`);

    const report = await ai.synthesiseCTOReport(system.name, fragmentTexts, questionnaireContext);

    await summary.update({ content: report, status: 'ready', errorMessage: null, fragmentCount: fragments.length, processedAt: new Date() });
    await clearProgress(summary);
    console.log(`[Worker] ✅ Analysis complete for "${system.name}".`);

  } catch (err) {
    console.error(`[Worker] Error for "${system.name}":`, err.message);
    const userMsg = err.message.includes('זיכרון') || err.message.includes('RAM')
      ? err.message : `שגיאה בעיבוד: ${err.message}`;
    try {
      await summary.update({ status: 'error', errorMessage: userMsg });
      await clearProgress(summary);
    } catch (e2) {
      console.error('[Worker] Failed to save error status:', e2.message);
    }
  }
}

// ── Enterprise report synthesis ──────────────────────────────────────────
async function _processEnterprise() {
  console.log('[Worker] Starting enterprise analysis...');

  const [summary] = await EnterpriseSummary.findOrCreate({
    where: { id: 'enterprise' },
    defaults: { status: 'pending' },
  });
  await summary.update({ status: 'processing', errorMessage: null });

  const available = await ai.isAvailable();
  if (!available) {
    await summary.update({ status: 'error', errorMessage: 'שירות Claude API אינו זמין. ודא שמפתח API מוגדר ב-Admin → הגדרות AI.' });
    console.warn('[Worker] Claude API unavailable (no API key configured), aborting enterprise analysis.');
    return;
  }

  try {
    await setProgress(summary, 'אוסף נתוני מערכות...');
    const systems = await System.findAll();
    if (!systems.length) {
      await summary.update({ status: 'error', errorMessage: 'לא נמצאו מערכות לניתוח' });
      await clearProgress(summary);
      return;
    }

    const buttonConfig = await NavButton.findAll({
      include: [{ association: 'subjects', include: ['fields'] }],
    });

    const systemsData = [];
    for (const [idx, system] of systems.entries()) {
      await setProgress(summary, `טוען נתוני מערכת ${idx + 1}/${systems.length}: ${system.name}`);
      const fragments     = await AiFragment.findAll({ where: { systemId: system.id } });
      const navResponses  = await NavResponse.findAll({ where: { systemId: system.id } });
      const fragmentTexts = fragments.map(f =>
        `### דיאגרמה: ${f.originalName || f.filename}\n${f.content}`
      );
      const questionnaireContext = ai.buildResponseContext(navResponses, buttonConfig);
      const hasData = fragments.length > 0 || navResponses.some(r => r.data && Object.keys(r.data).length > 0);
      if (hasData) systemsData.push({ name: system.name, fragmentTexts, questionnaireContext });
    }

    if (!systemsData.length) {
      await summary.update({ status: 'error', errorMessage: 'אין נתונים זמינים לניתוח ארגוני. ודא שלפחות מערכת אחת כוללת מסמכים שהועלו או שאלונים שמולאו.' });
      await clearProgress(summary);
      console.log('[Worker] No data across any system, skipping enterprise analysis.');
      return;
    }

    cleanFloor();
    await setProgress(summary, `מסנתז דו"ח ארגוני עבור ${systemsData.length} מערכות...`);

    const report = await ai.synthesiseEnterpriseReport(systemsData);

    await summary.update({ content: report, status: 'ready', errorMessage: null, systemCount: systemsData.length, processedAt: new Date() });
    await clearProgress(summary);
    console.log('[Worker] ✅ Enterprise analysis complete.');
  } catch (err) {
    console.error('[Worker] Enterprise error:', err.message);
    const userMsg = err.message.includes('זיכרון') || err.message.includes('RAM')
      ? err.message : `שגיאה בעיבוד ארגוני: ${err.message}`;
    try {
      await summary.update({ status: 'error', errorMessage: userMsg });
      await clearProgress(summary);
    } catch (e2) {
      console.error('[Worker] Failed to save enterprise error status:', e2.message);
    }
  }
}

// ── Re-queue any interrupted jobs on startup ──────────────────────────────
async function recoverOnStartup() {
  try {
    const stuck = await AiSummary.findAll({
      where: { status: ['pending', 'processing'] },
    });
    if (stuck.length) {
      console.log(`[Worker] Recovering ${stuck.length} interrupted system job(s)...`);
      for (const s of stuck) {
        await s.update({ status: 'pending', errorMessage: null });
        await clearProgress(s);
        enqueue(s.systemId);
      }
    }

    // Re-queue enterprise if it was interrupted
    const entStuck = await EnterpriseSummary.findOne({
      where: { id: 'enterprise', status: ['pending', 'processing'] },
    });
    if (entStuck) {
      console.log('[Worker] Recovering interrupted enterprise job...');
      await entStuck.update({ status: 'pending' });
      enqueueEnterprise();
    }
  } catch (err) {
    console.warn('[Worker] Recovery scan failed:', err.message);
  }
}

// ── Periodic staleness check (every 5 minutes) ────────────────────────────
// Re-queues any system whose diagrams or form responses changed since last analysis.
const STALE_CHECK_MS = 5 * 60 * 1000;

async function _checkStaleness() {
  try {
    const systems = await System.findAll();
    let anyQueued = false;

    for (const system of systems) {
      if (_pendingSystemIds.has(system.id)) continue;

      const summary = await AiSummary.findOne({ where: { systemId: system.id } });
      if (summary?.status === 'pending' || summary?.status === 'processing') continue;

      // If never analysed, check if there's data — if so, queue it
      const since = summary?.processedAt || new Date(0);

      const changed = await Diagram.findOne({
        where: { systemId: system.id, isActive: true, updatedAt: { [Op.gt]: since } },
      }) || await NavResponse.findOne({
        where: { systemId: system.id, updatedAt: { [Op.gt]: since } },
      });

      if (changed) {
        console.log(`[Worker] Staleness check: re-queuing "${system.name}" (data changed since last analysis).`);
        enqueue(system.id);
        anyQueued = true;
      }
    }

    // If no system was re-queued but enterprise summary is absent/stale, kick it off
    if (!anyQueued && !_enterprisePending) {
      const ent = await EnterpriseSummary.findOne({ where: { id: 'enterprise' } });
      if (!ent || ent.status === 'none') enqueueEnterprise();
    }
  } catch (err) {
    console.warn('[Worker] Staleness check failed:', err.message);
  }
}

setInterval(_checkStaleness, STALE_CHECK_MS);

module.exports = {
  enqueue,
  enqueueEnterprise,
  recoverOnStartup,
  isRunning: () => _running,
  queueDepth: () => _queue.length,
};
