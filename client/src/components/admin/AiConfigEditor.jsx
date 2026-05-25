import React, { useState, useEffect } from 'react';
import { aiApi } from '../../services/api';

const TABS = [
  { id: 'api',        label: '🔑 חיבור API' },
  { id: 'chat',       label: '💬 צ׳אט' },
  { id: 'system',     label: '📄 דוח מערכת' },
  { id: 'enterprise', label: '🏢 דוח ארגוני' },
];

const CLAUDE_MODELS = [
  { value: 'claude-opus-4-7',          label: 'Claude Opus 4.7 (חזק ביותר)' },
  { value: 'claude-sonnet-4-6',        label: 'Claude Sonnet 4.6 (מאוזן — ברירת מחדל)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (מהיר וזול)' },
];

export default function AiConfigEditor() {
  const [config,     setConfig]     = useState(null);
  const [tab,        setTab]        = useState('api');
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState(null);
  const [newApiKey,  setNewApiKey]  = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await aiApi.getConfig();
      setConfig(data);
    } catch {
      showMsg('error', 'שגיאה בטעינת הגדרות AI');
    }
  };

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...config };
      if (newApiKey.trim()) payload.claudeApiKey = newApiKey.trim();
      const { data } = await aiApi.updateConfig(payload);
      setNewApiKey('');
      await load();
      if (data.rerun && data.rerunMessage) {
        showMsg('ok', `✓ נשמר · ${data.rerunMessage}`);
      } else if (data.delta?.score > 0) {
        showMsg('ok', `✓ נשמר · שינוי קטן (ציון ${data.delta.score}/${data.delta.threshold}) — אין הפעלה מחדש אוטומטית`);
      } else {
        showMsg('ok', 'הגדרות נשמרו בהצלחה');
      }
    } catch {
      showMsg('error', 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const set = (key, val) => setConfig(p => ({ ...p, [key]: val }));

  // ── Chapter helpers ──────────────────────────────────────────────────────
  const setChapter = (key, idx, field, val) =>
    setConfig(p => {
      const arr = [...(p[key] || [])];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...p, [key]: arr };
    });

  const addChapter = (key) =>
    setConfig(p => ({
      ...p,
      [key]: [...(p[key] || []), { title: '', prompt: '' }],
    }));

  const removeChapter = (key, idx) =>
    setConfig(p => ({
      ...p,
      [key]: (p[key] || []).filter((_, i) => i !== idx),
    }));

  const moveChapter = (key, idx, dir) =>
    setConfig(p => {
      const arr = [...(p[key] || [])];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= arr.length) return p;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
      return { ...p, [key]: arr };
    });

  if (!config) return <div style={S.loading}>טוען הגדרות AI...</div>;

  return (
    <div style={S.root}>

      {/* ── Tabs ── */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={S.body}>

        {/* ── API connection tab ── */}
        {tab === 'api' && (
          <>
            <Section title='מפתח Claude API' hint='המפתח נשמר בצורה מאובטחת בבסיס הנתונים. השג מפתח ב-console.anthropic.com'>
              {config.claudeApiKeySet && (
                <div style={{ fontSize: 12, color: '#22a06b', marginBottom: 8, fontWeight: 600 }}>
                  ✓ מפתח מוגדר: {config.claudeApiKeyMask}
                </div>
              )}
              <input
                style={S.input}
                type='password'
                value={newApiKey}
                onChange={e => setNewApiKey(e.target.value)}
                placeholder={config.claudeApiKeySet ? 'הזן מפתח חדש לשינוי...' : 'sk-ant-api03-...'}
                autoComplete='off'
              />
              {!config.claudeApiKeySet && (
                <div style={{ fontSize: 11, color: '#e5381c', marginTop: 4 }}>
                  ⚠️ מפתח API לא מוגדר — שירות ה-AI לא יפעל עד שתוגדר.
                </div>
              )}
            </Section>

            <Section title='מודל Claude' hint='בחר את מודל Claude שישמש לניתוח ולשיחה.'>
              <select
                style={{ ...S.input, cursor: 'pointer' }}
                value={config.claudeModel || 'claude-sonnet-4-6'}
                onChange={e => set('claudeModel', e.target.value)}
              >
                {CLAUDE_MODELS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </Section>
          </>
        )}

        {/* ── Chat tab ── */}
        {tab === 'chat' && (
          <Section title='הנחיית מערכת לצ׳אט' hint='טקסט זה נשלח כ-"system message" לפני כל שיחה. מגדיר את התפקיד, השפה והטרמינולוגיה של הבוט.'>
            <textarea
              style={{ ...S.textarea, minHeight: 140 }}
              value={config.chatSystemPrompt || ''}
              onChange={e => set('chatSystemPrompt', e.target.value)}
              placeholder='אתה יועץ ארכיטקטורת מערכות ברמת CTO...'
            />
          </Section>
        )}

        {/* ── System report tab ── */}
        {tab === 'system' && (
          <>
            <Section title='כותרת הדוח' hint='השתמש ב-{name} עבור שם המערכת.'>
              <input
                style={S.input}
                value={config.systemReportTitle || ''}
                onChange={e => set('systemReportTitle', e.target.value)}
                placeholder='דו"ח ארכיטקטורה — {name}'
              />
            </Section>

            <Section title='פרומפט ניתוח דיאגרמה' hint='משמש לניתוח כל קובץ תמונה בנפרד. השתמש ב-{systemName} ו-{fileName}.'>
              <textarea
                style={{ ...S.textarea, minHeight: 130 }}
                value={config.fragmentAnalysisPrompt || ''}
                onChange={e => set('fragmentAnalysisPrompt', e.target.value)}
                placeholder='אתה אדריכל מערכות ברמת CTO. נתח את הדיאגרמה "{fileName}"...'
              />
            </Section>

            <ChapterList
              label='פרקי הדוח'
              chapters={config.systemReportChapters || []}
              chapterKey='systemReportChapters'
              onSet={setChapter}
              onAdd={addChapter}
              onRemove={removeChapter}
              onMove={moveChapter}
            />
          </>
        )}

        {/* ── Enterprise report tab ── */}
        {tab === 'enterprise' && (
          <>
            <Section title='כותרת הדוח הארגוני'>
              <input
                style={S.input}
                value={config.enterpriseReportTitle || ''}
                onChange={e => set('enterpriseReportTitle', e.target.value)}
                placeholder='דו"ח ארכיטקטורה ארגוני'
              />
            </Section>

            <ChapterList
              label='פרקי הדוח הארגוני'
              chapters={config.enterpriseReportChapters || []}
              chapterKey='enterpriseReportChapters'
              onSet={setChapter}
              onAdd={addChapter}
              onRemove={removeChapter}
              onMove={moveChapter}
            />
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={S.footer}>
        {msg && (
          <span style={{ fontSize: 13, color: msg.type === 'ok' ? '#22a06b' : '#e5381c', fontWeight: 600 }}>
            {msg.type === 'ok' ? '✓ ' : '✗ '}{msg.text}
          </span>
        )}
        <button style={S.saveBtn} onClick={save} disabled={saving}>
          {saving ? 'שומר...' : '💾 שמור שינויים'}
        </button>
      </div>
    </div>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, hint, children }) {
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      {hint && <div style={S.sectionHint}>{hint}</div>}
      {children}
    </div>
  );
}

// ── Chapter list ─────────────────────────────────────────────────────────────
function ChapterList({ label, chapters, chapterKey, onSet, onAdd, onRemove, onMove }) {
  return (
    <Section title={label} hint='כל פרק מכיל כותרת ותיאור מה לכלול בו — ה-AI יעקוב אחריהם בדוח.'>
      {chapters.map((ch, i) => (
        <div key={i} style={S.chapter}>
          <div style={S.chapterHeader}>
            <span style={S.chapterNum}>{i + 1}</span>
            <input
              style={{ ...S.input, flex: 1, marginBottom: 0 }}
              value={ch.title}
              onChange={e => onSet(chapterKey, i, 'title', e.target.value)}
              placeholder='כותרת הפרק...'
            />
            <div style={{ display: 'flex', gap: 4 }}>
              <button style={S.moveBtn} onClick={() => onMove(chapterKey, i, -1)} title='העלה'>▲</button>
              <button style={S.moveBtn} onClick={() => onMove(chapterKey, i, 1)}  title='הורד'>▼</button>
              <button style={{ ...S.moveBtn, color: '#e5381c' }} onClick={() => onRemove(chapterKey, i)} title='מחק'>✕</button>
            </div>
          </div>
          <textarea
            style={{ ...S.textarea, minHeight: 70, marginTop: 6 }}
            value={ch.prompt}
            onChange={e => onSet(chapterKey, i, 'prompt', e.target.value)}
            placeholder='תאר מה על ה-AI לכלול בפרק זה...'
          />
        </div>
      ))}
      <button style={S.addChBtn} onClick={() => onAdd(chapterKey)}>+ הוסף פרק</button>
    </Section>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100%',
    fontFamily: 'Rubik, sans-serif', direction: 'rtl',
  },
  loading: { padding: 40, color: '#8a9ab0', textAlign: 'center', fontFamily: 'Rubik' },
  tabBar: {
    display: 'flex', gap: 0, padding: '0 24px',
    background: '#f8fafc', flexShrink: 0,
    borderBottom: '1px solid #e0e8f2',
  },
  tab: {
    padding: '12px 20px', border: 'none', borderBottom: '3px solid transparent',
    background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
    fontFamily: 'Rubik', color: '#5a6a7e', marginBottom: '-1px',
  },
  tabActive: { color: '#1a3a6b', borderBottom: '3px solid #1a3a6b' },
  body: { flex: 1, overflowY: 'auto', padding: '20px 28px' },
  section: { marginBottom: 26 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#0f2347', marginBottom: 4 },
  sectionHint:  { fontSize: 12, color: '#8a9ab0', marginBottom: 8 },
  input: {
    width: '100%', border: '1.5px solid #d1dce8', borderRadius: 7,
    padding: '8px 11px', fontSize: 13, fontFamily: 'Rubik',
    direction: 'rtl', outline: 'none', color: '#1a2332', background: '#fff',
    marginBottom: 0, boxSizing: 'border-box',
  },
  textarea: {
    width: '100%', border: '1.5px solid #d1dce8', borderRadius: 7,
    padding: '9px 11px', fontSize: 13, fontFamily: 'Rubik',
    direction: 'rtl', outline: 'none', color: '#1a2332', background: '#fff',
    resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box',
  },
  chapter: {
    background: '#f8fafc', border: '1px solid #e0e8f2',
    borderRadius: 8, padding: '11px 13px', marginBottom: 10,
  },
  chapterHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  chapterNum: {
    width: 24, height: 24, borderRadius: '50%', background: '#1a3a6b', color: '#fff',
    fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0,
  },
  moveBtn: {
    background: 'transparent', border: '1px solid #d1dce8', borderRadius: 5,
    padding: '2px 7px', cursor: 'pointer', fontSize: 11, color: '#5a6a7e',
  },
  addChBtn: {
    background: 'transparent', border: '1.5px dashed #b0c4d8', borderRadius: 7,
    padding: '8px 16px', cursor: 'pointer', fontSize: 13, color: '#2554a3',
    fontFamily: 'Rubik', width: '100%', marginTop: 4,
  },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 28px', borderTop: '1px solid #e0e8f2',
    background: '#fff', flexShrink: 0,
  },
  saveBtn: {
    background: '#1a3a6b', color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 24px', cursor: 'pointer', fontSize: 14,
    fontFamily: 'Rubik', fontWeight: 600,
  },
};
