'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// ── Defaults (used by service when DB record has null values) ─────────────
const DEFAULT_SYSTEM_CHAPTERS = [
  { title: 'תקציר מנהלים',            prompt: 'פסקה אחת, ברמת Board of Directors. מה המערכת עושה, מה מצבה, מה הסיכון העיקרי.' },
  { title: 'מפת תלויות וממשקי API',   prompt: 'טבלה: | שירות | תלוי ב- | פרוטוקול | קריטיות | הערות |. ניתוח נקודות כשל יחיד (Single Point of Failure).' },
  { title: 'כפילויות משאבים',         prompt: 'זיהוי חפיפות טכנולוגיות, שכפול לוגיקה, ועודפים בתשתית. המלצות לאיחוד.' },
  { title: 'וקטורי תקיפה ואבטחה',    prompt: 'טבלה: | וקטור תקיפה | חומרה (1-5) | הסבר | המלצה |. כולל: חשיפת API, אימות, הצפנת נתונים, הרשאות.' },
  { title: 'חוב טכנולוגי ומדרגיות',  prompt: 'הערכת החוב הצטבר, צווארי בקבוק ביצועים, תכנון לעומסי שיא. טבלה: | תחום | חוב | עדיפות לתיקון |' },
  { title: 'שרידות ורציפות עסקית',   prompt: 'ניתוח SLA, תרחישי כשל, יכולת התאוששות. מה קורה אם רכיב X נופל?' },
  { title: 'המלצות מיידיות (Quick Wins)', prompt: '3-5 פעולות בעדיפות גבוהה עם השפעה מידית. פורמט: | פעולה | מאמץ | השפעה | בעל תפקיד |' },
];

const DEFAULT_ENTERPRISE_CHAPTERS = [
  { title: 'תקציר מנהלים ארגוני',            prompt: 'מצב כלל המערכות ברמת Board of Directors.' },
  { title: 'מפת תלויות בין-מערכתית',         prompt: 'טבלה: | מערכת מקור | מערכת יעד | פרוטוקול | קריטיות | הערות |' },
  { title: 'כפילויות משאבים ארגוניות',        prompt: 'חפיפות בין מערכות, המלצות לאיחוד ושיתוף שירותים.' },
  { title: 'וקטורי תקיפה ארגוניים',          prompt: 'טבלה: | וקטור | מערכות מושפעות | חומרה (1-5) | המלצה |' },
  { title: 'חוב טכנולוגי ארגוני',            prompt: 'טבלה: | מערכת | תחום | חוב | עדיפות |' },
  { title: 'שרידות ורציפות עסקית ארגונית',   prompt: 'תרחישי כשל, תלויות קריטיות, המלצות HA/DR.' },
  { title: 'המלצות מיידיות ארגוניות (Quick Wins)', prompt: 'טבלה: | פעולה | מערכות מושפעות | מאמץ | השפעה |' },
];

const DEFAULT_CHAT_PROMPT =
  'אתה יועץ ארכיטקטורת מערכות ברמת CTO בחברה ישראלית. ' +
  'ענה תמיד בעברית מקצועית וזורמת. ' +
  'השתמש בטרמינולוגיה: תלויות, ממשקי API, שרידות, וקטור תקיפה, חוב טכנולוגי.';

const DEFAULT_FRAGMENT_PROMPT =
  'אתה אדריכל מערכות ברמת CTO. נתח את הדיאגרמה "{fileName}" של מערכת "{systemName}".\n\n' +
  'ספק ניתוח תמציתי ב-Markdown הכולל:\n' +
  '- **רכיבים עיקריים**: רשימת רכיבים ושירותים מזוהים\n' +
  '- **ממשקי API ותלויות**: חיבורים בין-שירותיים ופרוטוקולים\n' +
  '- **תצפיות ארכיטקטוניות**: נקודות חוזק, חולשות, וסיכוני שרידות';

// ── Model ─────────────────────────────────────────────────────────────────
const AiConfig = sequelize.define('AiConfig', {
  id: {
    type: DataTypes.STRING(32),
    primaryKey: true,
    defaultValue: 'main',
  },
  chatSystemPrompt:       { type: DataTypes.TEXT,   allowNull: true },
  fragmentAnalysisPrompt: { type: DataTypes.TEXT,   allowNull: true },
  systemReportTitle:      { type: DataTypes.STRING, allowNull: true },
  enterpriseReportTitle:  { type: DataTypes.STRING, allowNull: true },
  systemReportChapters:   { type: DataTypes.JSONB,  allowNull: true },
  enterpriseReportChapters: { type: DataTypes.JSONB, allowNull: true },
}, {
  tableName: 'ai_configs',
});

// Expose defaults so the service and controller can fall back to them
AiConfig.DEFAULTS = {
  chatSystemPrompt:         DEFAULT_CHAT_PROMPT,
  fragmentAnalysisPrompt:   DEFAULT_FRAGMENT_PROMPT,
  systemReportTitle:        'דו"ח ארכיטקטורה — {name}',
  enterpriseReportTitle:    'דו"ח ארכיטקטורה ארגוני',
  systemReportChapters:     DEFAULT_SYSTEM_CHAPTERS,
  enterpriseReportChapters: DEFAULT_ENTERPRISE_CHAPTERS,
};

module.exports = AiConfig;
