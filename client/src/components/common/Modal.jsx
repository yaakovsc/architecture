import React, { useEffect, useState } from 'react';

export default function Modal({ title, onClose, children, maxWidth = 700, noPadding = false, resizable = false, initialWidth, initialHeight }) {
  const [size, setSize] = useState(() => ({
    width: initialWidth || maxWidth,
    height: initialHeight || Math.round(window.innerHeight * 0.88),
  }));

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.width;
    const startH = size.height;
    const onMove = (ev) => {
      setSize({
        width: Math.max(400, Math.min(startW + ev.clientX - startX, window.innerWidth - 32)),
        height: Math.max(300, Math.min(startH + ev.clientY - startY, window.innerHeight - 32)),
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const modalStyle = resizable
    ? { ...styles.modal, width: size.width, height: size.height, maxWidth: 'none', maxHeight: 'none', position: 'relative' }
    : { ...styles.modal, maxWidth };

  return (
    <div style={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="סגור">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div style={noPadding ? styles.noPadding : styles.body}>{children}</div>
        {resizable && (
          <div style={styles.resizeHandle} onMouseDown={handleResizeStart} title="גרור לשינוי גודל" />
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(15,35,71,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16, animation: 'fadeIn 0.2s ease',
    backdropFilter: 'blur(3px)',
  },
  modal: {
    background: '#fff', borderRadius: 12, width: '100%',
    maxHeight: '90vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(15,35,71,0.35)',
    animation: 'slideUp 0.25s ease forwards',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid #d1dce8',
    background: '#f8fafc', flexShrink: 0,
  },
  title: { fontSize: 17, fontWeight: 700, color: '#1a3a6b' },
  closeBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#5a6a7e', padding: 4, borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s, color 0.15s',
  },
  body: { padding: '20px', overflowY: 'auto', flex: 1 },
  noPadding: { display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 },
  resizeHandle: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, cursor: 'nwse-resize',
    borderBottom: '3px solid #c0ccd8', borderRight: '3px solid #c0ccd8',
    borderBottomRightRadius: 12, zIndex: 10,
  },
};
