import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { systemsApi, navApi } from '../services/api';
import ComponentsModal from '../components/modals/ComponentsModal';
import DynamicQuestionnaireModal from '../components/modals/DynamicQuestionnaireModal';
import AIChatPanel from '../components/ai/AIChatPanel';

export default function DiagramPage() {
  const { user, logout, isAdmin, can } = useAuth();
  const navigate = useNavigate();
  const [systems, setSystems]       = useState([]);
  const [navButtons, setNavButtons] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [activeModal, setActiveModal] = useState(null);
  const [aiPanel, setAiPanel]       = useState(null);
  const [btnPos, setBtnPos]         = useState({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded]   = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // zoom + pan — single state object for atomic updates
  const [vp, setVp] = useState({ zoom: 1, panX: 0, panY: 0 });

  const viewportRef = useRef(null); // the fixed-size viewport div
  const diagramRef  = useRef(null); // the transformed diagram div
  const panRef      = useRef({ active: false, sx: 0, sy: 0, px: 0, py: 0, moved: false });

  useEffect(() => {
    systemsApi.getAll().then(r => setSystems(r.data)).catch(() => {});
    navApi.getConfig().then(r => setNavButtons(r.data)).catch(() => {});
  }, []);

  // Non-passive wheel listener so we can preventDefault (prevents page scroll)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = Math.pow(0.999, e.deltaY);
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setVp(prev => {
        const newZoom = Math.min(8, Math.max(0.05, prev.zoom * factor));
        const ratio = newZoom / prev.zoom;
        return {
          zoom: newZoom,
          panX: mx - (mx - prev.panX) * ratio,
          panY: my - (my - prev.panY) * ratio,
        };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Zoom to fit the image inside the viewport with padding
  const zoomToFit = useCallback(() => {
    const vpEl  = viewportRef.current;
    const imgEl = diagramRef.current?.querySelector('img');
    if (!vpEl || !imgEl || !imgEl.naturalWidth) return;
    const iw = imgEl.naturalWidth;
    const ih = imgEl.naturalHeight;
    const vw = vpEl.clientWidth;
    const vh = vpEl.clientHeight;
    const pad = 40;
    const z = Math.min((vw - pad * 2) / iw, (vh - pad * 2) / ih, 1);
    setVp({ zoom: z, panX: (vw - iw * z) / 2, panY: (vh - ih * z) / 2 });
  }, []);

  const handleImgLoad = useCallback(() => {
    setImgLoaded(true);
    // slight delay so the viewport has its final size after layout
    requestAnimationFrame(zoomToFit);
  }, [zoomToFit]);

  const stepZoom = useCallback((factor) => {
    const vpEl = viewportRef.current;
    if (!vpEl) return;
    const cx = vpEl.clientWidth  / 2;
    const cy = vpEl.clientHeight / 2;
    setVp(prev => {
      const newZoom = Math.min(8, Math.max(0.05, prev.zoom * factor));
      const ratio = newZoom / prev.zoom;
      return { zoom: newZoom, panX: cx - (cx - prev.panX) * ratio, panY: cy - (cy - prev.panY) * ratio };
    });
  }, []);

  // ── Pan handlers ──────────────────────────────────────────────────────────
  const handleMouseDown = (e) => {
    if (e.button === 2) return;
    panRef.current = { active: true, sx: e.clientX, sy: e.clientY, px: vp.panX, py: vp.panY, moved: false };
  };

  const handleMouseMove = (e) => {
    if (!panRef.current.active) return;
    const dx = e.clientX - panRef.current.sx;
    const dy = e.clientY - panRef.current.sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      if (!panRef.current.moved) { panRef.current.moved = true; setIsDragging(true); }
      setVp(prev => ({ ...prev, panX: panRef.current.px + dx, panY: panRef.current.py + dy }));
    }
  };

  const handleMouseUp = () => {
    panRef.current.active = false;
    setIsDragging(false);
  };

  const handleBgClick = () => {
    const moved = panRef.current.moved;
    panRef.current.moved = false;
    if (moved) return;
    setSelectedKey(null);
    setActiveModal(null);
  };

  // ── System click ─────────────────────────────────────────────────────────
  const handleSystemClick = (system, e) => {
    e.stopPropagation();
    if (selectedKey === system.key) { setSelectedKey(null); return; }
    setSelectedKey(system.key);
    setActiveModal(null);

    // getBoundingClientRect already accounts for CSS transform — gives screen coords
    const elRect = e.currentTarget.getBoundingClientRect();
    const vpRect = viewportRef.current.getBoundingClientRect();
    setBtnPos({
      x: elRect.right  - vpRect.left,
      y: elRect.top    - vpRect.top + elRect.height / 2,
    });
  };

  const selectedSystem = systems.find(s => s.key === selectedKey);
  const activeButton   = navButtons.find(b => b.id === activeModal);
  const { zoom, panX, panY } = vp;

  return (
    <div style={S.root}>

      {/* ── Header ── */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          {(isAdmin || can('navigation', 'view') || can('navigation', 'edit')) && (
            <button style={S.adminBtn} onClick={() => navigate('/admin')} title="פאנל מנהל">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
              <span>מנהל</span>
            </button>
          )}
        </div>
        <div style={S.headerCenter}>
          <div style={S.headerLogo}>
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="10" fill="#e8a020"/>
              <path d="M8 16h32M8 24h32M8 32h20" stroke="#0f2347" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={S.headerTitle}>מפת מערכות ארגוניות</h1>
        </div>
        <div style={S.headerRight}>
          <button style={S.enterpriseAIBtn} onClick={() => setAiPanel({ mode: 'enterprise' })} title="יועץ AI ארגוני">
            🏢 AI ארגוני
          </button>
          <span style={S.userInfo}>{user?.fullName}</span>
          <button style={S.logoutBtn} onClick={logout}>התנתק</button>
        </div>
      </header>

      {/* ── Viewport ── */}
      <main
        ref={viewportRef}
        style={{ ...S.main, cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleBgClick}
      >
        {/* Transformed diagram */}
        <div
          ref={diagramRef}
          style={{
            position: 'absolute',
            top: 0, left: 0,
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: '0 0',
            background: '#ffffff',
            borderRadius: 12,
            boxShadow: '0 4px 24px rgba(26,58,107,0.18), 0 0 0 1px rgba(26,58,107,0.08)',
            userSelect: 'none',
            // Width/height determined by the image's natural size
          }}
        >
          <img
            src="/diagram.png"
            alt="מפת מערכות"
            style={{ display: 'block', maxWidth: 'none', borderRadius: 12 }}
            onLoad={handleImgLoad}
            onError={() => setImgLoaded(true)}
            draggable={false}
          />

          {!imgLoaded && <DiagramFallback />}

          {imgLoaded && systems.map(system => (
            <SystemHotspot
              key={system.key}
              system={system}
              isSelected={selectedKey === system.key}
              onClick={handleSystemClick}
            />
          ))}
        </div>

        {/* Action buttons — live OUTSIDE the transform so they stay at fixed screen size */}
        {selectedKey && selectedSystem && navButtons.length > 0 && (
          <ActionButtons
            buttons={navButtons}
            pos={btnPos}
            viewportRef={viewportRef}
            onAction={(id) => setActiveModal(id)}
            onAI={() => setAiPanel({ mode: 'system', systemKey: selectedKey })}
          />
        )}

        {/* Zoom controls */}
        <div style={S.zoomBar} onClick={e => e.stopPropagation()}>
          <button style={S.zoomBtn} onClick={() => stepZoom(1.25)} title="הגדל">+</button>
          <span style={S.zoomPct}>{Math.round(zoom * 100)}%</span>
          <button style={S.zoomBtn} onClick={() => stepZoom(0.8)} title="הקטן">−</button>
          <div style={S.zoomDivider} />
          <button style={S.zoomFitBtn} onClick={zoomToFit} title="התאם לחלון">⊞</button>
        </div>
      </main>

      {/* ── AI panel ── */}
      {aiPanel && (
        aiPanel.mode === 'enterprise'
          ? <AIChatPanel mode="enterprise" onClose={() => setAiPanel(null)} />
          : <AIChatPanel mode="system" system={systems.find(s => s.key === aiPanel.systemKey)} onClose={() => setAiPanel(null)} />
      )}

      {/* ── Feature modals ── */}
      {activeModal && selectedSystem && activeButton && (
        activeButton.type === 'documents' ? (
          <ComponentsModal
            key={activeModal}
            system={selectedSystem}
            type={activeButton.documentType}
            onClose={() => setActiveModal(null)}
          />
        ) : (
          <DynamicQuestionnaireModal
            key={activeModal}
            button={activeButton}
            system={selectedSystem}
            onClose={() => setActiveModal(null)}
          />
        )
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SystemHotspot({ system, isSelected, onClick }) {
  return (
    <div
      onClick={(e) => onClick(system, e)}
      title={system.name}
      style={{
        position: 'absolute',
        left:   `${system.posX}%`,
        top:    `${system.posY}%`,
        width:  `${system.width}%`,
        height: `${system.height}%`,
        border: `2px solid ${isSelected ? '#e8a020' : 'transparent'}`,
        background: isSelected ? 'rgba(232,160,32,0.15)' : 'rgba(26,58,107,0.06)',
        borderRadius: 8,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: isSelected ? '0 0 0 3px rgba(232,160,32,0.3)' : 'none',
        zIndex: isSelected ? 10 : 5,
      }}
    >
      {isSelected && (
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#e8a020',
          background: 'rgba(255,255,255,0.95)', padding: '2px 8px',
          borderRadius: 12, border: '1px solid #e8a020',
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {system.name}
        </span>
      )}
    </div>
  );
}

function ActionButtons({ buttons, pos, viewportRef, onAction, onAI }) {
  const BTN_W = 140;
  const vpWidth = viewportRef.current?.clientWidth || 800;
  const totalCount = buttons.length + 1;
  const left = Math.min(pos.x + 12, vpWidth - BTN_W - 12);
  const top  = pos.y - (totalCount * 42) / 2;

  const btnStyle = (color, i) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 14px', background: color || '#1a3a6b',
    color: '#fff', border: 'none', borderRadius: 8,
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
    fontFamily: 'Rubik, sans-serif', width: BTN_W,
    boxShadow: '0 3px 10px rgba(26,58,107,0.25)',
    transition: 'transform 0.15s, box-shadow 0.15s',
    animationDelay: `${i * 0.05}s`,
  });

  const hoverOn  = e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(26,58,107,0.35)'; };
  const hoverOff = e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 3px 10px rgba(26,58,107,0.25)'; };

  return (
    <div
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'absolute', left, top,
        display: 'flex', flexDirection: 'column', gap: 6,
        zIndex: 50, animation: 'slideInRight 0.2s ease',
      }}
    >
      {buttons.map((btn, i) => (
        <button key={btn.id} onClick={() => onAction(btn.id)} style={btnStyle(btn.color, i)} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
          <span style={{ fontSize: 15 }}>{btn.icon}</span>
          <span>{btn.name}</span>
        </button>
      ))}
      <button onClick={onAI} style={btnStyle('#2554a3', buttons.length)} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        <span style={{ fontSize: 15 }}>🤖</span>
        <span>יועץ AI</span>
      </button>
    </div>
  );
}

function DiagramFallback() {
  return (
    <div style={{ width: 800, height: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #f0f4f8, #e8eef5)', borderRadius: 12 }}>
      <p style={{ color: '#5a6a7e', fontSize: 14, textAlign: 'center', lineHeight: 1.6 }}>
        העלה תמונת דיאגרמה בשם <code>diagram.png</code><br/>לתיקיית <code>client/public/</code>
      </p>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  root: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', direction: 'rtl' },

  header: {
    background: '#1a3a6b', color: '#fff', padding: '0 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: 60, flexShrink: 0, boxShadow: '0 2px 8px rgba(15,35,71,0.3)',
    position: 'relative', zIndex: 100,
  },
  headerLeft:   { display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 },
  headerCenter: { display: 'flex', alignItems: 'center', gap: 10, position: 'absolute', left: '50%', transform: 'translateX(-50%)' },
  headerRight:  { display: 'flex', alignItems: 'center', gap: 12, minWidth: 120, justifyContent: 'flex-end' },
  headerLogo:   { display: 'flex' },
  headerTitle:  { fontSize: 18, fontWeight: 700, letterSpacing: -0.3 },

  enterpriseAIBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(124,63,207,0.2)', color: '#c9a0f7',
    border: '1px solid rgba(124,63,207,0.4)', borderRadius: 8,
    padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    fontFamily: 'Rubik, sans-serif',
  },
  adminBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(232,160,32,0.2)', color: '#e8a020',
    border: '1px solid rgba(232,160,32,0.4)', borderRadius: 8,
    padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    fontFamily: 'Rubik, sans-serif',
  },
  userInfo:  { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  logoutBtn: {
    background: 'transparent', color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6,
    padding: '5px 12px', cursor: 'pointer', fontSize: 13, fontFamily: 'Rubik, sans-serif',
  },

  // Viewport — fills remaining height, clips overflow, captures events
  main: {
    flex: 1, position: 'relative', overflow: 'hidden',
    background: '#dce4ef',
  },

  // Zoom controls — floating panel bottom-left
  zoomBar: {
    position: 'absolute', bottom: 16, left: 16,
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'rgba(255,255,255,0.95)', borderRadius: 10,
    boxShadow: '0 2px 12px rgba(26,58,107,0.18)',
    border: '1px solid rgba(26,58,107,0.12)',
    padding: '4px 6px',
    zIndex: 60,
    backdropFilter: 'blur(8px)',
  },
  zoomBtn: {
    width: 30, height: 30, border: 'none', borderRadius: 6, background: 'transparent',
    cursor: 'pointer', fontSize: 18, fontWeight: 700, color: '#1a3a6b',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s',
  },
  zoomPct: {
    fontSize: 12, fontWeight: 700, color: '#1a3a6b', fontFamily: 'monospace',
    minWidth: 40, textAlign: 'center', letterSpacing: 0.3,
  },
  zoomDivider: {
    width: 1, height: 18, background: '#d1dce8', margin: '0 2px',
  },
  zoomFitBtn: {
    height: 30, border: 'none', borderRadius: 6, background: 'transparent',
    cursor: 'pointer', fontSize: 15, color: '#1a3a6b', padding: '0 6px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s', fontWeight: 600,
  },
};
