import React, { useState, useEffect } from 'react';
import { systemsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const CRITICALITY = [
  { value: 'critical', label: 'קריטי', color: '#c0392b', bg: '#fff0ee', border: '#f5c6c0' },
  { value: 'high',     label: 'גבוה',  color: '#c87000', bg: '#fff8e8', border: '#f4d5a0' },
  { value: 'medium',   label: 'בינוני',color: '#1a3a6b', bg: '#e8f0fe', border: '#b8d0f8' },
  { value: 'low',      label: 'נמוך',  color: '#1a6b45', bg: '#edfaf4', border: '#a8dfc5' },
];

const SERVICE_TYPES = ['SaaS', 'On-Premise', 'Hybrid', 'PaaS', 'IaaS', 'Legacy'];
const FREQUENCIES   = ['Real-time', 'Near Real-time', 'Batch - יומי', 'Batch - שבועי', 'On Demand', 'Event-driven'];

const SECTIONS = [
  { id: 'info', label: 'פרטי מערכת', icon: <IconServer />,
    fields: [
      { key: 'systemName',     label: 'שם המערכת' },
      { key: 'alias',          label: 'כינוי' },
      { key: 'businessDomain', label: 'תחום עסקי' },
      { key: 'systemOwner',    label: 'בעל המערכת' },
      { key: 'vendor',         label: 'ספק / יצרן' },
      { key: 'version',        label: 'גרסה', mono: true },
      { key: 'deploymentYear', label: 'שנת הטמעה', type: 'number', mono: true },
    ],
  },
  { id: 'service', label: 'סוג שירות', icon: <IconLayers />,
    fields: [
      { key: 'serviceType',    label: 'סוג שירות',  options: SERVICE_TYPES },
      { key: 'serviceSubtype', label: 'תת-סוג' },
      { key: 'criticality',    label: 'קריטיות',    options: CRITICALITY },
    ],
  },
  { id: 'integration', label: 'אינטגרציות', icon: <IconLink />, fullWidth: true,
    fields: [
      { key: 'upstreamSystems',      label: 'Upstream — מערכות מזינות',  tags: true },
      { key: 'downstreamSystems',    label: 'Downstream — מערכות מוזנות', tags: true },
      { key: 'protocols',            label: 'פרוטוקולים', tags: true },
      { key: 'integrationFrequency', label: 'תדירות תקשורת', options: FREQUENCIES },
    ],
  },
  { id: 'tech', label: 'תשתית טכנולוגית', icon: <IconChip />,
    fields: [
      { key: 'appServer',     label: 'שרת אפליקציה', mono: true },
      { key: 'database',      label: 'מסד נתונים',    mono: true },
      { key: 'loadBalancer',  label: 'Load Balancer', mono: true },
      { key: 'firewall',      label: 'חומת אש',       mono: true },
      { key: 'loggingSystem', label: 'מערכת לוגים',   mono: true },
    ],
  },
  { id: 'sla', label: 'SLA ורציפות', icon: <IconShield />,
    fields: [
      { key: 'rto',          label: 'RTO', mono: true },
      { key: 'rpo',          label: 'RPO', mono: true },
      { key: 'sla',          label: 'SLA', mono: true },
      { key: 'availability', label: 'זמינות', mono: true },
    ],
  },
  { id: 'docs', label: 'תיעוד', icon: <IconDoc />,
    fields: [
      { key: 'hasDocumentation', label: 'קיים תיעוד', bool: true },
      { key: 'documentationUrl', label: 'קישור לתיעוד' },
      { key: 'notes',            label: 'הערות', textarea: true },
    ],
  },
];

export default function SystemModal({ system, onClose }) {
  const { can } = useAuth();
  const canEdit = can('systems', 'edit');
  const [mode, setMode]       = useState('view');
  const [data, setData]       = useState(null);
  const [form, setForm]       = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState(null);
  const [activeSection, setActiveSection] = useState('info');

  useEffect(() => {
    systemsApi.getOne(system.key)
      .then(r => { const d = r.data.data || {}; setData(d); setForm(d); })
      .catch(() => setForm({}))
      .finally(() => setLoading(false));
  }, [system.key]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await systemsApi.updateData(system.key, form);
      setData(res.data); setForm(res.data); setMode('view');
      setMsg({ type: 'success', text: 'נשמר בהצלחה' });
      setTimeout(() => setMsg(null), 2500);
    } catch {
      setMsg({ type: 'error', text: 'שגיאה בשמירה' });
    } finally { setSaving(false); }
  };

  const crit = CRITICALITY.find(c => c.value === form.criticality);
  const currentSection = SECTIONS.find(s => s.id === activeSection);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>

        {/* ── Hero ── */}
        <div style={S.hero}>
          <div style={S.heroInner}>
            <div style={S.heroIconWrap}><IconServer size={20} /></div>
            <div style={S.heroText}>
              <div style={S.heroTitle}>{form.systemName || system.name}</div>
              {form.alias && <div style={S.heroSub}>{form.alias}</div>}
            </div>
            <div style={S.heroBadges}>
              {form.serviceType && (
                <span style={S.typeBadge}>{form.serviceType}</span>
              )}
              <span style={{ ...S.modeBadge, ...(mode === 'edit' ? S.modeBadgeEdit : {}) }}>
                {mode === 'view' ? 'צפייה' : 'עריכה'}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div style={S.heroControls}>
            {msg && (
              <span style={{ fontSize: 12, color: msg.type === 'success' ? '#1a6b45' : '#c0392b' }}>
                {msg.type === 'success' ? '✓' : '✗'} {msg.text}
              </span>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {canEdit && mode === 'view' && (
                <button style={S.btnEdit} onClick={() => setMode('edit')}>
                  <IconPencil /> ערוך
                </button>
              )}
              {mode === 'edit' && (
                <>
                  <button style={S.btnCancel} onClick={() => { setMode('view'); setForm(data || {}); }}>ביטול</button>
                  <button style={S.btnSave} disabled={saving} onClick={handleSave}>
                    {saving ? 'שומר...' : '✓ שמור'}
                  </button>
                </>
              )}
            </div>
          </div>

          <button style={S.closeBtn} onClick={onClose} aria-label="סגור">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={S.body}>
          {loading ? (
            <div style={S.loadingWrap}>
              <div style={S.spinner} />
            </div>
          ) : (
            <>
              {/* Section nav */}
              <nav style={S.nav}>
                {SECTIONS.map(sec => {
                  const filled = sec.fields.filter(f =>
                    form[f.key] != null && (Array.isArray(form[f.key]) ? form[f.key].length > 0 : String(form[f.key]).trim() !== '')
                  ).length;
                  const total = sec.fields.length;
                  const dotColor = filled === total ? '#22a06b' : filled > 0 ? '#e8a020' : '#d1dce8';
                  return (
                    <button
                      key={sec.id}
                      style={{ ...S.navBtn, ...(activeSection === sec.id ? S.navBtnActive : {}) }}
                      onClick={() => setActiveSection(sec.id)}
                    >
                      <span style={S.navIcon}>{sec.icon}</span>
                      <span style={S.navLabel}>{sec.label}</span>
                      <span style={{ ...S.navDot, background: dotColor }} />
                    </button>
                  );
                })}
              </nav>

              {/* Fields panel */}
              <div style={S.panel}>
                <div style={S.panelHeader}>
                  <span style={S.panelIcon}>{currentSection?.icon}</span>
                  <span style={S.panelTitle}>{currentSection?.label}</span>
                  <div style={S.panelRule} />
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: currentSection?.fullWidth ? '1fr' : '1fr 1fr',
                  gap: '4px 32px',
                }}>
                  {currentSection?.fields.map(f => (
                    <FieldRow key={f.key} def={f} form={form} mode={mode} set={set} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldRow({ def, form, mode, set }) {
  const val = form[def.key];

  const viewContent = () => {
    if (def.bool) {
      const yes = Boolean(val);
      return <span style={{ ...S.valText, color: yes ? '#1a6b45' : '#8a9ab0', fontWeight: 600 }}>{yes ? '✓ כן' : '— לא'}</span>;
    }
    if (def.key === 'criticality') {
      const c = CRITICALITY.find(x => x.value === val);
      if (!c) return <Dash />;
      return (
        <span style={{ ...S.critBadge, color: c.color, background: c.bg, borderColor: c.border }}>
          <span style={{ ...S.dot, background: c.color }} />{c.label}
        </span>
      );
    }
    if (def.options) {
      const found = def.options.find(o => typeof o === 'string' ? o === val : o.value === val);
      const display = found ? (typeof found === 'string' ? found : found.label) : val;
      return <span style={{ ...S.valText, ...(def.mono ? S.monoVal : {}) }}>{display || <Dash />}</span>;
    }
    if (def.tags) {
      const items = val || [];
      return items.length
        ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 2 }}>
            {items.map((t, i) => <span key={i} style={S.tagView}>{t}</span>)}
          </div>
        : <Dash />;
    }
    return <span style={{ ...S.valText, ...(def.mono ? S.monoVal : {}) }}>{val || <Dash />}</span>;
  };

  const editContent = () => {
    if (def.bool) {
      return (
        <select style={S.input} value={val ? 'true' : 'false'} onChange={e => set(def.key, e.target.value === 'true')}>
          <option value="false">לא</option>
          <option value="true">כן</option>
        </select>
      );
    }
    if (def.options) {
      return (
        <select style={S.input} value={val || ''} onChange={e => set(def.key, e.target.value)}>
          <option value="">בחר...</option>
          {def.options.map(o => typeof o === 'string'
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>
          )}
        </select>
      );
    }
    if (def.tags) return <TagInput name={def.key} form={form} set={set} />;
    if (def.textarea) {
      return <textarea style={{ ...S.input, minHeight: 70, resize: 'vertical' }} value={val || ''} onChange={e => set(def.key, e.target.value)} />;
    }
    return (
      <input
        style={{ ...S.input, ...(def.mono ? S.monoInput : {}) }}
        type={def.type || 'text'}
        value={val || ''}
        onChange={e => set(def.key, e.target.value)}
      />
    );
  };

  return (
    <div style={S.fieldRow}>
      <div style={S.fieldLabel}>{def.label}</div>
      <div style={S.fieldVal}>{mode === 'view' ? viewContent() : editContent()}</div>
    </div>
  );
}

function TagInput({ name, form, set }) {
  const items = form[name] || [];
  const [val, setVal] = useState('');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', padding: '3px 0' }}>
      {items.map((item, i) => (
        <span key={i} style={S.tagEdit}>
          {item}
          <button onClick={() => set(name, items.filter((_, j) => j !== i))} style={S.tagX}>×</button>
        </span>
      ))}
      <input
        style={{ ...S.input, flex: 1, minWidth: 100, padding: '6px 10px', fontSize: 14 }}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if ((e.key === 'Enter' || e.key === ',') && val.trim()) {
            e.preventDefault();
            set(name, [...items, val.trim()]);
            setVal('');
          }
        }}
        placeholder="הוסף ↵"
      />
    </div>
  );
}

function Dash() {
  return <span style={{ color: '#b0bec5' }}>—</span>;
}

// Icons
function IconServer({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>;
}
function IconLayers() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;
}
function IconLink() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>;
}
function IconChip() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="7" y="7" width="10" height="10" rx="1"/><path d="M16 2v3M8 2v3M16 19v3M8 19v3M2 16h3M2 8h3M19 16h3M19 8h3"/></svg>;
}
function IconShield() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
function IconDoc() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
}
function IconPencil() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>;
}

// ── Styles ──────────────────────────────────────────────────────────────────
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
    background: '#ffffff',
    border: '1px solid #d1dce8',
    borderRadius: 14, width: '100%', maxWidth: 880,
    maxHeight: '92vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(26,58,107,0.18), 0 2px 8px rgba(26,58,107,0.08)',
    overflow: 'hidden',
    animation: 'slideUp 0.25s ease forwards',
  },

  // Hero
  hero: {
    background: 'linear-gradient(135deg, #0f2347 0%, #1a3a6b 60%, #2554a3 100%)',
    padding: '18px 20px 14px', flexShrink: 0, position: 'relative',
  },
  heroInner: {
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
  },
  heroIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    background: 'rgba(232,160,32,0.18)',
    border: '1px solid rgba(232,160,32,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#e8a020', flexShrink: 0,
  },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: {
    fontSize: 17, fontWeight: 700, color: '#ffffff', letterSpacing: -0.2,
  },
  heroSub: {
    fontSize: 12, color: 'rgba(200,220,255,0.65)', marginTop: 2,
    fontFamily: 'monospace', letterSpacing: 0.3,
  },
  heroBadges: {
    display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap',
    marginLeft: 8,
  },
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

  // Badges
  critBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    border: '1px solid', letterSpacing: 0.2,
  },
  dot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  typeBadge: {
    padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: 'rgba(255,255,255,0.12)', color: 'rgba(220,235,255,0.9)',
    border: '1px solid rgba(255,255,255,0.18)',
    fontFamily: 'monospace', letterSpacing: 0.2,
  },
  modeBadge: {
    padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    background: 'rgba(255,255,255,0.1)', color: 'rgba(200,220,255,0.8)',
    border: '1px solid rgba(255,255,255,0.15)', letterSpacing: 0.5,
    fontFamily: 'monospace',
  },
  modeBadgeEdit: {
    background: 'rgba(232,160,32,0.2)', color: '#f4c060',
    borderColor: 'rgba(232,160,32,0.4)',
  },

  // Buttons
  btnEdit: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'rgba(255,255,255,0.12)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.25)', borderRadius: 7,
    padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    fontFamily: 'Rubik', transition: 'background 0.15s',
  },
  btnCancel: {
    background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)',
    border: '1px solid rgba(255,255,255,0.2)', borderRadius: 7,
    padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontFamily: 'Rubik',
  },
  btnSave: {
    background: '#e8a020', color: '#fff',
    border: 'none', borderRadius: 7,
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

  // Section nav
  nav: {
    width: 168, flexShrink: 0,
    background: '#ffffff', borderLeft: '1px solid #d1dce8',
    padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2,
    overflowY: 'auto',
  },
  navBtn: {
    display: 'flex', alignItems: 'center', gap: 8, position: 'relative',
    padding: '8px 10px', borderRadius: 8, border: 'none',
    background: 'transparent', cursor: 'pointer', fontSize: 13, fontFamily: 'Rubik',
    color: '#5a6a7e', textAlign: 'right', width: '100%', transition: 'all 0.15s',
  },
  navBtnActive: {
    background: '#eef3fb', color: '#1a3a6b', fontWeight: 600,
    borderRight: '3px solid #1a3a6b',
  },
  navIcon: { color: 'inherit', flexShrink: 0 },
  navLabel: { flex: 1 },
  navDot: {
    width: 6, height: 6, borderRadius: '50%', background: '#e8a020', flexShrink: 0,
  },

  // Panel
  panel: { flex: 1, padding: '20px 24px', overflowY: 'auto', minWidth: 0 },
  panelHeader: {
    display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
    paddingBottom: 12, borderBottom: '2px solid #e8f0fe',
  },
  panelIcon: { color: '#1a3a6b' },
  panelTitle: {
    fontSize: 13, fontWeight: 700, color: '#1a3a6b',
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  panelRule: { flex: 1 },

  // Fields
  fieldRow: {
    paddingBottom: 16, marginBottom: 16,
    borderBottom: '1px solid #f0f4f8',
  },
  fieldLabel: {
    fontSize: 11, fontWeight: 700, color: '#8a9ab0',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 6, fontFamily: 'monospace',
  },
  fieldVal: {},
  valText: { fontSize: 16, color: '#1a2332' },
  monoVal: {
    fontFamily: 'monospace', fontSize: 15,
    color: '#2554a3', letterSpacing: 0.2,
  },

  // Input
  input: {
    background: '#f8fafc',
    border: '2px solid #d1dce8',
    borderRadius: 8, padding: '9px 13px',
    fontSize: 15, fontFamily: 'Rubik, sans-serif',
    color: '#1a2332', width: '100%', outline: 'none',
    direction: 'rtl', transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  },
  monoInput: { fontFamily: 'monospace', color: '#2554a3', letterSpacing: 0.2 },

  // Tags
  tagView: {
    padding: '3px 11px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    background: '#e8f0fe', color: '#1a3a6b',
    border: '1px solid #b8d0f8',
  },
  tagEdit: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '3px 10px', borderRadius: 10, fontSize: 13,
    background: '#fff4e0', color: '#c87000',
    border: '1px solid #f4d5a0',
  },
  tagX: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#c87000', padding: 0, fontSize: 16, lineHeight: 1,
  },
};
