import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import UserManagement from '../components/admin/UserManagement';
import SystemRegionEditor from '../components/admin/SystemRegionEditor';
import NavigationEditor from '../components/admin/NavigationEditor';
import AiConfigEditor from '../components/admin/AiConfigEditor';

const ALL_TABS = [
  { id: 'regions', label: 'אזורי מערכות',  icon: <RegionTabIcon />, adminOnly: true },
  { id: 'users',   label: 'ניהול משתמשים', icon: <UsersTabIcon />,  adminOnly: true },
  { id: 'nav',     label: 'ניווט',          icon: <NavTabIcon />,    adminOnly: false },
  { id: 'ai',      label: 'הגדרות AI',      icon: <AiTabIcon />,     adminOnly: true },
];

export default function AdminPage() {
  const { user, logout, isAdmin, can } = useAuth();
  const navigate = useNavigate();

  const tabs = isAdmin ? ALL_TABS : ALL_TABS.filter(t => !t.adminOnly);
  const [tab, setTab] = useState(isAdmin ? 'regions' : 'nav');

  return (
    <div style={styles.root}>
      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={styles.backBtn} onClick={() => navigate('/')} title="חזור לדיאגרמה">
            <ArrowIcon />
          </button>
          <div style={styles.logoMark}>
            <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="10" fill="#e8a020"/>
              <path d="M8 16h32M8 24h32M8 32h20" stroke="#0f2347" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 style={styles.headerTitle}>פאנל ניהול</h1>
            <p style={styles.headerSub}>ניהול מערכות ומשתמשים</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={styles.userTag}>{user?.fullName}</span>
          <button style={styles.logoutBtn} onClick={logout}>התנתק</button>
        </div>
      </header>

      <div style={styles.body}>
        {/* Tab bar */}
        <div style={styles.tabBar}>
          {tabs.map(t => (
            <button
              key={t.id}
              style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }}
              onClick={() => setTab(t.id)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {t.icon}
                {t.label}
              </span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={styles.content}>
          {tab === 'regions' && <SystemRegionEditor />}
          {tab === 'users' && (
            <div style={{ padding: '0 24px 24px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <UserManagement />
            </div>
          )}
          {tab === 'nav' && <NavigationEditor />}
          {tab === 'ai'  && <AiConfigEditor />}
        </div>
      </div>
    </div>
  );
}

// Icons
function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  );
}

function RegionTabIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <rect x="7" y="7" width="4" height="4" rx="1"/>
      <rect x="13" y="7" width="4" height="4" rx="1"/>
      <rect x="7" y="13" width="4" height="4" rx="1"/>
    </svg>
  );
}

function NavTabIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
    </svg>
  );
}

function UsersTabIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/>
      <path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}

function AiTabIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a7 7 0 017 7c0 4-3 6-3 9H8c0-3-3-5-3-9a7 7 0 017-7z"/>
      <line x1="8" y1="22" x2="16" y2="22"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
    </svg>
  );
}

const styles = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    overflow: 'hidden', direction: 'rtl', background: '#f0f4f8',
  },
  header: {
    background: '#1a3a6b', color: '#fff', padding: '0 20px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    height: 64, flexShrink: 0, boxShadow: '0 2px 8px rgba(15,35,71,0.3)',
  },
  backBtn: {
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer',
    display: 'flex', alignItems: 'center', transition: 'background 0.15s',
    transform: 'scaleX(-1)',
  },
  logoMark: { display: 'flex' },
  headerTitle: { fontSize: 19, fontWeight: 700, lineHeight: 1.2 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  userTag: { fontSize: 15, color: 'rgba(255,255,255,0.75)' },
  logoutBtn: {
    background: 'transparent', color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6,
    padding: '6px 14px', cursor: 'pointer', fontSize: 15, fontFamily: 'Rubik',
  },
  body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  tabBar: {
    display: 'flex', gap: 0, padding: '0 20px',
    background: '#fff', flexShrink: 0,
  },
  tab: {
    padding: '15px 22px', border: 'none', borderBottom: '3px solid transparent',
    background: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600,
    fontFamily: 'Rubik', color: '#5a6a7e', transition: 'color 0.15s',
    display: 'flex', alignItems: 'center',
  },
  tabActive: { color: '#1a3a6b', borderBottom: '3px solid #1a3a6b' },
  content: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
};
