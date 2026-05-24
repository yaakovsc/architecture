import React, { useState, useEffect, useRef } from 'react';

const DRAWIO_BASE = import.meta.env.VITE_DRAWIO_URL || 'http://localhost:8181';

// Wraps a bare mxCell in the mxGraphModel structure draw.io requires for library entries.
// id="2" on the shape cell ensures mxCodec can decode it; parent="1" attaches it to the default layer.
const wrapXml = (cellXml) => {
  const cell = cellXml.replace('<mxCell', '<mxCell id="2" parent="1"');
  return `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cell}</root></mxGraphModel>`;
};

const POSTAL_LIBRARY = [
  { title: 'שירות',      tooltip: 'Service / Application Layer',   w: 120, h: 60,  xml: wrapXml('<mxCell value="שירות"    style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1"><mxGeometry x="0" y="0" width="120" height="60"  as="geometry"/></mxCell>') },
  { title: 'דטהבייס',    tooltip: 'Database / Storage Layer',      w: 80,  h: 100, xml: wrapXml('<mxCell value="דטהבייס"  style="shape=cylinder3;whiteSpace=wrap;html=1;boundedLbl=1;backgroundOutline=1;size=15;fillColor=#ffe6cc;strokeColor=#d6b656;" vertex="1"><mxGeometry x="0" y="0" width="80" height="100" as="geometry"/></mxCell>') },
  { title: 'FW / Security', tooltip: 'Firewall, WAF, Security Zone', w: 80, h: 80, xml: wrapXml('<mxCell value="FW"       style="shape=hexagon;perimeter=hexagonPerimeter2;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" vertex="1"><mxGeometry x="0" y="0" width="80" height="80"  as="geometry"/></mxCell>') },
  { title: 'LB',         tooltip: 'Load Balancer / Proxy',         w: 80,  h: 80,  xml: wrapXml('<mxCell value="LB"       style="rhombus;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1"><mxGeometry x="0" y="0" width="80" height="80"  as="geometry"/></mxCell>') },
  { title: 'Logs',       tooltip: 'Logging / Monitoring',          w: 100, h: 60,  xml: wrapXml('<mxCell value="Logs"     style="shape=note;whiteSpace=wrap;html=1;size=15;fillColor=#e1d5e7;strokeColor=#9673a6;" vertex="1"><mxGeometry x="0" y="0" width="100" height="60"  as="geometry"/></mxCell>') },
  { title: 'API',        tooltip: 'API Gateway / Integration',     w: 120, h: 60,  xml: wrapXml('<mxCell value="API"      style="shape=process;whiteSpace=wrap;html=1;backgroundOutline=1;fillColor=#d5e8d4;strokeColor=#009900;fontColor=#006600;" vertex="1"><mxGeometry x="0" y="0" width="120" height="60"  as="geometry"/></mxCell>') },
  { title: 'External',   tooltip: 'שירות חיצוני / Cloud',          w: 120, h: 80,  xml: wrapXml('<mxCell value="External" style="ellipse;shape=cloud;whiteSpace=wrap;html=1;fillColor=#f5f5f5;strokeColor=#666666;fontColor=#333333;" vertex="1"><mxGeometry x="0" y="0" width="120" height="80"  as="geometry"/></mxCell>') },
  { title: 'ממשק',       tooltip: 'תלות / Interface',              w: 120, h: 60,  xml: wrapXml('<mxCell value="ממשק"    style="endArrow=block;startArrow=none;html=1;strokeColor=#000000;strokeWidth=2;" edge="1"><mxGeometry width="120" relative="1" as="geometry"><mxPoint x="0" y="30" as="sourcePoint"/><mxPoint x="120" y="30" as="targetPoint"/></mxGeometry></mxCell>') },
];

// Extract origin (scheme + host + port) from the configured URL for postMessage validation
const DRAWIO_ORIGIN = (() => { try { return new URL(DRAWIO_BASE).origin; } catch { return DRAWIO_BASE; } })();
const DRAWIO_LIBS = 'postal;general;miscellaneous;advanced;uml;er;bpmn;flowchart;basic;arrows2';
const DRAWIO_URL = `${DRAWIO_BASE}/?embed=1&spin=1&proto=json&lang=he&ui=kennedy&configure=1&libs=${encodeURIComponent(DRAWIO_LIBS)}`;

export default function DrawioEditorModal({ xml, onSave, onClose }) {
  const iframeRef = useRef(null);
  const savedXmlRef = useRef(null);
  const pendingPngRef = useRef(false);
  const [phase, setPhase] = useState('loading'); // 'loading' | 'editing' | 'format-picker' | 'exporting'

  useEffect(() => {
    const handleMessage = (e) => {
      if (e.origin !== DRAWIO_ORIGIN) return;
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      const send = (action) => {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify(action), DRAWIO_ORIGIN);
      };

      if (msg.event === 'configure') {
        send({
          action: 'configure',
          config: {
            defaultLibraries: 'postal;general;miscellaneous;advanced;uml;er;bpmn;flowchart;basic;arrows2',
            libraries: [
              {
                entries: [
                  {
                    id: 'postal',
                    title: { he: 'דואר', main: 'דואר' },
                    libs: [{
                      id: 'postal',
                      title: { he: 'דואר', main: 'דואר' },
                      data: POSTAL_LIBRARY,
                    }],
                  },
                ],
              },
            ],
          },
        });
      } else if (msg.event === 'init') {
        setPhase('editing');
        send({ action: 'load', xml: xml || '' });
      } else if (msg.event === 'save') {
        savedXmlRef.current = msg.xml;
        setPhase('format-picker');
      } else if (msg.event === 'export' && msg.format === 'png' && pendingPngRef.current) {
        pendingPngRef.current = false;
        const base64 = msg.data?.split(',')[1];
        if (!base64) return;
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const file = new File([bytes], 'diagram.png', { type: 'image/png' });
        onSave(file);
      } else if (msg.event === 'exit') {
        onClose();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [xml, onSave, onClose]);

  const saveAsDrawio = () => {
    const content = savedXmlRef.current;
    if (!content) return;
    const file = new File([content], 'diagram.drawio', { type: 'application/xml' });
    onSave(file);
  };

  const saveAsPng = () => {
    setPhase('exporting');
    pendingPngRef.current = true;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: 'export', format: 'png', scale: 2 }),
      DRAWIO_ORIGIN
    );
  };

  return (
    <div style={S.overlay}>
      <div style={S.header}>
        <div style={S.headerLeft}>
          <DrawioLogo />
          <span style={S.headerTitle}>draw.io</span>
        </div>
        <button style={S.closeBtn} onClick={onClose}>✕ סגור ללא שמירה</button>
      </div>

      <iframe
        ref={iframeRef}
        src={DRAWIO_URL}
        style={S.iframe}
        title="draw.io editor"
        allowFullScreen
      />

      {phase === 'loading' && (
        <div style={S.centerOverlay}>
          <div style={S.spinner} />
          <span style={S.overlayText}>טוען עורך...</span>
        </div>
      )}

      {phase === 'format-picker' && (
        <div style={S.pickerOverlay}>
          <div style={S.pickerBox}>
            <div style={S.pickerTitle}>בחר פורמט שמירה</div>
            <div style={S.pickerBtns}>
              <button style={S.btnDrawio} onClick={saveAsDrawio}>
                <span style={S.btnIcon}>🗂</span>
                <span>שמור כ-.drawio</span>
                <span style={S.btnHint}>ניתן לעריכה מחדש</span>
              </button>
              <button style={S.btnPng} onClick={saveAsPng}>
                <span style={S.btnIcon}>🖼</span>
                <span>שמור כ-PNG</span>
                <span style={S.btnHint}>תמונה לתצוגה</span>
              </button>
            </div>
            <button style={S.backBtn} onClick={() => setPhase('editing')}>
              חזור לעריכה
            </button>
          </div>
        </div>
      )}

      {phase === 'exporting' && (
        <div style={S.centerOverlay}>
          <div style={S.spinner} />
          <span style={S.overlayText}>מייצא תמונה...</span>
        </div>
      )}
    </div>
  );
}

function DrawioLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8">
      <rect x="1" y="1" width="8" height="8" rx="1.5"/>
      <rect x="15" y="1" width="8" height="8" rx="1.5"/>
      <rect x="8" y="15" width="8" height="8" rx="1.5"/>
      <path d="M9 5h6M5 9v2.5a3.5 3.5 0 003.5 3.5h7A3.5 3.5 0 0019 11.5V9"/>
    </svg>
  );
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 2000,
    display: 'flex', flexDirection: 'column',
    background: '#f8fafc',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 20px', height: 50, flexShrink: 0,
    background: 'linear-gradient(135deg, #0f2347 0%, #1a3a6b 100%)',
    boxShadow: '0 2px 8px rgba(15,35,71,0.4)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerTitle: {
    fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: -0.2, fontFamily: 'Rubik, sans-serif',
  },
  closeBtn: {
    background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)',
    border: '1px solid rgba(255,255,255,0.25)', borderRadius: 7,
    padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
    fontFamily: 'Rubik, sans-serif', transition: 'background 0.15s', direction: 'rtl',
  },
  iframe: { flex: 1, border: 'none', width: '100%' },
  centerOverlay: {
    position: 'absolute', inset: 0, top: 50,
    background: '#f8fafc', display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    zIndex: 10, gap: 14,
  },
  spinner: {
    width: 36, height: 36, border: '3px solid #d1dce8',
    borderTopColor: '#1a3a6b', borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  overlayText: { color: '#5a6a7e', fontSize: 15, fontFamily: 'Rubik, sans-serif' },
  pickerOverlay: {
    position: 'absolute', inset: 0, top: 50,
    background: 'rgba(15,35,71,0.6)', backdropFilter: 'blur(5px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  pickerBox: {
    background: '#fff', borderRadius: 16, padding: '32px 36px',
    boxShadow: '0 20px 60px rgba(15,35,71,0.3)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
    minWidth: 360, direction: 'rtl',
    animation: 'scaleIn 0.2s ease',
  },
  pickerTitle: {
    fontSize: 19, fontWeight: 700, color: '#1a2332', fontFamily: 'Rubik, sans-serif',
  },
  pickerBtns: { display: 'flex', gap: 16 },
  btnDrawio: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
    padding: '18px 26px', borderRadius: 12,
    background: '#1a3a6b', color: '#fff',
    border: 'none', cursor: 'pointer', fontFamily: 'Rubik, sans-serif',
    fontSize: 14, fontWeight: 600, minWidth: 140,
    boxShadow: '0 4px 12px rgba(26,58,107,0.35)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  btnPng: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
    padding: '18px 26px', borderRadius: 12,
    background: '#e8a020', color: '#fff',
    border: 'none', cursor: 'pointer', fontFamily: 'Rubik, sans-serif',
    fontSize: 14, fontWeight: 600, minWidth: 140,
    boxShadow: '0 4px 12px rgba(232,160,32,0.35)',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  btnIcon: { fontSize: 22 },
  btnHint: { fontSize: 12, fontWeight: 400, opacity: 0.75 },
  backBtn: {
    background: 'transparent', color: '#8a9ab0',
    border: '1px solid #d1dce8', borderRadius: 7,
    padding: '8px 18px', cursor: 'pointer', fontSize: 13,
    fontFamily: 'Rubik, sans-serif', transition: 'border-color 0.15s',
  },
};
