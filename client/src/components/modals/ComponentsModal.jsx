import React, { useState, useEffect, useRef } from 'react';
import Modal from '../common/Modal';
import { diagramsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import DrawioEditorModal from './DrawioEditorModal';

// Fetches file via authenticated request, exposes blob URL via onReady callback
function AuthImage({ id, style, alt, isPdf = false, onReady, onLoad }) {
  const [src, setSrc] = useState(null);
  const prevRef = useRef(null);

  useEffect(() => {
    if (!id) return;
    let revoked = false;
    api.get(`/diagrams/${id}/file`, { responseType: 'blob' })
      .then(res => {
        if (revoked) return;
        const url = URL.createObjectURL(res.data);
        if (prevRef.current) URL.revokeObjectURL(prevRef.current);
        prevRef.current = url;
        setSrc(url);
        onReady?.(url, res.data.type);
      })
      .catch(() => setSrc(null));
    return () => {
      revoked = true;
      if (prevRef.current) URL.revokeObjectURL(prevRef.current);
      onReady?.(null, null);
    };
  }, [id]);

  if (!src) return (
    <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 28, height: 28, border: '3px solid #d1dce8', borderTopColor: '#1a3a6b', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  );
  if (isPdf) return <iframe src={src} style={style} title={alt} />;
  return <img src={src} alt={alt} style={style} onLoad={onLoad} />;
}

export default function ComponentsModal({ system, type = 'components', onClose }) {
  const { can } = useAuth();
  const canEdit = can('diagrams', 'edit');
  const canDelete = can('diagrams', 'delete');
  const [diagrams, setDiagrams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [msg, setMsg] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [blobMime, setBlobMime] = useState(null);
  const [vp, setVp] = useState({ zoom: 1, panX: 0, panY: 0 });
  const vpRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const imgNaturalRef = useRef(null);
  const [imgReady, setImgReady] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef(null);
  const fileRef = useRef();
  const viewerRef = useRef();
  const [drawioOpen, setDrawioOpen] = useState(false);
  const [drawioXml, setDrawioXml] = useState(null);
  const [showDrawioPicker, setShowDrawioPicker] = useState(false);
  const drawioFileRef = useRef();

  useEffect(() => {
    imgNaturalRef.current = null;
    setImgReady(false);
    const reset = { zoom: 1, panX: 0, panY: 0 };
    vpRef.current = reset;
    setVp(reset);
  }, [selected?.id]);

  const fitToViewer = (w, h) => {
    const el = viewerRef.current;
    if (w != null) imgNaturalRef.current = { w, h };
    const nat = imgNaturalRef.current;
    if (!el || !nat) return;
    const { width: vw, height: vh } = el.getBoundingClientRect();
    // Prefer 100% zoom if the image fits; otherwise scale to fit
    let zoom, panX, panY;
    if (nat.w <= vw && nat.h <= vh) {
      zoom = 1;
      panX = (vw - nat.w) / 2;
      panY = (vh - nat.h) / 2;
    } else {
      zoom = Math.min(vw / nat.w, vh / nat.h) * 0.95;
      panX = (vw - nat.w * zoom) / 2;
      panY = (vh - nat.h * zoom) / 2;
    }
    const next = { zoom, panX, panY };
    vpRef.current = next;
    setVp(next);
    setImgReady(true);
  };

  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const delta = e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.001);
      const { zoom, panX, panY } = vpRef.current;
      const newZoom = Math.min(8, Math.max(0.1, zoom * (1 - delta)));
      const ratio = newZoom / zoom;
      const next = {
        zoom: newZoom,
        panX: mx - (mx - panX) * ratio,
        panY: my - (my - panY) * ratio,
      };
      vpRef.current = next;
      setVp(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handlePanStart = (e) => {
    if (e.target.closest('button')) return;
    e.preventDefault();
    setIsPanning(true);
    panStart.current = { x: e.clientX - vpRef.current.panX, y: e.clientY - vpRef.current.panY };
  };
  const handlePanMove = (e) => {
    if (!isPanning || !panStart.current) return;
    const next = { ...vpRef.current, panX: e.clientX - panStart.current.x, panY: e.clientY - panStart.current.y };
    vpRef.current = next;
    setVp(next);
  };
  const handlePanEnd = () => { setIsPanning(false); panStart.current = null; };

  const handlePrint = () => {
    if (!blobUrl) return;
    const win = window.open('', '_blank');
    const isPdf = blobMime === 'application/pdf';
    win.document.write(`<!DOCTYPE html><html><head><title>${selected?.originalName || 'diagram'}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box} body{display:flex;justify-content:center;align-items:center;min-height:100vh}
      img{max-width:100%;max-height:100vh;object-fit:contain} iframe{width:100vw;height:100vh;border:none}
      @media print{body{margin:0}}</style></head><body>`);
    if (isPdf) {
      win.document.write(`<iframe src="${blobUrl}"></iframe>`);
    } else {
      win.document.write(`<img src="${blobUrl}" onload="window.print()" />`);
    }
    win.document.write('</body></html>');
    win.document.close();
    if (isPdf) setTimeout(() => win.print(), 800);
  };

  const handleSavePdf = () => {
    if (!blobUrl) return;
    const isPdf = blobMime === 'application/pdf';
    if (isPdf) {
      // Direct download for actual PDFs
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = selected?.originalName || 'diagram.pdf';
      a.click();
    } else {
      // For images: open print dialog — user can Save as PDF
      const win = window.open('', '_blank');
      win.document.write(`<!DOCTYPE html><html><head><title>${selected?.originalName || 'diagram'}</title>
        <style>*{margin:0;padding:0} body{display:flex;justify-content:center;align-items:flex-start}
        img{max-width:100%;height:auto} @media print{body{margin:0}}</style>
        <script>window.onload=()=>{window.print()}<\/script></head>
        <body><img src="${blobUrl}" /></body></html>`);
      win.document.close();
    }
  };

  // Close draw.io picker when clicking outside it
  useEffect(() => {
    if (!showDrawioPicker) return;
    const close = () => setShowDrawioPicker(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showDrawioPicker]);

  const isDrawioFile = (d) => d && (
    d.mimetype === 'text/xml' ||
    d.mimetype === 'application/xml' ||
    d.mimetype === 'application/vnd.jgraph.mxfile' ||
    (d.originalName || d.filename || '').toLowerCase().endsWith('.drawio')
  );

  const handleDrawioFileOpen = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setDrawioXml(ev.target.result);
      setDrawioOpen(true);
    };
    reader.readAsText(file);
    e.target.value = '';
    setShowDrawioPicker(false);
  };

  const handleOpenExistingDrawio = async (diagram) => {
    try {
      const res = await api.get(`/diagrams/${diagram.id}/file`, { responseType: 'text' });
      setDrawioXml(res.data);
      setDrawioOpen(true);
    } catch {
      setMsg({ type: 'error', text: 'שגיאה בטעינת קובץ draw.io' });
    }
  };

  const handleDrawioSave = async (file) => {
    setDrawioOpen(false);
    setDrawioXml(null);
    setUploading(true);
    setMsg(null);
    try {
      await diagramsApi.upload(system.key, type, file);
      await load();
      setMsg({ type: 'success', text: 'הדיאגרמה נשמרה בהצלחה' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'שגיאה בשמירה' });
    } finally {
      setUploading(false);
    }
  };

  const label = type === 'components' ? 'רכיבים' : 'אינטגרציה';

  useEffect(() => { load(); }, [system.key, type]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await diagramsApi.get(system.key, type);
      setDiagrams(res.data);
      setSelected(res.data[0] || null);
    } catch {
      setDiagrams([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);
    try {
      await diagramsApi.upload(system.key, type, file);
      await load();
      setMsg({ type: 'success', text: 'הקובץ הועלה בהצלחה' });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'שגיאה בהעלאה' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm('האם למחוק את הדיאגרמה?')) return;
    try {
      await diagramsApi.delete(selected.id);
      const updated = diagrams.filter(d => d.id !== selected.id);
      setDiagrams(updated);
      setSelected(updated[0] || null);
      setMsg({ type: 'success', text: 'נמחק בהצלחה' });
    } catch {
      setMsg({ type: 'error', text: 'שגיאה במחיקה' });
    }
  };

  return (
    <>
    <Modal
      title={`${label}: ${system.name}`}
      onClose={onClose}
      noPadding
      resizable
      initialWidth={Math.min(1100, window.innerWidth - 48)}
      initialHeight={Math.min(780, window.innerHeight - 48)}
    >
      {/* ── Top bar: diagrams list + actions ── */}
      <div style={styles.topBar}>
        {/* Diagrams tabs */}
        <div style={styles.tabsRow}>
          {diagrams.length === 0 && !loading && (
            <span style={styles.noFiles}>אין דיאגרמות</span>
          )}
          {diagrams.map(d => (
            <button
              key={d.id}
              style={{ ...styles.tabBtn, ...(selected?.id === d.id ? styles.tabActive : {}) }}
              onClick={() => setSelected(d)}
              title={d.originalName || d.filename}
            >
              <FileIcon mime={d.mimetype} name={d.originalName || d.filename} />
              <span style={styles.tabLabel}>{d.originalName || d.filename}</span>
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div style={styles.actions}>
          {/* Print & PDF — only when a diagram is loaded */}
          {blobUrl && (
            <>
              <button style={styles.iconBtn} onClick={handlePrint} title="הדפס">
                <PrintIcon /> הדפס
              </button>
              <button style={styles.iconBtn} onClick={handleSavePdf} title="שמור כ-PDF">
                <PdfIcon /> שמור כ-PDF
              </button>
            </>
          )}
          {canDelete && selected && (
            <button style={styles.deleteBtn} onClick={handleDelete} title="מחק דיאגרמה נבחרת">
              <TrashIcon /> מחק
            </button>
          )}
          {canEdit && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf,.svg"
                style={{ display: 'none' }}
                onChange={handleUpload}
              />
              <button style={styles.uploadBtn} onClick={() => fileRef.current.click()} disabled={uploading}>
                {uploading ? 'מעלה...' : '+ העלה דיאגרמה'}
              </button>
              {/* draw.io button + picker */}
              <div style={{ position: 'relative' }} onMouseDown={e => e.stopPropagation()}>
                <button
                  style={styles.drawioBtn}
                  onClick={() => setShowDrawioPicker(p => !p)}
                >
                  <DrawioIcon /> draw.io
                </button>
                {showDrawioPicker && (
                  <div style={styles.drawioPicker}>
                    <button
                      style={styles.drawioPickerItem}
                      onClick={() => { setDrawioXml(''); setDrawioOpen(true); setShowDrawioPicker(false); }}
                    >
                      ✦ דיאגרמה חדשה
                    </button>
                    <button
                      style={styles.drawioPickerItem}
                      onClick={() => drawioFileRef.current.click()}
                    >
                      📂 פתח קובץ קיים...
                    </button>
                  </div>
                )}
                <input
                  ref={drawioFileRef}
                  type="file"
                  accept=".drawio,.xml"
                  style={{ display: 'none' }}
                  onChange={handleDrawioFileOpen}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status message */}
      {msg && (
        <div style={{
          ...styles.msgBox,
          background: msg.type === 'success' ? '#f0faf5' : '#fff0ee',
          color: msg.type === 'success' ? '#22a06b' : '#c0392b',
          borderColor: msg.type === 'success' ? '#b7dfcc' : '#f8c4bb',
        }}>
          {msg.text}
        </div>
      )}

      {/* ── Diagram viewer ── */}
      <div
        ref={viewerRef}
        style={{ ...styles.viewer, cursor: isPanning ? 'grabbing' : 'grab' }}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        onDoubleClick={() => fitToViewer()}
      >
        {loading ? (
          <div style={styles.center}>
            <div style={styles.spinner} />
          </div>
        ) : !selected ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c0ccd8" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M3 9h18M9 21V9"/>
              </svg>
            </div>
            <p style={styles.emptyText}>אין דיאגרמה עבור {label} מערכת זו</p>
            {canEdit && (
              <button style={styles.uploadBtn} onClick={() => fileRef.current?.click()}>
                העלה דיאגרמה ראשונה
              </button>
            )}
          </div>
        ) : isDrawioFile(selected) ? (
          <div style={styles.drawioViewer}>
            <div style={styles.drawioViewerIcon}><DrawioIcon size={40} /></div>
            <div style={styles.drawioViewerName}>{selected.originalName || selected.filename}</div>
            <div style={styles.drawioViewerSub}>קובץ draw.io</div>
            {canEdit ? (
              <button style={styles.uploadBtn} onClick={() => handleOpenExistingDrawio(selected)}>
                ✎ ערוך ב-draw.io
              </button>
            ) : (
              <span style={{ color: '#8a9ab0', fontSize: 14 }}>אין הרשאת עריכה</span>
            )}
          </div>
        ) : selected.mimetype === 'application/pdf' ? (
          <AuthImage
            key={selected.id}
            id={selected.id}
            alt={selected.originalName}
            style={styles.iframe}
            isPdf
            onReady={(url, mime) => { setBlobUrl(url); setBlobMime(mime); }}
          />
        ) : (
          <div style={{
            position: 'absolute', top: 0, left: 0,
            transform: `translate(${vp.panX}px, ${vp.panY}px) scale(${vp.zoom})`,
            transformOrigin: '0 0',
            willChange: 'transform',
            visibility: imgReady ? 'visible' : 'hidden',
          }}>
            <AuthImage
              key={selected.id}
              id={selected.id}
              alt={selected.originalName}
              style={styles.diagramImg}
              onReady={(url, mime) => { setBlobUrl(url); setBlobMime(mime); }}
              onLoad={(e) => fitToViewer(e.target.naturalWidth, e.target.naturalHeight)}
            />
          </div>
        )}
        {/* Zoom indicator */}
        {selected && !isDrawioFile(selected) && selected.mimetype !== 'application/pdf' && (
          <div style={styles.zoomBadge}>
            {Math.round(vp.zoom * 100)}%
            <button style={styles.zoomReset} onClick={() => fitToViewer()}>⊞</button>
          </div>
        )}
      </div>
    </Modal>
    {drawioOpen && (
      <DrawioEditorModal
        xml={drawioXml}
        onSave={handleDrawioSave}
        onClose={() => { setDrawioOpen(false); setDrawioXml(null); }}
      />
    )}
    </>
  );
}

function DrawioIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1" y="1" width="8" height="8" rx="1.5"/>
      <rect x="15" y="1" width="8" height="8" rx="1.5"/>
      <rect x="8" y="15" width="8" height="8" rx="1.5"/>
      <path d="M9 5h6M5 9v2.5a3.5 3.5 0 003.5 3.5h7A3.5 3.5 0 0019 11.5V9"/>
    </svg>
  );
}

function FileIcon({ mime, name }) {
  const isPdf = mime === 'application/pdf';
  const isDrawio = mime === 'text/xml' || mime === 'application/xml' || mime === 'application/vnd.jgraph.mxfile'
    || (name || '').toLowerCase().endsWith('.drawio');
  if (isDrawio) return <DrawioIcon />;
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
      {isPdf
        ? <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></>
        : <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>
      }
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 6 2 18 2 18 9"/>
      <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
      <rect x="6" y="14" width="12" height="8"/>
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M9 13h1a1 1 0 010 2H9v-2zm0 0v4"/>
    </svg>
  );
}

const styles = {
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', borderBottom: '2px solid #d1dce8',
    background: '#f8fafc', gap: 12, flexWrap: 'wrap', flexShrink: 0,
  },
  tabsRow: {
    display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1, alignItems: 'center', minWidth: 0,
  },
  noFiles: { fontSize: 14, color: '#8a9ab0', fontStyle: 'italic' },
  tabBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 10px', borderRadius: 6, border: '1px solid #d1dce8',
    background: '#fff', cursor: 'pointer', fontSize: 14, fontFamily: 'Rubik',
    color: '#5a6a7e', maxWidth: 180, transition: 'all 0.15s',
  },
  tabLabel: {
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140,
  },
  tabActive: { background: '#1a3a6b', color: '#fff', borderColor: '#1a3a6b' },
  actions: { display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 },
  uploadBtn: {
    background: '#e8a020', color: '#fff', border: 'none', borderRadius: 7,
    padding: '7px 14px', cursor: 'pointer', fontSize: 15, fontWeight: 600,
    fontFamily: 'Rubik', whiteSpace: 'nowrap',
  },
  iconBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'transparent', color: '#1a3a6b', border: '1px solid #d1dce8',
    borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 14,
    fontFamily: 'Rubik', whiteSpace: 'nowrap', transition: 'all 0.15s',
  },
  deleteBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    background: 'transparent', color: '#e5381c', border: '1px solid #e5381c',
    borderRadius: 7, padding: '6px 12px', cursor: 'pointer', fontSize: 14,
    fontFamily: 'Rubik', whiteSpace: 'nowrap',
  },
  msgBox: {
    margin: '6px 16px 0', padding: '7px 12px', borderRadius: 6,
    fontSize: 15, border: '1px solid', flexShrink: 0,
  },
  viewer: {
    flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', minHeight: 400, position: 'relative',
  },
  center: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  spinner: {
    width: 32, height: 32, border: '3px solid #d1dce8',
    borderTopColor: '#1a3a6b', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  empty: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 12, padding: 40, color: '#5a6a7e',
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: '50%', background: '#f0f4f8',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontSize: 16, color: '#5a6a7e' },
  diagramImg: {
    display: 'block', maxWidth: 'none',
  },
  iframe: { width: '100%', flex: 1, border: 'none', minHeight: 400 },
  zoomBadge: {
    position: 'absolute', bottom: 12, left: 12,
    background: 'rgba(26,58,107,0.85)', color: '#fff',
    borderRadius: 8, padding: '4px 10px', fontSize: 14, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 8,
    backdropFilter: 'blur(4px)', pointerEvents: 'auto',
  },
  zoomReset: {
    background: 'transparent', border: 'none', color: '#fff',
    cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1,
  },
  drawioBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#fff', color: '#1a3a6b',
    border: '1.5px solid #1a3a6b', borderRadius: 7,
    padding: '6px 13px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
    fontFamily: 'Rubik', whiteSpace: 'nowrap', transition: 'all 0.15s',
  },
  drawioPicker: {
    position: 'absolute', top: 'calc(100% + 6px)', left: 0,
    background: '#fff', border: '1px solid #d1dce8', borderRadius: 8,
    boxShadow: '0 8px 24px rgba(26,58,107,0.15)',
    display: 'flex', flexDirection: 'column',
    minWidth: 160, zIndex: 100, overflow: 'hidden',
  },
  drawioPickerItem: {
    padding: '10px 14px', background: 'transparent', border: 'none',
    borderBottom: '1px solid #f0f4f8', cursor: 'pointer',
    fontSize: 14, fontFamily: 'Rubik', color: '#1a2332',
    textAlign: 'right', transition: 'background 0.12s',
  },
  drawioViewer: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: 12, padding: 40,
  },
  drawioViewerIcon: {
    width: 72, height: 72, borderRadius: '50%',
    background: '#eef3fb', display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#1a3a6b',
  },
  drawioViewerName: { fontSize: 15, fontWeight: 600, color: '#1a2332', textAlign: 'center' },
  drawioViewerSub: { fontSize: 13, color: '#8a9ab0', fontFamily: 'monospace' },
};
