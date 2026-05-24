import { useState, useEffect } from 'react';
import { navApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// ── Icon palette offered to admin ─────────────────────────────────────────
const ICON_PALETTE = [
  '🗂️','📋','📊','📈','🔧','🔗','🏷️','🛡️','📄','💾',
  '🖥️','⚙️','🔐','📡','🌐','🔍','📝','✅','🏢','💡',
  '🔄','📦','🚀','⚡','🎯','📌','🔑','💼','🧩','🗺️',
];

const FIELD_TYPES = [
  { value: 'text',               label: 'טקסט חופשי' },
  { value: 'textarea',           label: 'טקסט ארוך' },
  { value: 'select',             label: 'בחירה מרשימה' },
  { value: 'multi_value',        label: 'ערכים מרובים (חופשי)' },
  { value: 'multi_value_select', label: 'ערכים מרובים מרשימה' },
];

const BUTTON_COLORS = ['#1a3a6b','#2554a3','#5a6a7e','#22a06b','#c87000','#c0392b','#6b4ea3'];

// ── Top-level component ───────────────────────────────────────────────────

export default function NavigationEditor() {
  const { can } = useAuth();
  const canEdit = can('navigation', 'edit');
  const canDelete = can('navigation', 'delete');

  const [buttons, setButtons]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [selectedBtn, setSelectedBtn]       = useState(null);
  const [expandedSubjectId, setExpandedSubjectId] = useState(null); // accordion — one at a time

  // Button form state
  const [btnForm, setBtnForm]       = useState(null);
  const [btnSaving, setBtnSaving]   = useState(false);

  // Subject form state
  const [subjectForm, setSubjectForm]     = useState(null);
  const [subjectSaving, setSubjectSaving] = useState(false);

  // Field form state
  const [fieldForm, setFieldForm]     = useState(null);
  const [fieldSaving, setFieldSaving] = useState(false);

  const [msg, setMsg] = useState(null);

  const flash = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const load = async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const res = await navApi.getButtons();
      setButtons(res.data);
      if (!selectedBtn && res.data.length) setSelectedBtn(res.data[0].id);
    } catch { flash('error', 'שגיאה בטעינה'); }
    finally { if (initial) setLoading(false); }
  };

  useEffect(() => { load(true); }, []);

  // Reset expanded subject when switching buttons
  useEffect(() => { setExpandedSubjectId(null); }, [selectedBtn]);

  const currentButton = buttons.find(b => b.id === selectedBtn);

  // ── Button CRUD ────────────────────────────────────────────────────────

  const startNewButton  = () => setBtnForm({ name: '', type: 'questionnaire', icon: '📋', color: '#1a3a6b' });
  const startEditButton = (btn) => setBtnForm({ id: btn.id, name: btn.name, type: btn.type, icon: btn.icon, color: btn.color });
  const cancelBtnForm   = () => setBtnForm(null);

  const saveBtnForm = async () => {
    if (!btnForm.name.trim()) return flash('error', 'שם נדרש');
    setBtnSaving(true);
    try {
      if (btnForm.id) {
        await navApi.updateButton(btnForm.id, btnForm);
      } else {
        const res = await navApi.createButton(btnForm);
        setSelectedBtn(res.data.id);
      }
      setBtnForm(null);
      await load();
    } catch (e) { flash('error', e.response?.data?.message || 'שגיאה'); }
    finally { setBtnSaving(false); }
  };

  const deleteButton = async (id) => {
    if (!window.confirm('למחוק את הכפתור וכל הנושאים והשדות שלו?')) return;
    try {
      await navApi.deleteButton(id);
      if (selectedBtn === id) setSelectedBtn(buttons.find(b => b.id !== id)?.id ?? null);
      await load();
    } catch (e) { flash('error', e.response?.data?.message || 'שגיאה במחיקה'); }
  };

  const toggleActive = async (btn) => {
    try {
      await navApi.updateButton(btn.id, { isActive: !btn.isActive });
      await load();
    } catch { flash('error', 'שגיאה'); }
  };

  // ── Subject CRUD ───────────────────────────────────────────────────────

  const startNewSubject  = () => setSubjectForm({ buttonId: selectedBtn, name: '', icon: '📋' });
  const startEditSubject = (s) => setSubjectForm({ id: s.id, buttonId: s.buttonId, name: s.name, icon: s.icon || '📋' });
  const cancelSubjectForm = () => setSubjectForm(null);

  const saveSubjectForm = async () => {
    if (!subjectForm.name.trim()) return flash('error', 'שם נדרש');
    setSubjectSaving(true);
    try {
      if (subjectForm.id) {
        await navApi.updateSubject(subjectForm.id, subjectForm);
      } else {
        const res = await navApi.createSubject(subjectForm);
        setExpandedSubjectId(res.data.id);
      }
      setSubjectForm(null);
      await load();
    } catch (e) { flash('error', e.response?.data?.message || 'שגיאה'); }
    finally { setSubjectSaving(false); }
  };

  const deleteSubject = async (id) => {
    if (!window.confirm('למחוק את הנושא וכל השדות שלו?')) return;
    try {
      await navApi.deleteSubject(id);
      if (expandedSubjectId === id) setExpandedSubjectId(null);
      await load();
    } catch { flash('error', 'שגיאה במחיקה'); }
  };

  // ── Field CRUD ─────────────────────────────────────────────────────────

  const startNewField  = (subjectId) => setFieldForm({ subjectId, name: '', type: 'text', exampleValue: '', isRequired: false, options: [] });
  const startEditField = (f) => setFieldForm({
    id: f.id, subjectId: f.subjectId, name: f.name,
    type: f.type, exampleValue: f.exampleValue || '',
    isRequired: f.isRequired,
    options: (f.options || []).map(o => ({ label: o.label, value: o.value || o.label })),
    optionInput: '',
  });
  const cancelFieldForm = () => setFieldForm(null);

  const saveFieldForm = async () => {
    if (!fieldForm.name.trim()) return flash('error', 'שם שדה נדרש');
    if ((fieldForm.type === 'select' || fieldForm.type === 'multi_value_select') && fieldForm.options.length === 0) {
      return flash('error', 'יש להוסיף לפחות ערך אחד לרשימה');
    }
    setFieldSaving(true);
    try {
      const payload = { ...fieldForm };
      delete payload.optionInput;
      if (fieldForm.id) {
        await navApi.updateField(fieldForm.id, payload);
      } else {
        await navApi.createField(payload);
      }
      setFieldForm(null);
      await load();
    } catch (e) { flash('error', e.response?.data?.message || 'שגיאה'); }
    finally { setFieldSaving(false); }
  };

  const deleteField = async (id) => {
    if (!window.confirm('למחוק את השדה?')) return;
    try {
      await navApi.deleteField(id);
      await load();
    } catch { flash('error', 'שגיאה במחיקה'); }
  };

  // ── Reorder subjects ───────────────────────────────────────────────────

  const moveSubject = async (subjectId, dir) => {
    const subjects = [...(currentButton.subjects || [])];
    const idx = subjects.findIndex(s => s.id === subjectId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= subjects.length) return;
    [subjects[idx], subjects[newIdx]] = [subjects[newIdx], subjects[idx]];
    try {
      await navApi.reorderSubjects(subjects.map(s => s.id));
      await load();
    } catch { flash('error', 'שגיאה בשינוי סדר'); }
  };

  // ── Reorder fields ─────────────────────────────────────────────────────

  const moveField = async (subjectId, fieldId, dir) => {
    const subject = (currentButton.subjects || []).find(s => s.id === subjectId);
    if (!subject) return;
    const fields = [...(subject.fields || [])];
    const idx = fields.findIndex(f => f.id === fieldId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= fields.length) return;
    [fields[idx], fields[newIdx]] = [fields[newIdx], fields[idx]];
    try {
      await navApi.reorderFields(fields.map(f => f.id));
      await load();
    } catch { flash('error', 'שגיאה בשינוי סדר'); }
  };

  // ── Field option helpers ───────────────────────────────────────────────

  const addOption = () => {
    const val = fieldForm.optionInput?.trim();
    if (!val) return;
    setFieldForm(p => ({
      ...p,
      options: [...p.options, { label: val, value: val }],
      optionInput: '',
    }));
  };

  const removeOption = (i) => setFieldForm(p => ({ ...p, options: p.options.filter((_, j) => j !== i) }));

  // ── Render ─────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={S.spinner} />
    </div>
  );

  const toggleSubject = (id) => setExpandedSubjectId(prev => prev === id ? null : id);

  return (
    <div style={S.root}>
      {/* ── Left: buttons list ── */}
      <div style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <span style={S.sidebarTitle}>כפתורי ניווט</span>
          {canEdit && <button style={S.addBtn} onClick={startNewButton}>+ הוסף</button>}
        </div>

        {msg && (
          <div style={{ ...S.msgBox, background: msg.type === 'success' ? '#f0faf5' : '#fff0ee', color: msg.type === 'success' ? '#22a06b' : '#c0392b', borderColor: msg.type === 'success' ? '#b7dfcc' : '#f8c4bb' }}>
            {msg.text}
          </div>
        )}

        {buttons.map(btn => (
          <div
            key={btn.id}
            style={{ ...S.btnRow, ...(selectedBtn === btn.id ? S.btnRowActive : {}) }}
            onClick={() => setSelectedBtn(btn.id)}
          >
            <span style={S.btnRowIcon}>{btn.icon}</span>
            <span style={{ ...S.btnRowName, opacity: btn.isActive ? 1 : 0.45 }}>{btn.name}</span>
            <span style={{ ...S.typePill, background: btn.type === 'questionnaire' ? '#e8f0fe' : '#fff4e0', color: btn.type === 'questionnaire' ? '#1a3a6b' : '#c87000' }}>
              {btn.type === 'questionnaire' ? 'שאלון' : 'מסמכים'}
            </span>
            {canEdit && (
              <div style={S.btnRowActions} onClick={e => e.stopPropagation()}>
                <button style={S.iconActBtn} title={btn.isActive ? 'השבת' : 'הפעל'} onClick={() => toggleActive(btn)}>
                  {btn.isActive ? <EyeOnIcon /> : <EyeOffIcon />}
                </button>
                <button style={S.iconActBtn} title="ערוך" onClick={() => { setSelectedBtn(btn.id); startEditButton(btn); }}>
                  <PencilIcon />
                </button>
                {canDelete && (
                  <button style={{ ...S.iconActBtn, color: '#c0392b' }} title="מחק" onClick={() => deleteButton(btn.id)}>
                    <TrashIcon />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {buttons.length === 0 && <p style={{ color: '#8a9ab0', fontSize: 12, padding: '12px 8px' }}>אין כפתורים עדיין</p>}
      </div>

      {/* ── Right: detail panel ── */}
      <div style={S.detail}>
        {/* Button form (new / edit) */}
        {btnForm && (
          <div style={S.formCard}>
            <div style={S.formTitle}>{btnForm.id ? 'עריכת כפתור' : 'כפתור חדש'}</div>
            <div style={S.formGrid}>
              <label style={S.lbl}>שם
                <input style={S.inp} value={btnForm.name} onChange={e => setBtnForm(p => ({ ...p, name: e.target.value }))} />
              </label>
              <label style={S.lbl}>סוג
                <select style={S.inp} value={btnForm.type} onChange={e => setBtnForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="questionnaire">שאלון</option>
                  <option value="documents">מסמכים</option>
                </select>
              </label>
              <label style={S.lbl}>צבע
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {BUTTON_COLORS.map(c => (
                    <div key={c} onClick={() => setBtnForm(p => ({ ...p, color: c }))}
                      style={{ width: 24, height: 24, borderRadius: 6, background: c, cursor: 'pointer', border: btnForm.color === c ? '3px solid #e8a020' : '2px solid transparent' }} />
                  ))}
                </div>
              </label>
              <label style={S.lbl}>אייקון
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {ICON_PALETTE.map(ic => (
                    <button key={ic} onClick={() => setBtnForm(p => ({ ...p, icon: ic }))}
                      style={{ fontSize: 18, background: btnForm.icon === ic ? '#e8f0fe' : 'transparent', border: btnForm.icon === ic ? '2px solid #1a3a6b' : '2px solid transparent', borderRadius: 6, cursor: 'pointer', padding: 3 }}>
                      {ic}
                    </button>
                  ))}
                </div>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={S.saveBtn} onClick={saveBtnForm} disabled={btnSaving}>{btnSaving ? 'שומר...' : '✓ שמור'}</button>
              <button style={S.cancelBtn} onClick={cancelBtnForm}>ביטול</button>
            </div>
          </div>
        )}

        {/* Subjects panel */}
        {currentButton && !btnForm && (
          <>
            <div style={S.detailHeader}>
              <span style={S.detailIcon}>{currentButton.icon}</span>
              <span style={S.detailTitle}>{currentButton.name}</span>
              <span style={{ ...S.typePill, background: currentButton.type === 'questionnaire' ? '#e8f0fe' : '#fff4e0', color: currentButton.type === 'questionnaire' ? '#1a3a6b' : '#c87000' }}>
                {currentButton.type === 'questionnaire' ? 'שאלון' : 'מסמכים'}
              </span>
            </div>

            {currentButton.type === 'documents' ? (
              <div style={S.emptyHint}>
                <span>כפתור מסמכים — מציג את הקבצים שהועלו עבור המערכת.</span>
              </div>
            ) : (
              <>
                {(currentButton.subjects || []).map((subject, idx, arr) => (
                  <SubjectBlock
                    key={subject.id}
                    subject={subject}
                    expanded={expandedSubjectId === subject.id}
                    onToggle={() => toggleSubject(subject.id)}
                    onEdit={() => startEditSubject(subject)}
                    onDelete={() => deleteSubject(subject.id)}
                    onEditField={(f) => startEditField(f)}
                    onDeleteField={(id) => deleteField(id)}
                    onMoveUp={idx > 0 ? () => moveSubject(subject.id, -1) : null}
                    onMoveDown={idx < arr.length - 1 ? () => moveSubject(subject.id, 1) : null}
                    onMoveField={(fieldId, dir) => moveField(subject.id, fieldId, dir)}
                    canEdit={canEdit}
                    canDelete={canDelete}
                  />
                ))}

                {/* Subject form (new / edit) */}
                {subjectForm && (
                  <SubjectForm
                    form={subjectForm}
                    saving={subjectSaving}
                    onChange={setSubjectForm}
                    onSave={saveSubjectForm}
                    onCancel={cancelSubjectForm}
                    title={subjectForm.id ? 'עריכת נושא' : 'נושא חדש'}
                  />
                )}

                {/* Action row: Add Field + Add Subject */}
                {canEdit && !subjectForm && (
                  <div style={S.actionRow}>
                    <button
                      style={S.actionBtn}
                      disabled={!expandedSubjectId}
                      onClick={() => expandedSubjectId && startNewField(expandedSubjectId)}
                    >
                      + הוסף שדה
                    </button>
                    <button style={S.actionBtn} onClick={startNewSubject}>
                      + הוסף נושא
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!currentButton && !btnForm && (
          <div style={S.emptyHint}>בחר כפתור מהרשימה משמאל או צור כפתור חדש.</div>
        )}
      </div>

      {/* ── Field editor modal ── */}
      {fieldForm && (
        <div style={S.modalOverlay} onClick={cancelFieldForm}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>{fieldForm.id ? 'עריכת שדה' : 'שדה חדש'}</div>
            <div style={S.formGrid}>
              <label style={S.lbl}>שם השדה
                <input style={S.inp} value={fieldForm.name} onChange={e => setFieldForm(p => ({ ...p, name: e.target.value }))} />
              </label>
              <label style={S.lbl}>סוג
                <select style={S.inp} value={fieldForm.type} onChange={e => setFieldForm(p => ({ ...p, type: e.target.value }))}>
                  {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
              <label style={S.lbl}>ערך לדוגמה
                <input style={S.inp} value={fieldForm.exampleValue} onChange={e => setFieldForm(p => ({ ...p, exampleValue: e.target.value }))} />
              </label>
              <label style={{ ...S.lbl, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={fieldForm.isRequired} onChange={e => setFieldForm(p => ({ ...p, isRequired: e.target.checked }))} />
                שדה חובה
              </label>

              {(fieldForm.type === 'select' || fieldForm.type === 'multi_value_select') && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ ...S.lbl, marginBottom: 6 }}>ערכי הרשימה</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <input
                      style={{ ...S.inp, flex: 1 }}
                      value={fieldForm.optionInput || ''}
                      onChange={e => setFieldForm(p => ({ ...p, optionInput: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                      placeholder="הקלד ערך ↵"
                    />
                    <button style={S.saveBtn} onClick={addOption}>הוסף</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {fieldForm.options.map((o, i) => (
                      <span key={i} style={S.optionTag}>
                        {o.label}
                        <button style={S.tagX} onClick={() => removeOption(i)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button style={S.saveBtn} onClick={saveFieldForm} disabled={fieldSaving}>{fieldSaving ? 'שומר...' : '✓ שמור'}</button>
              <button style={S.cancelBtn} onClick={cancelFieldForm}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SubjectBlock ──────────────────────────────────────────────────────────

function SubjectBlock({ subject, expanded, onToggle, onEdit, onDelete, onEditField, onDeleteField, onMoveUp, onMoveDown, onMoveField, canEdit, canDelete }) {
  const FIELD_TYPE_LABEL = {
    text: 'טקסט', textarea: 'טקסט ארוך', select: 'בחירה',
    multi_value: 'ערכים חופשיים', multi_value_select: 'בחירה מרובה',
  };
  return (
    <div style={S.subjectBlock}>
      <div style={S.subjectHeader}>
        <button style={S.chevronBtn} onClick={onToggle}>{expanded ? '▾' : '▸'}</button>
        <span style={S.subjectIcon}>{subject.icon}</span>
        <span style={S.subjectName}>{subject.name}</span>
        <span style={S.fieldCount}>{(subject.fields || []).length} שדות</span>
        {canEdit && (
          <div style={{ display: 'flex', gap: 2, marginRight: 'auto', alignItems: 'center' }}>
            <button style={{ ...S.arrowBtn, opacity: onMoveUp ? 1 : 0.25 }} disabled={!onMoveUp} onClick={onMoveUp} title="העלה למעלה"><ArrowUpIcon /></button>
            <button style={{ ...S.arrowBtn, opacity: onMoveDown ? 1 : 0.25 }} disabled={!onMoveDown} onClick={onMoveDown} title="הורד למטה"><ArrowDownIcon /></button>
            <button style={{ ...S.iconActBtn, marginRight: 4 }} onClick={onEdit}><PencilIcon /></button>
            {canDelete && <button style={{ ...S.iconActBtn, color: '#c0392b' }} onClick={onDelete}><TrashIcon /></button>}
          </div>
        )}
      </div>

      {expanded && (
        <div style={S.fieldsArea}>
          {(subject.fields || []).map((f, idx, arr) => (
            <div key={f.id} style={S.fieldRow}>
              <span style={S.fieldName}>{f.name}</span>
              <span style={S.fieldTypePill}>{FIELD_TYPE_LABEL[f.type] || f.type}</span>
              {f.isRequired && <span style={S.requiredBadge}>חובה</span>}
              {f.options?.length > 0 && <span style={S.optCount}>{f.options.length} ערכים</span>}
              {canEdit && (
                <div style={{ marginRight: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
                  <button style={{ ...S.arrowBtn, opacity: idx > 0 ? 1 : 0.25 }} disabled={idx === 0} onClick={() => onMoveField(f.id, -1)} title="העלה למעלה"><ArrowUpIcon /></button>
                  <button style={{ ...S.arrowBtn, opacity: idx < arr.length - 1 ? 1 : 0.25 }} disabled={idx === arr.length - 1} onClick={() => onMoveField(f.id, 1)} title="הורד למטה"><ArrowDownIcon /></button>
                  <button style={{ ...S.iconActBtn, marginRight: 4 }} onClick={() => onEditField(f)}><PencilIcon /></button>
                  {canDelete && <button style={{ ...S.iconActBtn, color: '#c0392b' }} onClick={() => onDeleteField(f.id)}><TrashIcon /></button>}
                </div>
              )}
            </div>
          ))}
          {(subject.fields || []).length === 0 && (
            <div style={{ padding: '10px 10px', color: '#8a9ab0', fontSize: 13 }}>אין שדות עדיין — לחץ "הוסף שדה" למטה</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SubjectForm ───────────────────────────────────────────────────────────

function SubjectForm({ form, saving, onChange, onSave, onCancel, title = 'נושא חדש' }) {
  return (
    <div style={S.subjectFormCard}>
      <div style={S.formTitle}>{title}</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label style={{ ...S.lbl, flex: 1, minWidth: 160 }}>שם
          <input style={S.inp} value={form.name} onChange={e => onChange(p => ({ ...p, name: e.target.value }))} />
        </label>
        <label style={S.lbl}>אייקון
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
            {ICON_PALETTE.slice(0, 15).map(ic => (
              <button key={ic} onClick={() => onChange(p => ({ ...p, icon: ic }))}
                style={{ fontSize: 15, background: form.icon === ic ? '#e8f0fe' : 'transparent', border: form.icon === ic ? '2px solid #1a3a6b' : '2px solid transparent', borderRadius: 5, cursor: 'pointer', padding: 2 }}>
                {ic}
              </button>
            ))}
          </div>
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button style={S.saveBtn} onClick={onSave} disabled={saving}>{saving ? 'שומר...' : '✓ שמור'}</button>
        <button style={S.cancelBtn} onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────

function PencilIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>;
}
function TrashIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>;
}
function EyeOnIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}
function EyeOffIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
}
function ArrowUpIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15"/></svg>;
}
function ArrowDownIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>;
}

// ── Styles ────────────────────────────────────────────────────────────────

const S = {
  root: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', direction: 'rtl' },
  sidebar: {
    width: 280, flexShrink: 0, background: '#fff', borderLeft: '1px solid #d1dce8',
    display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0,
  },
  sidebarHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px 10px', borderBottom: '1px solid #d1dce8',
  },
  sidebarTitle: { fontSize: 15, fontWeight: 700, color: '#1a3a6b' },
  addBtn: {
    background: '#e8a020', color: '#fff', border: 'none', borderRadius: 6,
    padding: '7px 14px', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'Rubik',
  },
  msgBox: { margin: '6px 10px', padding: '8px 12px', borderRadius: 6, fontSize: 14, border: '1px solid' },
  btnRow: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '11px 14px',
    cursor: 'pointer', borderBottom: '1px solid #f0f4f8', transition: 'background 0.12s',
  },
  btnRowActive: { background: '#eef3fb' },
  btnRowIcon: { fontSize: 18, flexShrink: 0 },
  btnRowName: { flex: 1, fontSize: 15, fontWeight: 600, color: '#1a2332' },
  btnRowActions: { display: 'flex', gap: 2 },
  iconActBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer', padding: 5,
    color: '#5a6a7e', display: 'flex', alignItems: 'center', borderRadius: 4,
    transition: 'background 0.12s',
  },
  arrowBtn: {
    background: 'transparent', border: '1px solid #d1dce8', cursor: 'pointer', padding: '3px 5px',
    color: '#5a6a7e', display: 'flex', alignItems: 'center', borderRadius: 4,
    transition: 'background 0.12s',
  },
  typePill: {
    fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 10,
    letterSpacing: 0.3, flexShrink: 0,
  },

  detail: { flex: 1, minHeight: 0, padding: '22px 26px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 },
  detailHeader: { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 },
  detailIcon: { fontSize: 24 },
  detailTitle: { fontSize: 19, fontWeight: 700, color: '#1a3a6b', flex: 1 },
  emptyHint: { color: '#8a9ab0', fontSize: 15, padding: '22px 0' },

  formCard: {
    background: '#fff', border: '1px solid #d1dce8', borderRadius: 10,
    padding: '18px 20px', marginBottom: 4,
  },
  subjectFormCard: {
    background: '#f8fafc', border: '1px dashed #b8d0f8', borderRadius: 8,
    padding: '16px 18px', flexShrink: 0,
  },
  formTitle: { fontSize: 15, fontWeight: 700, color: '#1a3a6b', marginBottom: 14 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 18px' },
  lbl: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: '#8a9ab0', textTransform: 'uppercase', letterSpacing: 0.6 },
  inp: {
    background: '#f8fafc', border: '1.5px solid #d1dce8', borderRadius: 7,
    padding: '10px 12px', fontSize: 15, fontFamily: 'Rubik', color: '#1a2332',
    direction: 'rtl', outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  saveBtn: {
    background: '#1a3a6b', color: '#fff', border: 'none', borderRadius: 7,
    padding: '9px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'Rubik',
  },
  cancelBtn: {
    background: '#f0f4f8', color: '#5a6a7e', border: '1px solid #d1dce8', borderRadius: 7,
    padding: '9px 16px', cursor: 'pointer', fontSize: 14, fontFamily: 'Rubik',
  },

  subjectBlock: { background: '#fff', border: '1px solid #d1dce8', borderRadius: 8, overflow: 'hidden', flexShrink: 0 },
  subjectHeader: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px',
    background: '#f8fafc', borderBottom: '1px solid #eef3fb', cursor: 'pointer',
  },
  chevronBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#5a6a7e', padding: 2 },
  subjectIcon: { fontSize: 18 },
  subjectName: { fontSize: 15, fontWeight: 700, color: '#1a2332', flex: 1 },
  fieldCount: { fontSize: 13, color: '#8a9ab0' },
  fieldsArea: { padding: '8px 12px 12px' },
  fieldRow: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px',
    borderBottom: '1px solid #f0f4f8', fontSize: 15,
  },
  fieldName: { flex: 1, color: '#1a2332', fontSize: 15 },
  fieldTypePill: {
    fontSize: 12, padding: '3px 9px', borderRadius: 10,
    background: '#e8f0fe', color: '#1a3a6b', fontWeight: 600,
  },
  requiredBadge: {
    fontSize: 12, padding: '3px 8px', borderRadius: 10,
    background: '#fff0ee', color: '#c0392b', fontWeight: 600,
  },
  optCount: { fontSize: 12, color: '#8a9ab0' },

  // Action row at the bottom
  actionRow: {
    display: 'flex', gap: 10, marginTop: 4, flexShrink: 0,
  },
  actionBtn: {
    flex: 1, background: 'transparent', border: '1px dashed #b8d0f8',
    borderRadius: 8, padding: '10px 18px', cursor: 'pointer',
    fontSize: 15, color: '#2554a3', fontFamily: 'Rubik',
  },
  actionBtnDisabled: {
    opacity: 0.35, cursor: 'not-allowed', borderColor: '#d1dce8', color: '#8a9ab0',
  },

  // Field modal
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,35,71,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16,
    backdropFilter: 'blur(3px)',
  },
  modal: {
    background: '#fff', borderRadius: 12, padding: '24px 26px',
    width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(15,35,71,0.25)',
    direction: 'rtl',
  },
  modalTitle: { fontSize: 17, fontWeight: 700, color: '#1a3a6b', marginBottom: 18 },
  optionTag: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '4px 12px', borderRadius: 10, fontSize: 14,
    background: '#e8f0fe', color: '#1a3a6b', border: '1px solid #b8d0f8',
  },
  tagX: { background: 'none', border: 'none', cursor: 'pointer', color: '#1a3a6b', padding: 0, fontSize: 17, lineHeight: 1 },
  spinner: {
    width: 32, height: 32, border: '3px solid #d1dce8',
    borderTopColor: '#1a3a6b', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
};
