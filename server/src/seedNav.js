/**
 * seedNav.js — one-time migration script
 *
 * Creates the NavButton / NavSubject / NavField / NavFieldOption structure
 * that replaces the old hardcoded buttons (מערכת, רכיבים, אינטגרציה, סיווג).
 *
 * Then migrates every existing SystemData row into a NavResponse record
 * so no existing data is lost.
 *
 * Run: node src/seedNav.js
 * Safe to re-run: checks for existing data before inserting.
 */

require('dotenv').config();
const { sequelize, System, SystemData, NavButton, NavSubject, NavField, NavFieldOption, NavResponse } = require('./models');

// ── Structure definition ──────────────────────────────────────────────────
// Maps 1:1 to the old SystemModal SECTIONS + fields.
// field.legacyKey  = the column name in the SystemData model
// field.type       = NavField type
// field.options    = { label, value } pairs for select fields
// field.exampleValue = hint shown in the admin

const SYSTEM_BUTTON_SUBJECTS = [
  {
    name: 'פרטי מערכת',
    icon: '🖥️',
    fields: [
      { name: 'שם המערכת',   type: 'text',   legacyKey: 'systemName',     exampleValue: 'מערכת חשבשבת' },
      { name: 'כינוי',        type: 'text',   legacyKey: 'alias',          exampleValue: 'CHASHABAT' },
      { name: 'תחום עסקי',    type: 'text',   legacyKey: 'businessDomain', exampleValue: 'כספים' },
      { name: 'בעל המערכת',   type: 'text',   legacyKey: 'systemOwner',    exampleValue: 'משה לוי' },
      { name: 'ספק / יצרן',   type: 'text',   legacyKey: 'vendor',         exampleValue: 'Oracle' },
      { name: 'גרסה',          type: 'text',   legacyKey: 'version',        exampleValue: '3.2.1' },
      { name: 'שנת הטמעה',    type: 'text',   legacyKey: 'deploymentYear', exampleValue: '2020' },
    ],
  },
  {
    name: 'סוג שירות',
    icon: '⚙️',
    fields: [
      {
        name: 'סוג שירות', type: 'select', legacyKey: 'serviceType',
        options: ['SaaS', 'On-Premise', 'Hybrid', 'PaaS', 'IaaS', 'Legacy'].map(v => ({ label: v, value: v })),
      },
      { name: 'תת-סוג', type: 'text', legacyKey: 'serviceSubtype', exampleValue: 'Micro-services' },
      {
        name: 'קריטיות', type: 'select', legacyKey: 'criticality',
        options: [
          { label: 'קריטי',  value: 'critical' },
          { label: 'גבוה',   value: 'high' },
          { label: 'בינוני', value: 'medium' },
          { label: 'נמוך',   value: 'low' },
        ],
      },
    ],
  },
  {
    name: 'אינטגרציות',
    icon: '🔗',
    fields: [
      { name: 'Upstream — מערכות מזינות',  type: 'multi_value', legacyKey: 'upstreamSystems',      exampleValue: 'SAP, ERP' },
      { name: 'Downstream — מערכות מוזנות', type: 'multi_value', legacyKey: 'downstreamSystems',    exampleValue: 'DWH' },
      { name: 'פרוטוקולים',                  type: 'multi_value', legacyKey: 'protocols',            exampleValue: 'REST, SFTP' },
      {
        name: 'תדירות תקשורת', type: 'select', legacyKey: 'integrationFrequency',
        options: ['Real-time', 'Near Real-time', 'Batch - יומי', 'Batch - שבועי', 'On Demand', 'Event-driven']
          .map(v => ({ label: v, value: v })),
      },
    ],
  },
  {
    name: 'תשתית טכנולוגית',
    icon: '🔧',
    fields: [
      { name: 'שרת אפליקציה', type: 'text', legacyKey: 'appServer',     exampleValue: 'Tomcat 9' },
      { name: 'מסד נתונים',    type: 'text', legacyKey: 'database',      exampleValue: 'PostgreSQL 15' },
      { name: 'Load Balancer',  type: 'text', legacyKey: 'loadBalancer',  exampleValue: 'HAProxy' },
      { name: 'חומת אש',        type: 'text', legacyKey: 'firewall',      exampleValue: 'Palo Alto' },
      { name: 'מערכת לוגים',    type: 'text', legacyKey: 'loggingSystem', exampleValue: 'ELK Stack' },
    ],
  },
  {
    name: 'SLA ורציפות',
    icon: '🛡️',
    fields: [
      { name: 'RTO',    type: 'text', legacyKey: 'rto',          exampleValue: '4h' },
      { name: 'RPO',    type: 'text', legacyKey: 'rpo',          exampleValue: '1h' },
      { name: 'SLA',    type: 'text', legacyKey: 'sla',          exampleValue: '99.9%' },
      { name: 'זמינות', type: 'text', legacyKey: 'availability', exampleValue: '24/7' },
    ],
  },
  {
    name: 'תיעוד',
    icon: '📄',
    fields: [
      {
        name: 'קיים תיעוד', type: 'select', legacyKey: 'hasDocumentation',
        options: [{ label: 'כן', value: 'true' }, { label: 'לא', value: 'false' }],
      },
      { name: 'קישור לתיעוד', type: 'text',     legacyKey: 'documentationUrl', exampleValue: 'https://wiki.company.com/...' },
      { name: 'הערות',         type: 'textarea', legacyKey: 'notes',            exampleValue: 'הערות נוספות' },
    ],
  },
];

const INITIAL_BUTTONS = [
  {
    name: 'מערכת',
    type: 'questionnaire',
    icon: '🗂️',
    color: '#1a3a6b',
    displayOrder: 0,
    subjects: SYSTEM_BUTTON_SUBJECTS,
  },
  {
    name: 'רכיבים',
    type: 'documents',
    documentType: 'components',
    icon: '🔧',
    color: '#2554a3',
    displayOrder: 1,
  },
  {
    name: 'אינטגרציה',
    type: 'documents',
    documentType: 'integration',
    icon: '🔗',
    color: '#1a3a6b',
    displayOrder: 2,
  },
  {
    name: 'סיווג',
    type: 'questionnaire',
    icon: '🏷️',
    color: '#5a6a7e',
    displayOrder: 3,
  },
];

// ── Migration helper ──────────────────────────────────────────────────────

async function migrateSystemData(systemButton, fieldKeyToId) {
  const allSystemData = await SystemData.findAll();
  let migrated = 0;
  let skipped = 0;

  for (const sd of allSystemData) {
    const existing = await NavResponse.findOne({ where: { systemId: sd.systemId, buttonId: systemButton.id } });
    if (existing) { skipped++; continue; }

    const data = {};
    for (const [legacyKey, fieldId] of Object.entries(fieldKeyToId)) {
      const raw = sd[legacyKey];
      if (raw === null || raw === undefined) continue;

      if (legacyKey === 'hasDocumentation') {
        data[fieldId] = raw ? 'true' : 'false';
      } else if (Array.isArray(raw)) {
        data[fieldId] = raw;
      } else if (raw !== '') {
        data[fieldId] = String(raw);
      }
    }

    await NavResponse.create({ systemId: sd.systemId, buttonId: systemButton.id, data, updatedBy: null });
    migrated++;
  }

  console.log(`  ↳ SystemData migration: ${migrated} migrated, ${skipped} skipped (already existed)`);
}

// ── Main seed ─────────────────────────────────────────────────────────────

async function seed() {
  await sequelize.sync();
  console.log('🌱 seedNav starting…');

  const existing = await NavButton.count();
  if (existing > 0) {
    console.log(`  ℹ️  NavButton table already has ${existing} rows — skipping button creation.`);
    console.log('  ✅ seedNav done (nothing to do).');
    return;
  }

  // legacyKey → fieldId map, built while creating fields
  const fieldKeyToId = {};

  for (const btnDef of INITIAL_BUTTONS) {
    const { subjects, ...btnData } = btnDef;
    const button = await NavButton.create(btnData);
    console.log(`  ✔ NavButton: ${button.name} (${button.type})`);

    if (!subjects) continue;

    for (let si = 0; si < subjects.length; si++) {
      const subDef = subjects[si];
      const subject = await NavSubject.create({
        buttonId: button.id,
        name: subDef.name,
        icon: subDef.icon,
        displayOrder: si,
      });

      for (let fi = 0; fi < subDef.fields.length; fi++) {
        const fDef = subDef.fields[fi];
        const field = await NavField.create({
          subjectId: subject.id,
          name: fDef.name,
          type: fDef.type,
          exampleValue: fDef.exampleValue ?? null,
          isRequired: false,
          displayOrder: fi,
        });

        if (fDef.options?.length) {
          await NavFieldOption.bulkCreate(
            fDef.options.map((o, oi) => ({ fieldId: field.id, label: o.label, value: o.value, displayOrder: oi }))
          );
        }

        if (fDef.legacyKey) {
          fieldKeyToId[fDef.legacyKey] = field.id;
        }
      }

      console.log(`    ✔ Subject: ${subject.name} (${subDef.fields.length} fields)`);
    }

    // Migrate existing SystemData into NavResponse for the "מערכת" button
    if (button.name === 'מערכת') {
      await migrateSystemData(button, fieldKeyToId);
    }
  }

  console.log('✅ seedNav complete.');
}

seed()
  .catch(err => { console.error('❌ seedNav failed:', err); process.exit(1); })
  .finally(() => sequelize.close());
