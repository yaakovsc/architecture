import React, { useState, useEffect, useRef, useCallback } from 'react';
import { aiApi } from '../../services/api';
import { openSystemReport, openEnterpriseReport } from '../../utils/reportPdf';

// ── Lightweight Markdown renderer ────────────────────────────────────────────
function renderMd(text) {
  if (!text) return '';
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^## (.+)$/gm,   '<h3 style="margin:14px 0 5px;color:#1a3a6b;font-size:15px;font-weight:700">$1</h3>')
    .replace(/^### (.+)$/gm,  '<h4 style="margin:11px 0 4px;color:#2554a3;font-size:14px;font-weight:600">$1</h4>')
    .replace(/^#### (.+)$/gm, '<h5 style="margin:9px 0 3px;color:#5a6a7e;font-size:13px;font-weight:600">$1</h5>')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,    '<em>$1</em>')
    .replace(/`(.+?)`/g,      '<code style="background:#f0f4f8;padding:1px 5px;border-radius:3px;font-size:12px;font-family:monospace">$1</code>')
    .replace(/^\| (.+)$/gm,   '<div style="font-size:12px;padding:3px 0;border-bottom:1px solid #f0f4f8">| $1</div>')
    .replace(/^- (.+)$/gm,    '<li style="margin:2px 0 2px 18px;list-style:disc">$1</li>')
    .replace(/\n\n/g,'<br/><br/>')
    .replace(/\n/g,'<br/>');
}

// ── Status badge config ───────────────────────────────────────────────────────
const STATUS_CONFIG = {
  none:       { label: 'לא נותח',    color: '#8a9ab0', bg: '#f0f4f8', icon: '○' },
  pending:    { label: 'ממתין לתור', color: '#c87000', bg: '#fff8f0', icon: '⏳' },
  processing: { label: 'מנתח...',    color: '#2554a3', bg: '#e8f0fe', icon: '⟳' },
  ready:      { label: 'מוכן',       color: '#22a06b', bg: '#f0faf5', icon: '✓' },
  error:      { label: 'שגיאה',      color: '#c0392b', bg: '#fff0ee', icon: '✗' },
};

/**
 * AIChatPanel — dual-mode AI adviser
 *
 * Props:
 *   mode      'system' | 'enterprise'
 *   system    system object (required when mode='system')
 *   onClose   () => void
 */
export default function AIChatPanel({ mode = 'system', system, onClose }) {
  const isEnterprise = mode === 'enterprise';

  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState('');
  const [streaming,    setStreaming]     = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState(null);
  const [summary,      setSummary]      = useState(null);
  const [view,         setView]         = useState('chat'); // kept for future use

  const messagesEndRef    = useRef(null);
  const abortRef          = useRef(null);
  const pollRef           = useRef(null);
  const autoTriggeredRef  = useRef(false);

  // ── Load status + summary on mount / when system changes ───────────────
  useEffect(() => {
    autoTriggeredRef.current = false;
    loadStatus();
    loadSummary();
    setMessages([]);
    setView('chat');
    return () => clearInterval(pollRef.current);
  }, [isEnterprise ? 'enterprise' : system?.key]);

  const loadStatus = async () => {
    try { setOllamaStatus((await aiApi.getStatus()).data); }
    catch { setOllamaStatus({ available: false }); }
  };

  const loadSummary = useCallback(async () => {
    try {
      const res = isEnterprise
        ? await aiApi.getEnterpriseSummary()
        : await aiApi.getSummary(system.key);
      const data = res.data;
      setSummary(data);

      if (data.status === 'processing' || data.status === 'pending' || data.status === 'error') {
        clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          const r = isEnterprise
            ? await aiApi.getEnterpriseSummary()
            : await aiApi.getSummary(system.key);
          setSummary(r.data);
          if (r.data.status !== 'processing' && r.data.status !== 'pending' && r.data.status !== 'error') {
            clearInterval(pollRef.current);
          }
        }, 4000);
      } else if (data.status === 'none' && !autoTriggeredRef.current) {
        // Auto-trigger first analysis
        autoTriggeredRef.current = true;
        try {
          if (isEnterprise) await aiApi.triggerEnterpriseAnalysis();
          else await aiApi.triggerAnalysis(system.key);
          setSummary({ status: 'pending' });
          loadSummary(); // start polling
        } catch { /* ignore auto-trigger errors, user can retry manually */ }
      }
    } catch { setSummary({ status: 'none' }); }
  }, [isEnterprise, system?.key]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer]);

  // ── Trigger analysis ────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    try {
      if (isEnterprise) {
        await aiApi.triggerEnterpriseAnalysis();
      } else {
        await aiApi.triggerAnalysis(system.key);
      }
      setSummary({ status: 'pending' });
      loadSummary();
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      addMsg('assistant', `⚠️ ${msg}`);
    }
  };

  // ── Chat ────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setStreaming(true);
    setStreamBuffer('');

    const token = localStorage.getItem('accessToken');
    const controller = new AbortController();
    abortRef.current = controller;

    const url = isEnterprise
      ? aiApi.enterpriseChatUrl()
      : aiApi.chatUrl(system.key);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify({ messages: next }),
        signal:  controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader  = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let   buf = '', full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const obj = JSON.parse(line.slice(6));
            if (obj.token) { full += obj.token; setStreamBuffer(full); }
            if (obj.done)  { setMessages(p => [...p, { role: 'assistant', content: full }]); setStreamBuffer(''); }
            if (obj.error) { setMessages(p => [...p, { role: 'assistant', content: `⚠️ ${obj.error}` }]); setStreamBuffer(''); }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        addMsg('assistant', `⚠️ ${err.message}`);
        setStreamBuffer('');
      }
    } finally { setStreaming(false); }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    if (streamBuffer) { addMsg('assistant', streamBuffer + ' [הופסק]'); setStreamBuffer(''); }
    setStreaming(false);
  };

  const addMsg = (role, content) => setMessages(p => [...p, { role, content }]);

  // ── Derived state ───────────────────────────────────────────────────────
  // Treat a stored fallback string as an error (legacy bad records)
  const reportContent = (summary?.content && summary.content !== 'לא ניתן היה לייצר דו"ח.' && summary.content !== 'לא ניתן היה לייצר דו"ח ארגוני.')
    ? summary.content
    : null;
  const summaryStatus = summary?.status || 'none';
  const effectiveStatus = (summaryStatus === 'ready' && !reportContent) ? 'error' : summaryStatus;
  const statusCfg     = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.none;
  const unavailable   = ollamaStatus && !ollamaStatus.available;
  const isProcessing  = effectiveStatus === 'processing' || effectiveStatus === 'pending';

  const panelTitle = isEnterprise ? 'יועץ AI ארגוני' : 'יועץ AI — מערכת';
  const panelSub   = isEnterprise
    ? `${summary?.systemCount ? `${summary.systemCount} מערכות` : 'כלל המערכות'}`
    : system?.name;

  // Friendly message when report is unavailable
  const reportUnavailableMsg = (() => {
    if (effectiveStatus === 'none' || effectiveStatus === 'pending') {
      return isEnterprise
        ? 'מאתחל ניתוח ארגוני — הדו"ח יהיה מוכן בקרוב...'
        : 'מאתחל ניתוח — הדו"ח יהיה מוכן בקרוב...';
    }
    if (effectiveStatus === 'processing') {
      return isEnterprise ? 'ניתוח ארגוני מתבצע...' : 'ניתוח מתבצע...';
    }
    if (effectiveStatus === 'error') {
      return summary?.errorMessage || 'אירעה שגיאה בלתי צפויה. ניתן לנסות שוב.';
    }
    return null;
  })();

  return (
    <div style={{ ...S.panel, width: isEnterprise ? 520 : 430 }}>

      {/* ── Header ── */}
      <div style={{ ...S.header, background: isEnterprise
        ? 'linear-gradient(135deg,#2d0b5c 0%,#5a1a9e 60%,#7c3fcf 100%)'
        : 'linear-gradient(135deg,#0f2347 0%,#1a3a6b 60%,#2554a3 100%)'
      }}>
        <div style={S.headerLeft}>
          <span style={{ fontSize: 20 }}>{isEnterprise ? '🏢' : '🤖'}</span>
          <div>
            <div style={S.headerTitle}>{panelTitle}</div>
            <div style={S.headerSub}>{panelSub}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {ollamaStatus && (
            <span
              style={{ width: 7, height: 7, borderRadius: '50%', background: ollamaStatus.available ? '#22a06b' : '#e5381c', flexShrink: 0 }}
              title={ollamaStatus.available ? `Ollama פעיל · ${ollamaStatus.model}` : 'Ollama לא זמין'}
            />
          )}
          <button style={S.hBtn} onClick={onClose}>✕</button>
        </div>
      </div>

      {/* ── Analysis status bar ── */}
      <div style={{ ...S.statusBar, background: statusCfg.bg }}>
        <span style={{ ...S.statusLabel, color: statusCfg.color }}>
          <span style={isProcessing ? S.spin : {}}>{statusCfg.icon}</span>
          {' '}{statusCfg.label}
          {effectiveStatus === 'ready' && (isEnterprise
            ? (summary?.systemCount > 0 ? ` · ${summary.systemCount} מערכות נותחו` : '')
            : (summary?.fragmentCount > 0 ? ` · ${summary.fragmentCount} קבצים נותחו` : ''))
          }
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {effectiveStatus === 'ready' && reportContent && (
            <button
              style={{ ...S.analyzeBtn, background: '#1a3a6b', color: '#fff', fontWeight: 600 }}
              onClick={() => isEnterprise
                ? openEnterpriseReport(summary?.systemCount, reportContent)
                : openSystemReport(system?.name, reportContent)
              }
            >
              📄 פתח דו"ח
            </button>
          )}
        </div>
      </div>

      {/* ── Progress notice ── */}
      {(effectiveStatus === 'processing' || effectiveStatus === 'pending') && (
        <div style={S.notice}>
          <span style={S.spin}>⟳</span>
          {' '}
          {summary?.progress || (effectiveStatus === 'pending' ? 'ממתין לתור...' : 'מאתחל...')}
          {reportContent && <span style={{ opacity: 0.7, marginRight: 8, fontSize: 11 }}> — מוצג דו"ח קודם</span>}
        </div>
      )}

      {unavailable && (
        <div style={{ ...S.notice, background: '#fff8f0', color: '#c87000', borderBottom: '1px solid #ffe4b5' }}>
          ⚠️ Ollama אינו זמין. ודא שהשירות רץ על localhost:11434.
        </div>
      )}

      {/* ── Chat view ── */}
      <>
        <div style={S.messages}>
            {messages.length === 0 && !streaming && (
              <div style={S.empty}>
                <div style={{ fontSize: 28 }}>{isEnterprise ? '🏢' : '🏗️'}</div>
                <p style={{ fontSize: 13, color: '#8a9ab0', textAlign: 'center', margin: 0 }}>
                  {effectiveStatus === 'ready'
                    ? (isEnterprise
                        ? 'שאל שאלה ארגונית — הדו"ח הארגוני יוזרק כהקשר אוטומטית.'
                        : 'שאל שאלה — הדו"ח יוזרק כהקשר אוטומטית.')
                    : isProcessing
                    ? 'ניתוח מתבצע ברקע — ניתן לשאול שאלות כבר עכשיו.'
                    : effectiveStatus === 'error'
                    ? (summary?.errorMessage || 'אירעה שגיאה בניתוח. הניתוח יופעל מחדש אוטומטית.')
                    : (isEnterprise
                        ? 'מאתחל ניתוח ארגוני — אנא המתן...'
                        : 'מאתחל ניתוח — אנא המתן...')}
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{ ...S.msg, ...(m.role === 'user' ? S.msgUser : S.msgAI) }}>
                {m.role === 'assistant'
                  ? <div dangerouslySetInnerHTML={{ __html: renderMd(m.content) }} />
                  : <span>{m.content}</span>}
              </div>
            ))}

            {streamBuffer && (
              <div style={{ ...S.msg, ...S.msgAI }}>
                <div dangerouslySetInnerHTML={{ __html: renderMd(streamBuffer) }} />
                <span style={S.cursor}>▌</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input ── */}
          {!unavailable && (
            <div style={S.inputRow}>
              <input
                style={S.input}
                placeholder={
                  streaming ? 'ממתין לתשובה...' :
                  isProcessing ? 'ניתן לשאול גם בזמן ניתוח...' :
                  isEnterprise ? 'שאל שאלה ארגונית...' : 'שאל על הארכיטקטורה...'
                }
                value={input}
                disabled={streaming}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
              />
              {streaming
                ? <button style={{ ...S.sendBtn, background: '#e5381c' }} onClick={handleStop}>■</button>
                : <button style={S.sendBtn} onClick={handleSend} disabled={!input.trim()}>➤</button>}
            </div>
          )}
      </>
    </div>
  );
}

const S = {
  panel: {
    position: 'fixed', bottom: 20, left: 20, zIndex: 1200,
    maxHeight: '72vh',
    background: '#fff', borderRadius: 14,
    border: '1px solid #d1dce8',
    boxShadow: '0 12px 40px rgba(15,35,71,0.18)',
    display: 'flex', flexDirection: 'column',
    fontFamily: 'Rubik, sans-serif', direction: 'rtl',
    overflow: 'hidden', animation: 'slideUp 0.2s ease',
  },
  header: {
    padding: '11px 13px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 9 },
  headerTitle: { fontSize: 13, fontWeight: 700, color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  hBtn: { background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: 13 },
  statusBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '7px 12px', flexShrink: 0, borderBottom: '1px solid #e8eef5',
  },
  statusLabel: { fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 },
  analyzeBtn: {
    background: 'transparent', border: '1px solid #d1dce8', borderRadius: 6,
    padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontFamily: 'Rubik', color: '#1a3a6b',
  },
  notice: { background: '#e8f0fe', color: '#2554a3', fontSize: 12, padding: '7px 12px', borderBottom: '1px solid #c5d5f5', flexShrink: 0 },
  reportPane: { flex: 1, overflowY: 'auto', padding: '14px 16px', fontSize: 13, lineHeight: 1.65, color: '#1a2332' },
  friendlyMsg: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' },
  messages: { flex: 1, overflowY: 'auto', padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 9 },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 20 },
  msg: { padding: '9px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.6, wordBreak: 'break-word' },
  msgUser: { background: '#1a3a6b', color: '#fff', alignSelf: 'flex-start', borderRadius: '10px 10px 4px 10px' },
  msgAI:   { background: '#f8fafc', color: '#1a2332', border: '1px solid #e8eef5', borderRadius: '10px 10px 10px 4px' },
  cursor:  { animation: 'pulse 1s ease infinite', display: 'inline-block', marginRight: 2 },
  inputRow: { display: 'flex', gap: 7, padding: '9px 11px', borderTop: '1px solid #e8eef5', flexShrink: 0, alignItems: 'center' },
  input: {
    flex: 1, border: '1.5px solid #d1dce8', borderRadius: 8,
    padding: '8px 11px', fontSize: 13, fontFamily: 'Rubik',
    direction: 'rtl', outline: 'none', color: '#1a2332', background: '#f8fafc',
  },
  sendBtn: {
    background: '#1a3a6b', color: '#fff', border: 'none', borderRadius: 8,
    width: 36, height: 36, cursor: 'pointer', fontSize: 15, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  spin: { display: 'inline-block', animation: 'spin 1s linear infinite' },
};
