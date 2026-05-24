import React, { useState, useEffect } from 'react';
import { usersApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_PERMS = {
  systems:    { view: true,  edit: false, delete: false },
  diagrams:   { view: true,  edit: false, delete: false },
  users:      { view: false, edit: false, delete: false },
  navigation: { view: false, edit: false, delete: false },
  ai:         { view: true,  chat: true },
};

const ROLE_LABELS = { admin: 'מנהל', user: 'משתמש' };

export default function UserManagement() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null = closed, {} = new user, {id,...} = edit
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await usersApi.getAll();
      setUsers(res.data);
    } catch {
      showMsg('error', 'שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const openNew = () => setForm({
    username: '', email: '', fullName: '', password: '', role: 'user',
    permissions: DEFAULT_PERMS,
  });

  const openEdit = (u) => {
    const perms = { ...DEFAULT_PERMS, ...(u.permissions || {}) };
    // Ensure every resource key exists (handles users created before new permissions were added)
    Object.keys(DEFAULT_PERMS).forEach(res => {
      perms[res] = { ...DEFAULT_PERMS[res], ...(perms[res] || {}) };
    });
    setForm({
      id: u.id, username: u.username, email: u.email,
      fullName: u.fullName, role: u.role,
      permissions: perms,
      password: '',
    });
  };

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setPerm = (res, action, val) => setForm(p => ({
    ...p,
    permissions: { ...p.permissions, [res]: { ...p.permissions[res], [action]: val } },
  }));

  const handleSave = async () => {
    if (!form.username || !form.fullName || !form.email) {
      showMsg('error', 'כל השדות חובה'); return;
    }
    if (!form.id && !form.password) {
      showMsg('error', 'סיסמה חובה למשתמש חדש'); return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (form.id) {
        await usersApi.update(form.id, payload);
      } else {
        await usersApi.create(payload);
      }
      await load();
      setForm(null);
      showMsg('success', form.id ? 'משתמש עודכן' : 'משתמש נוצר');
    } catch (err) {
      showMsg('error', err.response?.data?.message || 'שגיאה');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await usersApi.delete(deleteConfirm.id);
      setUsers(prev => prev.filter(u => u.id !== deleteConfirm.id));
      setDeleteConfirm(null);
      showMsg('success', 'משתמש נמחק');
    } catch {
      showMsg('error', 'שגיאה במחיקה');
    }
  };

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>משתמשים ({users.length})</span>
        <button style={styles.addBtn} onClick={openNew}>+ משתמש חדש</button>
      </div>

      {msg && (
        <div style={{ ...styles.msg, background: msg.type === 'success' ? '#f0faf5' : '#fff0ee', color: msg.type === 'success' ? '#22a06b' : '#c0392b', borderColor: msg.type === 'success' ? '#b7dfcc' : '#f8c4bb' }}>
          {msg.text}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={styles.center}>טוען...</div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['שם מלא', 'שם משתמש', 'אימייל', 'תפקיד', 'סטטוס', ''].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={styles.tr}>
                  <td style={styles.td}>
                    <div style={styles.avatar}>{u.fullName?.[0] || '?'}</div>
                    {u.fullName}
                  </td>
                  <td style={styles.td}>{u.username}</td>
                  <td style={styles.td}>{u.email}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.roleBadge, background: u.role === 'admin' ? '#e8f0fe' : '#f0faf5', color: u.role === 'admin' ? '#1a3a6b' : '#22a06b' }}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.roleBadge, background: u.isActive ? '#f0faf5' : '#fff0ee', color: u.isActive ? '#22a06b' : '#c0392b' }}>
                      {u.isActive ? 'פעיל' : 'מושבת'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button style={styles.actionBtn} onClick={() => openEdit(u)}>ערוך</button>
                      {u.id !== me?.id && (
                        <button style={{ ...styles.actionBtn, color: '#e5381c', borderColor: '#e5381c' }} onClick={() => setDeleteConfirm(u)}>מחק</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {form && (
        <div style={overlay}>
          <div style={dialog} onClick={e => e.stopPropagation()}>
            <div style={dlgHeader}>
              <h3 style={{ fontSize: 16, color: '#1a3a6b' }}>{form.id ? 'עריכת משתמש' : 'משתמש חדש'}</h3>
              <button style={closeBtn} onClick={() => setForm(null)}>✕</button>
            </div>
            <div style={dlgBody}>
              <div style={grid2}>
                <Field label="שם מלא">
                  <input style={inp} value={form.fullName} onChange={e => set('fullName', e.target.value)} placeholder="ישראל ישראלי" />
                </Field>
                <Field label="שם משתמש">
                  <input style={inp} value={form.username} onChange={e => set('username', e.target.value)} disabled={!!form.id} />
                </Field>
                <Field label="אימייל">
                  <input style={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
                </Field>
                <Field label={form.id ? 'סיסמה חדשה (השאר ריק לאי-שינוי)' : 'סיסמה'}>
                  <input style={inp} type="password" value={form.password} onChange={e => set('password', e.target.value)} />
                </Field>
                <Field label="תפקיד">
                  <select style={inp} value={form.role} onChange={e => set('role', e.target.value)}>
                    <option value="user">משתמש</option>
                    <option value="admin">מנהל</option>
                  </select>
                </Field>
                <Field label="סטטוס">
                  <select style={inp} value={form.isActive !== false ? 'true' : 'false'} onChange={e => set('isActive', e.target.value === 'true')}>
                    <option value="true">פעיל</option>
                    <option value="false">מושבת</option>
                  </select>
                </Field>
              </div>

              {form.role !== 'admin' && (
                <div style={permBox}>
                  <div style={permTitle}>הרשאות</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={permTh}>משאב</th>
                        <th style={permTh}>צפייה</th>
                        <th style={permTh}>עריכה / צ׳אט</th>
                        <th style={permTh}>מחיקה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { id: 'systems',    label: 'מערכות',           actions: ['view','edit','delete'] },
                        { id: 'diagrams',   label: 'דיאגרמות',         actions: ['view','edit','delete'] },
                        { id: 'users',      label: 'משתמשים',          actions: ['view','edit','delete'] },
                        { id: 'navigation', label: 'ניווט',             actions: ['view','edit','delete'] },
                        { id: 'ai',         label: 'בינה מלאכותית',    actions: ['view','chat', null] },
                      ].map(({ id: res, label, actions }) => (
                        <tr key={res}>
                          <td style={permTd}>{label}</td>
                          {actions.map((action, idx) => (
                            <td key={idx} style={{ ...permTd, textAlign: 'center' }}>
                              {action ? (
                                <input
                                  type="checkbox"
                                  checked={form.permissions?.[res]?.[action] || false}
                                  onChange={e => setPerm(res, action, e.target.checked)}
                                />
                              ) : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 11, color: '#8a9ab0', marginTop: 6 }}>
                    מנהל מערכת מקבל את כל ההרשאות אוטומטית, כולל ניהול תצורת AI.
                  </div>
                </div>
              )}
            </div>
            <div style={dlgFooter}>
              <button style={btnGhost} onClick={() => setForm(null)}>ביטול</button>
              <button style={btnPrimary} onClick={handleSave} disabled={saving}>
                {saving ? 'שומר...' : 'שמור'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={overlay}>
          <div style={{ ...dialog, maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, color: '#c0392b', marginBottom: 12 }}>מחיקת משתמש</h3>
            <p style={{ fontSize: 14, color: '#1a2332', marginBottom: 20 }}>
              האם למחוק את <strong>{deleteConfirm.fullName}</strong>?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} onClick={() => setDeleteConfirm(null)}>ביטול</button>
              <button style={{ ...btnPrimary, background: '#e5381c' }} onClick={handleDelete}>מחק</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Field = ({ label, children }) => (
  <div>
    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#5a6a7e', marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);

const styles = {
  root: { display: 'flex', flexDirection: 'column', gap: 0, height: '100%' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', flexShrink: 0 },
  title: { fontSize: 16, fontWeight: 700, color: '#1a3a6b' },
  addBtn: { background: '#e8a020', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 15, fontWeight: 600, fontFamily: 'Rubik' },
  msg: { padding: '8px 12px', borderRadius: 6, fontSize: 15, border: '1px solid', marginBottom: 12 },
  center: { textAlign: 'center', padding: 40, color: '#5a6a7e' },
  tableWrap: { flex: 1, overflowY: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 12px', fontSize: 14, fontWeight: 700, color: '#5a6a7e', textAlign: 'right', borderBottom: '2px solid #d1dce8', background: '#f8fafc' },
  tr: { borderBottom: '1px solid #f0f4f8', transition: 'background 0.1s' },
  td: { padding: '10px 12px', fontSize: 15, color: '#1a2332', verticalAlign: 'middle', display: 'table-cell' },
  avatar: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, borderRadius: '50%', background: '#e8f0fe',
    color: '#1a3a6b', fontWeight: 700, fontSize: 14, marginLeft: 8,
  },
  roleBadge: { padding: '2px 9px', borderRadius: 10, fontSize: 13, fontWeight: 600 },
  actionBtn: { background: 'none', border: '1px solid #d1dce8', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 14, fontFamily: 'Rubik', color: '#1a3a6b' },
};

const overlay = { position: 'fixed', inset: 0, background: 'rgba(15,35,71,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(2px)' };
const dialog = { background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, boxShadow: '0 20px 60px rgba(15,35,71,0.3)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' };
const dlgHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #d1dce8' };
const dlgBody = { padding: '20px', overflowY: 'auto', flex: 1 };
const dlgFooter = { display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '14px 20px', borderTop: '1px solid #d1dce8' };
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: '#5a6a7e', fontSize: 16, padding: 4 };
const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 };
const inp = { width: '100%', border: '2px solid #d1dce8', borderRadius: 8, padding: '8px 10px', fontSize: 15, fontFamily: 'Rubik', direction: 'rtl', outline: 'none', color: '#1a2332' };
const permBox = { border: '1px solid #d1dce8', borderRadius: 8, padding: '12px', marginTop: 4 };
const permTitle = { fontSize: 13, fontWeight: 700, color: '#5a6a7e', marginBottom: 10, textTransform: 'uppercase' };
const permTh = { padding: '6px 10px', fontSize: 13, fontWeight: 700, color: '#5a6a7e', textAlign: 'center', borderBottom: '1px solid #e8eef5' };
const permTd = { padding: '7px 10px', fontSize: 15, borderBottom: '1px solid #f0f4f8' };
const btnPrimary = { background: '#1a3a6b', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', cursor: 'pointer', fontSize: 15, fontWeight: 600, fontFamily: 'Rubik' };
const btnGhost = { background: 'transparent', color: '#5a6a7e', border: '1px solid #d1dce8', borderRadius: 8, padding: '9px 16px', cursor: 'pointer', fontSize: 15, fontFamily: 'Rubik' };
