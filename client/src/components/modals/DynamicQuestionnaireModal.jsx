import React, { useState, useEffect } from 'react';
import { navApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function DynamicQuestionnaireModal({ button, system, onClose }) {
  const { can } = useAuth();
  const canEdit = can('systems', 'edit');

  const [mode, setMode] = useState('view');
  const [savedData, setSavedData] = useState({});
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [activeSubject, setActiveSubject] = useState(null);

  const subjects = button.subjects || [];

  useEffect(() => {
    if (subjects.length) setActiveSubject(subjects[0].id);
  }, [button.id]);

  useEffect(() => {
    navApi.getResponse(system.id, button.id)
      .then(r => { setSavedData(r.data); setForm(r.data); })
      .catch(() => { setSavedData({}); setForm({}); })
      .finally(() => setLoading(false));
  }, [system.id, button.id]);

  const set = (fieldId, value) => setForm(p => ({ ...p, [fieldId]: value }));

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await navApi.saveResponse(system.id, button.id, form);
      setSavedData(res.data);
      setForm(res.data);
      setMode('view');
      setMsg({ type: 'success', text: 'נשמר בהצלחה' });
      setTimeout(() => setMsg(null), 2500);
    } catch {
      setMsg({ type: 'error', text: 'שגיאה בשמירה' });
    } finally { setSaving(false); }
  };

  const handleCancel = () => { setForm(savedData); setMode('view'); };

  const currentSubject = subjects.find(s => s.id === activeSubject);

  // completion dot color per subject
  const dotColor = (subject) => {
    const fields = subject.fields || [];
    if (!fields.length) return '#d1dce8';
    const filled = fields.filter(f => {
      const v = form[f.id];
      if (v == null) return false;
      if (Array.isArray(v)) return v.length > 0;
      return String(v).trim() !== '';
    }).length;
    if (filled === fields.length) return '#22a06b';
    if (filled > 0) return '#e8a020';
    return '#d1dce8';
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>

        {/* ── Hero ── */}
        <div style={S.hero}>
          <div style={S.heroInner}>
            <div style={{ ...S.heroIconWrap, background: button.color + '28', borderColor: button.color + '80' }}>
              <span style={{ fontSize: 18 }}>{button.icon}</span>
            </div>
            <div style={S.heroText}>
              <div style={S.heroTitle}>{button.name} — {system.name}</div>
            </div>
            <div style={S.heroBadges}>
              <span style={{ ...S.modeBadge, ...(mode === 'edit' ? S.modeBadgeEdit : {}) }}>
                {mode === 'view' ? 'צפייה' : 'עריכה'}
              </span>
            </div>
          </div>

          <div style={S.heroControls}>
            {msg && (
              <span style={{ fontSize: 12, color: msg.type === 'success' ? '#1a6b45' : '#c0392b' }}>
                {msg.type === 'success' ? '✓' : '✗'} {msg.text}
              </span>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {canEdit && mode === 'view' && (
                <button style={S.btnEdit} onClick={() => setMode('edit')}>
                  <PencilIcon /> ערוך
                </button>
              )}
              {mode === 'edit' && (
                <>
                  <button style={S.btnCancel} onClick={handleCancel}>ביטול</button>
                  <button style={S.btnSave} disabled={saving} onClick={handleSave}>
                    {saving ? 'שומר...' : '✓ שמור'}
                  </button>
                </>
              )}
            </div>
          </div>

          <button style={S.closeBtn} onClick={onClose} aria-label="סגור">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={S.body}>
          {loading ? (
            <div style={S.loadingWrap}><div style={S.spinner} /></div>
          ) : subjects.length === 0 ? (
            <div style={S.emptyMsg}>לכפתור זה אין נושאים מוגדרים עדיין.</div>
          ) : (
            <>
              {/* Subject nav */}
              <nav style={S.nav}>
                {subjects.map(s => (
                  <button
                    key={s.id}
                    style={{ ...S.navBtn, ...(activeSubject === s.id ? S.navBtnActive : {}) }}
                    onClick={() => setActiveSubject(s.id)}
                  >
                    <span style={S.navIcon}>{s.icon || '📋'}</span>
                    <span style={S.navLabel}>{s.name}</span>
                    <span style={{ ...S.navDot, background: dotColor(s) }} />
                  </button>
                ))}
              </nav>

              {/* Fields panel */}
              <div style={S.panel}>
                {currentSubject && (
                  <>
                    <div style={S.panelHeader}>
                      <span style={S.panelIcon}>{currentSubject.icon || '📋'}</span>
                      <span style={S.panelTitle}>{currentSubject.name}</span>
                      <div style={S.panelRule} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(currentSubject.fields || []).map((f, idx) => (
                        <FieldRow key={f.id} field={f} index={idx + 1} form={form} mode={mode} set={set} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FieldRow ──────────────────────────────────────────────────────────────

function FieldRow({ field, index, form, mode, set }) {
  const val = form[field.id];
  const options = field.options || [];

  const viewContent = () => {
    if (field.type === 'select') {
      const opt = options.find(o => (o.value || o.label) === val);
      return <span style={S.valText}>{opt ? opt.label : (val || <Dash />)}</span>;
    }
    if (field.type === 'multi_value' || field.type === 'multi_value_select') {
      const items = Array.isArray(val) ? val : (val ? [val] : []);
      return items.length
        ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 2 }}>
            {items.map((t, i) => <span key={i} style={S.tagView}>{t}</span>)}</div>
        : <Dash />;
    }
    if (field.type === 'textarea') {
      return <p style={{ ...S.valText, whiteSpace: 'pre-wrap', margin: 0 }}>{val || <Dash />}</p>;
    }
    return <span style={S.valText}>{val || <Dash />}</span>;
  };

  const editContent = () => {
    if (field.type === 'select') {
      return (
        <select style={S.input} value={val || ''} onChange={e => set(field.id, e.target.value)}>
          <option value="">בחר...</option>
          {options.map(o => (
            <option key={o.value || o.label} value={o.value || o.label}>{o.label}</option>
          ))}
        </select>
      );
    }
    if (field.type === 'multi_value') {
      return <TagInput fieldId={field.id} form={form} set={set} />;
    }
    if (field.type === 'multi_value_select') {
      return <MultiSelectInput fieldId={field.id} options={options} form={form} set={set} />;
    }
    if (field.type === 'textarea') {
      return (
        <textarea
          style={{ ...S.input, minHeight: 80, resize: 'vertical' }}
          value={val || ''}
          onChange={e => set(field.id, e.target.value)}
        />
      );
    }
    // text (default)
    return (
      <input
        style={S.input}
        type="text"
        value={val || ''}
        placeholder={field.exampleValue || ''}
        onChange={e => set(field.id, e.target.value)}
      />
    );
  };

  return (
    <div style={S.fieldRow}>
      <div style={S.fieldLabelRow}>
        <span style={S.fieldNum}>{index}</span>
        <span style={S.fieldLabel}>
          {field.name}
          {field.isRequired && <span style={{ color: '#c0392b', marginRight: 3 }}>*</span>}
        </span>
        <div style={S.fieldLabelLine} />
      </div>
      <div style={mode === 'view' ? S.fieldValView : S.fieldVal}>
        {mode === 'view' ? viewContent() : editContent()}
      </div>
    </div>
  );
}

// ── TagInput (multi_value free text) ──────────────────────────────────────

function TagInput({ fieldId, form, set }) {
  const items = Array.isArray(form[fieldId]) ? form[fieldId] : [];
  const [val, setVal] = useState('');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', padding: '3px 0' }}>
      {items.map((item, i) => (
        <span key={i} style={S.tagEdit}>
          {item}
          <button onClick={() => set(fieldId, items.filter((_, j) => j !== i))} style={S.tagX}>×</button>
        </span>
      ))}
      <input
        style={{ ...S.input, flex: 1, minWidth: 100, padding: '6px 10px', fontSize: 14 }}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ',') && val.trim()) {
            e.preventDefault();
            set(fieldId, [...items, val.trim()]);
            setVal('');
          }
        }}
        placeholder="הוסף ↵"
      />
    </div>
  );
}

// ── MultiSelectInput (multi_value_select from list) ───────────────────────

function MultiSelectInput({ fieldId, options, form, set }) {
  const selected = Array.isArray(form[fieldId]) ? form[fieldId] : [];
  const toggle = (v) => {
    const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v];
    set(fieldId, next);
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 4 }}>
      {options.map(o => {
        const v = o.value || o.label;
        const active = selected.includes(v);
        return (
          <button key={v} onClick={() => toggle(v)} style={{
            padding: '4px 12px', borderRadius: 10, fontSize: 12, cursor: 'pointer',
            background: active ? '#1a3a6b' : '#f0f4f8',
            color: active ? '#fff' : '#5a6a7e',
            border: active ? '1px solid #1a3a6b' : '1px solid #d1dce8',
            fontFamily: 'Rubik', fontWeight: active ? 600 : 400,
            transition: 'all 0.12s',
          }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Dash() {
  return <span style={{ color: '#b0bec5' }}>—</span>;
}

function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>;
}

// ── Styles ────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(15,35,71,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16,
    backdropFilter: 'blur(4px)',
    animation: 'fadeIn 0.15s ease',
  },
  modal: {
    background: '#ffffff', border: '1px solid #d1dce8',
    borderRadius: 14, width: '100%', maxWidth: 880,
    height: '85vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(26,58,107,0.18), 0 2px 8px rgba(26,58,107,0.08)',
    overflow: 'hidden',
    animation: 'slideUp 0.25s ease forwards',
  },

  // Hero
  hero: {
    background: 'linear-gradient(135deg, #0f2347 0%, #1a3a6b 60%, #2554a3 100%)',
    padding: '18px 20px 14px', flexShrink: 0, position: 'relative',
  },
  heroInner: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  heroIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid', flexShrink: 0,
  },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: { fontSize: 17, fontWeight: 700, color: '#ffffff', letterSpacing: -0.2 },
  heroBadges: { display: 'flex', gap: 6, alignItems: 'center' },
  heroControls: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 10,
    borderTop: '1px solid rgba(255,255,255,0.12)',
  },
  closeBtn: {
    position: 'absolute', top: 14, left: 14,
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 6, padding: 6, cursor: 'pointer', color: 'rgba(255,255,255,0.8)',
    display: 'flex', transition: 'background 0.15s',
  },

  // Badges & buttons
  modeBadge: {
    padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    background: 'rgba(255,255,255,0.1)', color: 'rgba(200,220,255,0.8)',
    border: '1px solid rgba(255,255,255,0.15)', letterSpacing: 0.5, fontFamily: 'monospace',
  },
  modeBadgeEdit: {
    background: 'rgba(232,160,32,0.2)', color: '#f4c060', borderColor: 'rgba(232,160,32,0.4)',
  },
  btnEdit: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'rgba(255,255,255,0.12)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.25)', borderRadius: 7,
    padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'Rubik',
  },
  btnCancel: {
    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)',
    border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7,
    padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'Rubik',
  },
  btnSave: {
    background: '#e8a020', color: '#fff', border: 'none', borderRadius: 7,
    padding: '6px 18px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
    fontFamily: 'Rubik', boxShadow: '0 2px 8px rgba(232,160,32,0.35)',
  },

  // Body
  body: { display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0, background: '#f8fafc' },
  loadingWrap: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spinner: {
    width: 32, height: 32, border: '3px solid #d1dce8',
    borderTopColor: '#1a3a6b', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  emptyMsg: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a9ab0', fontSize: 14 },

  // Section nav
  nav: {
    width: 185, flexShrink: 0, background: '#ffffff', borderLeft: '1px solid #d1dce8',
    padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto',
  },
  navBtn: {
    display: 'flex', alignItems: 'center', gap: 9, position: 'relative',
    padding: '10px 12px', borderRadius: 8, border: 'none',
    background: 'transparent', cursor: 'pointer', fontSize: 15, fontFamily: 'Rubik',
    color: '#5a6a7e', textAlign: 'right', width: '100%', transition: 'all 0.15s',
  },
  navBtnActive: { background: '#eef3fb', color: '#1a3a6b', fontWeight: 600, borderRight: '3px solid #1a3a6b' },
  navIcon: { color: 'inherit', flexShrink: 0 },
  navLabel: { flex: 1 },
  navDot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },

  // Panel
  panel: { flex: 1, padding: '18px 22px', overflowY: 'auto', minWidth: 0 },
  panelHeader: {
    display: 'flex', alignItems: 'center', gap: 9, marginBottom: 22,
    paddingBottom: 14, borderBottom: '2px solid #e8f0fe',
  },
  panelIcon: { color: '#1a3a6b' },
  panelTitle: { fontSize: 14, fontWeight: 700, color: '#1a3a6b', textTransform: 'uppercase', letterSpacing: 0.6 },
  panelRule: { flex: 1 },

  // Fields
  fieldRow: {
    background: '#fff', border: '1px solid #e8eef5', borderRadius: 10,
    padding: '12px 16px',
  },
  fieldLabelRow: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
  },
  fieldNum: {
    width: 22, height: 22, borderRadius: '50%', background: '#1a3a6b', color: '#fff',
    fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0,
  },
  fieldLabel: {
    fontSize: 13, fontWeight: 600, color: '#5a6a7e', whiteSpace: 'nowrap', flexShrink: 0,
  },
  fieldLabelLine: { flex: 1, height: 1, background: '#e8eef5' },
  fieldValView: {
    background: '#f8fafc', border: '1px solid #e8eef5', borderRadius: 7,
    padding: '10px 14px', minHeight: 40,
  },
  fieldVal: {},
  valText: { fontSize: 16, color: '#1a2332' },
  input: {
    background: '#f8fafc', border: '2px solid #d1dce8',
    borderRadius: 8, padding: '11px 14px', fontSize: 16,
    fontFamily: 'Rubik, sans-serif', color: '#1a2332',
    width: '100%', outline: 'none', direction: 'rtl',
    transition: 'border-color 0.2s', boxSizing: 'border-box',
  },
  tagView: {
    padding: '3px 11px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    background: '#e8f0fe', color: '#1a3a6b', border: '1px solid #b8d0f8',
  },
  tagEdit: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 10, fontSize: 13,
    background: '#fff4e0', color: '#c87000', border: '1px solid #f4d5a0',
  },
  tagX: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#c87000', padding: 0, fontSize: 16, lineHeight: 1,
  },
};
