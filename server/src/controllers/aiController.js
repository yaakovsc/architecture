'use strict';

const { System, NavResponse, NavButton, AiSummary, EnterpriseSummary, AiConfig } = require('../models');
const ai     = require('../services/aiService');
const worker = require('../workers/analysisQueue');

// ── GET /api/ai/status ────────────────────────────────────────────────────
const getStatus = async (req, res) => {
  try {
    const available = await ai.isAvailable();
    res.json({
      available,
      busy:       ai.isLocked(),
      queueDepth: worker.queueDepth(),
      model:      process.env.OLLAMA_MODEL || 'gemma4:e2b',
    });
  } catch {
    res.json({ available: false, busy: false, queueDepth: 0 });
  }
};

// ── GET /api/ai/summary/:systemKey ────────────────────────────────────────
// Returns the current summary and worker status for a system.
const getSystemSummary = async (req, res) => {
  try {
    const system = await System.findOne({ where: { key: req.params.systemKey } });
    if (!system) return res.status(404).json({ message: 'מערכת לא נמצאה' });

    const summary = await AiSummary.findOne({ where: { systemId: system.id } });
    if (!summary) return res.json({ status: 'none', content: null, fragmentCount: 0 });

    res.json({
      status:        summary.status,
      content:       summary.content,
      errorMessage:  summary.errorMessage,
      fragmentCount: summary.fragmentCount,
      processedAt:   summary.processedAt,
      progress:      summary.progress,
    });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

// ── POST /api/ai/analyze/:systemKey ──────────────────────────────────────
// Manually triggers a background analysis job (useful for initial run or forced refresh).
const triggerAnalysis = async (req, res) => {
  try {
    const system = await System.findOne({ where: { key: req.params.systemKey } });
    if (!system) return res.status(404).json({ message: 'מערכת לא נמצאה' });

    worker.enqueue(system.id);
    res.json({ message: 'ניתוח הועבר לתור', systemId: system.id });
  } catch (err) {
    if (err.code === 'AI_BUSY') return res.status(429).json({ message: err.message });
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/ai/chat/:systemKey ─────────────────────────────────────────
// Streaming SSE chat with automatic context injection from AiSummary.
const chatWithSystem = async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ message: 'messages נדרש' });
  }

  // Build context: prefer the stored AI summary, fall back to questionnaire data
  let context = '';
  try {
    const system = await System.findOne({ where: { key: req.params.systemKey } });
    if (system) {
      const summary = await AiSummary.findOne({ where: { systemId: system.id } });
      if (summary?.status === 'ready' && summary.content) {
        // Use the full AI-generated report as context
        context = `# דו"ח ארכיטקטורה: ${system.name}\n\n${summary.content}`;
      } else {
        // Fall back to raw questionnaire data
        const navResponses  = await NavResponse.findAll({ where: { systemId: system.id } });
        const buttonConfig  = await NavButton.findAll({
          include: [{ association: 'subjects', include: ['fields'] }],
        });
        context = `מערכת: ${system.name}\n` + ai.buildResponseContext(navResponses, buttonConfig);
      }
    }
  } catch { /* context is optional */ }

  // Set up SSE
  res.setHeader('Content-Type',      'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    await ai.chat(messages, context, (token) => send({ token }));
    send({ done: true });
  } catch (err) {
    console.error('[Chat] Error:', err.message);
    send({ error: err.message || 'שגיאה בצ\'אט' });
  } finally {
    res.end();
  }
};

// ── GET /api/ai/enterprise/summary ───────────────────────────────────────
const getEnterpriseSummary = async (req, res) => {
  try {
    const summary = await EnterpriseSummary.findOne({ where: { id: 'enterprise' } });
    if (!summary) return res.json({ status: 'none', content: null, systemCount: 0 });
    res.json({
      status:       summary.status,
      content:      summary.content,
      errorMessage: summary.errorMessage,
      systemCount:  summary.systemCount,
      processedAt:  summary.processedAt,
      progress:     summary.progress,
    });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

// ── POST /api/ai/enterprise/analyze ──────────────────────────────────────
const triggerEnterpriseAnalysis = async (req, res) => {
  try {
    worker.enqueueEnterprise();
    res.json({ message: 'ניתוח ארגוני הועבר לתור' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── POST /api/ai/enterprise/chat ──────────────────────────────────────────
// Enterprise chat: context = enterprise report + all system summaries
const chatEnterprise = async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ message: 'messages נדרש' });
  }

  let context = '';
  try {
    // Use enterprise summary if ready
    const entSummary = await EnterpriseSummary.findOne({ where: { id: 'enterprise' } });
    if (entSummary?.status === 'ready' && entSummary.content) {
      context = `# דו"ח ארגוני\n\n${entSummary.content}`;
    } else {
      // Fall back: collect all system summaries
      const systems = await System.findAll();
      const parts = [];
      for (const system of systems) {
        const sum = await AiSummary.findOne({ where: { systemId: system.id } });
        if (sum?.status === 'ready' && sum.content) {
          parts.push(`## מערכת: ${system.name}\n\n${sum.content}`);
        }
      }
      if (parts.length) context = parts.join('\n\n---\n\n');
    }
  } catch { /* context is optional */ }

  res.setHeader('Content-Type',      'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control',     'no-cache');
  res.setHeader('Connection',        'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    await ai.chat(messages, context, (token) => send({ token }));
    send({ done: true });
  } catch (err) {
    console.error('[Chat/Enterprise] Error:', err.message);
    send({ error: err.message || 'שגיאה בצ\'אט ארגוני' });
  } finally {
    res.end();
  }
};

// ── GET /api/ai/config ────────────────────────────────────────────────────
const getConfig = async (req, res) => {
  try {
    const row = await AiConfig.findOne({ where: { id: 'main' } });
    const D = AiConfig.DEFAULTS;
    res.json({
      chatSystemPrompt:         row?.chatSystemPrompt         ?? D.chatSystemPrompt,
      fragmentAnalysisPrompt:   row?.fragmentAnalysisPrompt   ?? D.fragmentAnalysisPrompt,
      systemReportTitle:        row?.systemReportTitle        ?? D.systemReportTitle,
      enterpriseReportTitle:    row?.enterpriseReportTitle    ?? D.enterpriseReportTitle,
      systemReportChapters:     row?.systemReportChapters     ?? D.systemReportChapters,
      enterpriseReportChapters: row?.enterpriseReportChapters ?? D.enterpriseReportChapters,
    });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

// ── PUT /api/ai/config ────────────────────────────────────────────────────
const updateConfig = async (req, res) => {
  try {
    const allowed = [
      'chatSystemPrompt', 'fragmentAnalysisPrompt',
      'systemReportTitle', 'enterpriseReportTitle',
      'systemReportChapters', 'enterpriseReportChapters',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    await AiConfig.upsert({ id: 'main', ...updates });
    ai.invalidateConfigCache();
    res.json({ message: 'הגדרות AI עודכנו' });
  } catch {
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

module.exports = {
  getStatus,
  getSystemSummary,
  triggerAnalysis,
  chatWithSystem,
  getEnterpriseSummary,
  triggerEnterpriseAnalysis,
  chatEnterprise,
  getConfig,
  updateConfig,
};
