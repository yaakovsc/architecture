import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בהתחברות');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoBox}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#1a3a6b"/>
            <path d="M8 16h32M8 24h32M8 32h20" stroke="#e8a020" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="38" cy="32" r="6" fill="#e8a020"/>
          </svg>
        </div>
        <h1 style={styles.title}>מפת מערכות ארגוניות</h1>
        <p style={styles.subtitle}>התחבר כדי להמשיך</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>שם משתמש</label>
            <input
              style={styles.input}
              type="text"
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              placeholder="הזן שם משתמש"
              autoFocus
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>סיסמה</label>
            <input
              style={styles.input}
              type="password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="הזן סיסמה"
              required
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? <Spinner /> : 'התחבר'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 18, height: 18,
      border: '2px solid rgba(255,255,255,0.4)',
      borderTopColor: '#fff', borderRadius: '50%',
      animation: 'spin 0.7s linear infinite', verticalAlign: 'middle',
    }} />
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f2347 0%, #1a3a6b 55%, #2554a3 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, direction: 'rtl',
  },
  card: {
    background: '#fff', borderRadius: 12, padding: '40px 36px',
    width: '100%', maxWidth: 420, textAlign: 'center',
    boxShadow: '0 20px 60px rgba(15,35,71,0.4)',
    animation: 'slideUp 0.4s ease forwards',
  },
  logoBox: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: '#f0f4f8', borderRadius: 20, padding: 16,
    marginBottom: 20, boxShadow: '0 4px 16px rgba(26,58,107,0.16)',
  },
  title: {
    fontSize: 22, fontWeight: 700, color: '#1a3a6b', marginBottom: 6,
  },
  subtitle: {
    fontSize: 14, color: '#5a6a7e', marginBottom: 28,
  },
  form: { display: 'flex', flexDirection: 'column', gap: 18 },
  field: { textAlign: 'right' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#1a2332', marginBottom: 6 },
  input: {
    width: '100%', padding: '10px 14px', border: '2px solid #d1dce8',
    borderRadius: 8, fontSize: 15, fontFamily: 'Rubik, sans-serif',
    transition: 'border-color 0.2s, box-shadow 0.2s', outline: 'none',
    direction: 'rtl',
    color: '#1a2332',
  },
  error: {
    background: '#fff0ee', border: '1px solid #f8c4bb',
    color: '#c0392b', borderRadius: 8, padding: '10px 14px', fontSize: 14,
  },
  btn: {
    background: '#1a3a6b', color: '#fff', border: 'none',
    borderRadius: 8, padding: '12px 24px', fontSize: 16, fontWeight: 600,
    fontFamily: 'Rubik, sans-serif', cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    marginTop: 4,
  },
};
