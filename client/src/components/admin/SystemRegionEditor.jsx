import React, { useState, useEffect, useRef, useCallback } from 'react';
import { systemsApi } from '../../services/api';

const STATUS_LABELS = { active: 'פעיל', disabled: 'מושבת' };
const STATUS_COLORS = { active: '#22a06b', disabled: '#8a9ab0' };

export default function SystemRegionEditor() {
  const [systems, setSystems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [drawMode, setDrawMode] = useState(false); // false | 'new' | systemId (redefine)
  const [drawing, setDrawing] = useState(null); // { x, y, w, h } in %
  const [dragStart, setDragStart] = useState(null);
  const [nameModal, setNameModal] = useState(null); // { rect } pending name input
  const [nameInput, setNameInput] = useState('');
  const [renameId, setRenameId] = useState(null);
  const [renameVal, setRenameVal] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { system, hasData }
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await systemsApi.getAllAdmin();
      setSystems(res.data);
    } catch {
      showMsg('error', 'שגיאה בטעינת מערכות');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  };

  // ── Coordinate helpers ──────────────────────────────────────
  const toPercent = (px, py) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(100, ((px - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((py - rect.top) / rect.height) * 100)),
    };
  };

  const normalizeRect = (start, end) => {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x);
    const h = Math.abs(end.y - start.y);
    return { x, y, w, h };
  };

  // ── Draw handlers ───────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (!drawMode) return;
    if (e.button !== 0) return;
    e.preventDefault();
    const pt = toPercent(e.clientX, e.clientY);
    setDragStart(pt);
    setDrawing({ x: pt.x, y: pt.y, w: 0, h: 0 });
  };

  const handleMouseMove = (e) => {
    if (!drawMode || !dragStart) return;
    const pt = toPercent(e.clientX, e.clientY);
    const rect = normalizeRect(dragStart, pt);
    setDrawing({ x: rect.x, y: rect.y, w: rect.w, h: rect.h });
  };

  const handleMouseUp = (e) => {
    if (!drawMode || !dragStart) return;
    const pt = toPercent(e.clientX, e.clientY);
    const rect = normalizeRect(dragStart, pt);
    setDragStart(null);

    if (rect.w < 1 || rect.h < 1) {
      setDrawing(null);
      return; // too small, ignore
    }

    if (drawMode === 'new') {
      setNameModal(rect);
      setNameInput('');
    } else {
      // Redefine existing system
      saveRegion(drawMode, rect);
    }
    setDrawMode(false);
    setDrawing(null);
    setShowDiagram(false);
  };

  // ── CRUD ─────────────────────────────────────────────────────
  const saveRegion = async (systemId, rect) => {
    setSaving(true);
    try {
      await systemsApi.update(systemId, {
        posX: parseFloat(rect.x.toFixed(2)),
        posY: parseFloat(rect.y.toFixed(2)),
        width: parseFloat(rect.w.toFixed(2)),
        height: parseFloat(rect.h.toFixed(2)),
      });
      await load();
      showMsg('success', 'האזור עודכן');
    } catch {
      showMsg('error', 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateConfirm = async () => {
    if (!nameInput.trim() || !nameModal) return;
    setSaving(true);
    try {
      await systemsApi.create({
        name: nameInput.trim(),
        posX: parseFloat(nameModal.x.toFixed(2)),
        posY: parseFloat(nameModal.y.toFixed(2)),
        width: parseFloat(nameModal.w.toFixed(2)),
        height: parseFloat(nameModal.h.toFixed(2)),
      });
      await load();
      setNameModal(null);
      setNameInput('');
      showMsg('success', 'מערכת נוצרה');
    } catch {
      showMsg('error', 'שגיאה ביצירה');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (system) => {
    const next = system.status === 'active' ? 'disabled' : 'active';
    try {
      await systemsApi.update(system.id, { status: next });
      setSystems(prev => prev.map(s => s.id === system.id ? { ...s, status: next } : s));
    } catch {
      showMsg('error', 'שגיאה בעדכון סטטוס');
    }
  };

  const handleDeleteClick = async (system) => {
    try {
      const res = await systemsApi.checkData(system.id);
      setDeleteConfirm({ system, hasData: res.data.hasData });
    } catch {
      showMsg('error', 'שגיאה בבדיקה');
    }
  };

  const handleDeleteConfirm = async (disable) => {
    const { system } = deleteConfirm;
    setDeleteConfirm(null);
    if (disable) {
      await systemsApi.update(system.id, { status: 'disabled' });
      setSystems(prev => prev.map(s => s.id === system.id ? { ...s, status: 'disabled' } : s));
      showMsg('success', 'המערכת הושבתה');
    } else {
      try {
        await systemsApi.delete(system.id);
        setSystems(prev => prev.filter(s => s.id !== system.id));
        if (selectedId === system.id) setSelectedId(null);
        showMsg('success', 'המערכת נמחקה');
      } catch {
        showMsg('error', 'שגיאה במחיקה');
      }
    }
  };

  const handleRenameConfirm = async () => {
    if (!renameVal.trim()) return;
    try {
      await systemsApi.update(renameId, { name: renameVal.trim() });
      setSystems(prev => prev.map(s => s.id === renameId ? { ...s, name: renameVal.trim() } : s));
      setRenameId(null);
    } catch {
      showMsg('error', 'שגיאה בשינוי שם');
    }
  };

  const cancelDraw = () => {
    setDrawMode(false);
    setDrawing(null);
    setDragStart(null);
    setShowDiagram(false);
  };

  const selectedSystem = systems.find(s => s.id === selectedId);

  return (
    <div style={styles.root}>
      {/* ── Sidebar ── */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarTitle}>מערכות ({systems.length})</span>
          <button
            style={{ ...styles.addBtn, ...(drawMode === 'new' ? styles.addBtnActive : {}) }}
            onClick={() => drawMode ? cancelDraw() : (setDrawMode('new'), setShowDiagram(true))}
          >
            {drawMode === 'new' ? '✕ בטל' : '+ הוסף'}
          </button>
        </div>

        {msg && (
          <div style={{ ...styles.msg, background: msg.type === 'success' ? '#f0faf5' : '#fff0ee', color: msg.type === 'success' ? '#22a06b' : '#c0392b', borderColor: msg.type === 'success' ? '#b7dfcc' : '#f8c4bb' }}>
            {msg.text}
          </div>
        )}

        <div style={styles.list}>
          {systems.map(system => (
            <div
              key={system.id}
              style={{
                ...styles.listItem,
                ...(selectedId === system.id ? styles.listItemSelected : {}),
                opacity: system.status === 'disabled' ? 0.6 : 1,
              }}
              onClick={() => setSelectedId(system.id === selectedId ? null : system.id)}
            >
              {renameId === system.id ? (
                <div style={{ display: 'flex', gap: 4, flex: 1 }} onClick={e => e.stopPropagation()}>
                  <input
                    autoFocus
                    style={styles.renameInput}
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameConfirm();
                      if (e.key === 'Escape') setRenameId(null);
                    }}
                  />
                  <button style={styles.iconBtn} onClick={handleRenameConfirm} title="שמור">✓</button>
                  <button style={styles.iconBtn} onClick={() => setRenameId(null)} title="בטל">✕</button>
                </div>
              ) : (
                <>
                  <div style={styles.itemInfo}>
                    <span style={{ ...styles.statusDot, background: STATUS_COLORS[system.status] }} />
                    <span style={styles.itemName}>{system.name}</span>
                    {system.hasData && (
                      <span style={styles.dataBadge} title="יש נתונים מקושרים">●</span>
                    )}
                  </div>
                  <div style={styles.itemActions} onClick={e => e.stopPropagation()}>
                    {/* Rename */}
                    <button style={styles.iconBtn} title="שנה שם" onClick={() => { setRenameId(system.id); setRenameVal(system.name); }}>
                      <PencilIcon />
                    </button>
                    {/* Redefine region */}
                    <button
                      style={{ ...styles.iconBtn, ...(drawMode === system.id ? styles.iconBtnActive : {}) }}
                      title="הגדר אזור מחדש"
                      onClick={() => drawMode === system.id ? cancelDraw() : (setDrawMode(system.id), setShowDiagram(true))}
                    >
                      <RegionIcon />
                    </button>
                    {/* Toggle status */}
                    <button
                      style={{ ...styles.iconBtn, color: system.status === 'active' ? '#22a06b' : '#8a9ab0' }}
                      title={system.status === 'active' ? 'השבת' : 'הפעל'}
                      onClick={() => handleToggleStatus(system)}
                    >
                      {system.status === 'active' ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                    {/* Delete */}
                    <button style={{ ...styles.iconBtn, color: '#e5381c' }} title="מחק" onClick={() => handleDeleteClick(system)}>
                      <TrashIcon />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {systems.length === 0 && (
            <div style={styles.emptyList}>
              אין מערכות מוגדרות<br />
              <small>לחץ "הוסף" וסמן אזור על הדיאגרמה</small>
            </div>
          )}
        </div>
      </div>

      {/* ── Diagram canvas — only visible in draw mode ── */}
      {!showDiagram && (
        <div style={styles.canvasPlaceholder}>
          <div style={styles.placeholderIcon}>🗺️</div>
          <div style={styles.placeholderText}>לחץ על <RegionIcon /> בשורת מערכת כדי להגדיר אזור, או על <strong>+ הוסף</strong> ליצירת חדש</div>
        </div>
      )}
      <div style={{ ...styles.canvas, display: showDiagram ? 'flex' : 'none' }}>
        {drawMode && (
          <div style={styles.drawBanner}>
            {drawMode === 'new' ? 'סמן אזור חדש על הדיאגרמה' : `הגדר מחדש את אזור "${systems.find(s => s.id === drawMode)?.name}"`}
            <button style={styles.cancelBtn} onClick={cancelDraw}>בטל</button>
          </div>
        )}

        {/* imgWrapper scrolls; inner imageRef div is exactly the image size */}
        <div style={{ ...styles.imgWrapper, cursor: drawMode ? 'crosshair' : 'default' }}>
          <div
            ref={containerRef}
            style={styles.imageRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { if (dragStart) setDragStart(null); setDrawing(null); }}
          >
          <img
            ref={imgRef}
            src="/diagram.png"
            alt="דיאגרמה"
            style={styles.img}
            draggable={false}
          />

          {/* Existing regions */}
          {systems.map(system => {
            if (!system.posX && !system.posY && !system.width && !system.height) return null;
            const isSelected = selectedId === system.id;
            const isRedefining = drawMode === system.id;
            if (isRedefining) return null; // hide while redefining

            return (
              <div
                key={system.id}
                onClick={(e) => { if (!drawMode) { e.stopPropagation(); setSelectedId(system.id === selectedId ? null : system.id); } }}
                style={{
                  position: 'absolute',
                  left: `${system.posX}%`,
                  top: `${system.posY}%`,
                  width: `${system.width}%`,
                  height: `${system.height}%`,
                  border: isSelected
                    ? '2px solid #e8a020'
                    : system.status === 'disabled'
                    ? '2px dashed #8a9ab0'
                    : '2px solid #2554a3',
                  background: isSelected
                    ? 'rgba(232,160,32,0.15)'
                    : system.status === 'disabled'
                    ? 'rgba(138,154,176,0.08)'
                    : 'rgba(37,84,163,0.07)',
                  borderRadius: 6,
                  cursor: drawMode ? 'crosshair' : 'pointer',
                  boxShadow: isSelected ? '0 0 0 3px rgba(232,160,32,0.3)' : 'none',
                  transition: 'all 0.15s',
                  zIndex: isSelected ? 10 : 5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-end',
                  padding: 4,
                }}
              >
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: isSelected ? '#e8a020' : system.status === 'disabled' ? '#8a9ab0' : '#2554a3',
                  background: 'rgba(255,255,255,0.92)',
                  padding: '1px 6px', borderRadius: 8,
                  border: `1px solid ${isSelected ? '#e8a020' : system.status === 'disabled' ? '#8a9ab0' : '#2554a3'}`,
                  whiteSpace: 'nowrap', maxWidth: '95%',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  pointerEvents: 'none',
                }}>
                  {system.name}
                </span>
              </div>
            );
          })}

          {/* Live draw preview */}
          {drawing && drawing.w > 0.5 && drawing.h > 0.5 && (
            <div style={{
              position: 'absolute',
              left: `${drawing.x}%`, top: `${drawing.y}%`,
              width: `${drawing.w}%`, height: `${drawing.h}%`,
              border: '2px dashed #e8a020',
              background: 'rgba(232,160,32,0.12)',
              borderRadius: 6, pointerEvents: 'none', zIndex: 20,
            }} />
          )}
          </div> {/* end imageRef */}
        </div>

        {/* Legend */}
        <div style={styles.legend}>
          <LegendItem color="#2554a3" label="פעיל" />
          <LegendItem color="#8a9ab0" label="מושבת" dashed />
          <LegendItem color="#e8a020" label="נבחר" />
        </div>
      </div>

      {/* ── Name Modal ── */}
      {nameModal && (
        <div style={overlay}>
          <div style={dialog} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, color: '#1a3a6b', marginBottom: 16 }}>שם המערכת</h3>
            <input
              autoFocus
              style={dialogInput}
              placeholder="הזן שם מערכת..."
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateConfirm(); if (e.key === 'Escape') setNameModal(null); }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button style={btnGhost} onClick={() => setNameModal(null)}>ביטול</button>
              <button style={btnAccent} disabled={!nameInput.trim() || saving} onClick={handleCreateConfirm}>
                {saving ? 'שומר...' : 'צור מערכת'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteConfirm && (
        <div style={overlay}>
          <div style={{ ...dialog, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, color: '#c0392b', marginBottom: 12 }}>מחיקת מערכת</h3>
            <p style={{ fontSize: 14, color: '#1a2332', marginBottom: 8 }}>
              האם למחוק את <strong>{deleteConfirm.system.name}</strong>?
            </p>
            {deleteConfirm.hasData && (
              <div style={{ background: '#fff8e8', border: '1px solid #f4d5a0', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#8a5a00' }}>
                ⚠️ למערכת זו מקושרים נתונים (טפסים / דיאגרמות).<br />
                ניתן להשבית במקום למחוק — הנתונים יישמרו.
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {deleteConfirm.hasData && (
                <button style={{ ...btnAccent, background: '#5a6a7e' }} onClick={() => handleDeleteConfirm(true)}>
                  השבת (שמור נתונים)
                </button>
              )}
              <button style={{ ...btnAccent, background: '#e5381c' }} onClick={() => handleDeleteConfirm(false)}>
                מחק לצמיתות
              </button>
              <button style={btnGhost} onClick={() => setDeleteConfirm(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label, dashed }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{
        width: 22, height: 14, border: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
        borderRadius: 3, background: `${color}18`,
      }} />
      <span style={{ fontSize: 13, color: '#5a6a7e' }}>{label}</span>
    </div>
  );
}

// Icons
const PencilIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z"/></svg>;
const RegionIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h18"/></svg>;
const TrashIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>;
const EyeIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeOffIcon = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;

const styles = {
  root: { display: 'flex', height: '100%', gap: 0, overflow: 'hidden' },
  sidebar: {
    width: 300, flexShrink: 0, borderLeft: '1px solid #d1dce8',
    background: '#f8fafc', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  sidebarHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 18px', borderBottom: '1px solid #d1dce8',
  },
  sidebarTitle: { fontSize: 16, fontWeight: 700, color: '#1a3a6b' },
  addBtn: {
    background: '#e8a020', color: '#fff', border: 'none', borderRadius: 7,
    padding: '7px 15px', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'Rubik',
  },
  addBtnActive: { background: '#c0392b' },
  msg: { margin: '8px', padding: '8px 12px', borderRadius: 6, fontSize: 14, border: '1px solid' },
  list: { flex: 1, overflowY: 'auto', padding: '8px' },
  listItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 5,
    border: '1px solid transparent', transition: 'all 0.15s', background: '#fff',
    boxShadow: '0 1px 3px rgba(26,58,107,0.06)',
  },
  listItemSelected: { border: '1px solid #e8a020', background: '#fff8ee' },
  itemInfo: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
  statusDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  itemName: { fontSize: 15, fontWeight: 500, color: '#1a2332', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  dataBadge: { fontSize: 10, color: '#e8a020', flexShrink: 0 },
  itemActions: { display: 'flex', gap: 3, flexShrink: 0 },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: '#5a6a7e',
    padding: '4px', borderRadius: 4, display: 'flex', transition: 'color 0.15s, background 0.15s',
  },
  iconBtnActive: { background: '#e8a020', color: '#fff' },
  renameInput: {
    flex: 1, border: '1px solid #d1dce8', borderRadius: 6, padding: '5px 9px',
    fontSize: 14, fontFamily: 'Rubik', direction: 'rtl', outline: 'none',
  },
  emptyList: {
    textAlign: 'center', color: '#8a9ab0', fontSize: 15, padding: '28px 10px', lineHeight: 2,
  },
  canvasPlaceholder: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 16, color: '#8a9ab0', background: '#f0f4f8',
  },
  placeholderIcon: { fontSize: 52, opacity: 0.4 },
  placeholderText: { fontSize: 15, color: '#5a6a7e', textAlign: 'center', maxWidth: 340, lineHeight: 1.8 },
  canvas: { flex: 1, flexDirection: 'column', overflow: 'hidden', position: 'relative' },
  drawBanner: {
    background: '#fff8e8', borderBottom: '1px solid #f4d5a0', color: '#8a5a00',
    padding: '10px 18px', fontSize: 15, fontWeight: 600, display: 'flex',
    alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
    zIndex: 10,
  },
  cancelBtn: {
    background: 'none', border: '1px solid #8a5a00', color: '#8a5a00',
    borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 14, fontFamily: 'Rubik',
  },
  imgWrapper: {
    flex: 1, overflow: 'auto', userSelect: 'none',
    background: '#e8eef5', padding: 16,
  },
  // This inner div exactly matches image dimensions — the coordinate reference
  imageRef: {
    position: 'relative', width: '100%', maxWidth: 1400,
    margin: '0 auto', display: 'block',
  },
  img: { display: 'block', width: '100%', height: 'auto', pointerEvents: 'none', borderRadius: 4 },
  legend: {
    display: 'flex', gap: 18, padding: '10px 18px', background: '#f8fafc',
    borderTop: '1px solid #d1dce8', flexShrink: 0,
  },
};

const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(15,35,71,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 2000, backdropFilter: 'blur(2px)',
};

const dialog = {
  background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 380,
  boxShadow: '0 20px 60px rgba(15,35,71,0.3)',
};

const dialogInput = {
  width: '100%', border: '2px solid #d1dce8', borderRadius: 8,
  padding: '11px 14px', fontSize: 16, fontFamily: 'Rubik', direction: 'rtl',
  outline: 'none', color: '#1a2332',
};

const btnAccent = {
  background: '#e8a020', color: '#fff', border: 'none', borderRadius: 8,
  padding: '11px 22px', cursor: 'pointer', fontSize: 15, fontWeight: 600,
  fontFamily: 'Rubik', flex: 1,
};

const btnGhost = {
  background: 'transparent', color: '#5a6a7e', border: '1px solid #d1dce8',
  borderRadius: 8, padding: '11px 18px', cursor: 'pointer', fontSize: 15,
  fontFamily: 'Rubik',
};
