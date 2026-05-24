import React from 'react';
import Modal from '../common/Modal';

export default function ClassificationModal({ onClose }) {
  return (
    <Modal title="סיווג" onClose={onClose} maxWidth={420}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '32px 16px', gap: 16,
      }}>
        <div style={{
          width: 64, height: 64, background: '#f0f4f8', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
        }}>
          🏷
        </div>
        <h3 style={{ fontSize: 18, color: '#1a3a6b', fontWeight: 600 }}>סיווג מערכת</h3>
        <p style={{ fontSize: 15, color: '#5a6a7e', textAlign: 'center' }}>
          לא זמין כרגע
        </p>
        <p style={{ fontSize: 13, color: '#8a9ab0', textAlign: 'center' }}>
          פיצ'ר זה יהיה זמין בגרסה הבאה
        </p>
        <button
          style={{
            background: '#1a3a6b', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 24px', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, fontFamily: 'Rubik',
          }}
          onClick={onClose}
        >
          סגור
        </button>
      </div>
    </Modal>
  );
}
