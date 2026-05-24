const sequelize = require('../config/database');
const User = require('./User');
const System = require('./System');
const SystemData = require('./SystemData');
const Diagram = require('./Diagram');
const NavButton = require('./NavButton');
const NavSubject = require('./NavSubject');
const NavField = require('./NavField');
const NavFieldOption = require('./NavFieldOption');
const NavResponse = require('./NavResponse');
const AiFragment = require('./AiFragment');
const AiSummary = require('./AiSummary');
const EnterpriseSummary = require('./EnterpriseSummary');
const AiConfig = require('./AiConfig');

// ── Existing associations ──────────────────────────────────────────────────
System.hasOne(SystemData, { foreignKey: 'systemId', as: 'data' });
SystemData.belongsTo(System, { foreignKey: 'systemId' });

System.hasMany(Diagram, { foreignKey: 'systemId', as: 'diagrams' });
Diagram.belongsTo(System, { foreignKey: 'systemId' });

// ── Nav hierarchy ──────────────────────────────────────────────────────────
NavButton.hasMany(NavSubject, { foreignKey: 'buttonId', as: 'subjects', onDelete: 'CASCADE', hooks: true });
NavSubject.belongsTo(NavButton, { foreignKey: 'buttonId' });

NavSubject.hasMany(NavField, { foreignKey: 'subjectId', as: 'fields', onDelete: 'CASCADE', hooks: true });
NavField.belongsTo(NavSubject, { foreignKey: 'subjectId' });

NavField.hasMany(NavFieldOption, { foreignKey: 'fieldId', as: 'options', onDelete: 'CASCADE', hooks: true });
NavFieldOption.belongsTo(NavField, { foreignKey: 'fieldId' });

// ── Nav responses ──────────────────────────────────────────────────────────
NavResponse.belongsTo(System, { foreignKey: 'systemId' });
System.hasMany(NavResponse, { foreignKey: 'systemId', as: 'navResponses' });
NavResponse.belongsTo(NavButton, { foreignKey: 'buttonId' });

// ── AI tables ──────────────────────────────────────────────────────────────
AiFragment.belongsTo(System,  { foreignKey: 'systemId' });
System.hasMany(AiFragment,    { foreignKey: 'systemId', as: 'aiFragments', onDelete: 'CASCADE', hooks: true });

AiFragment.belongsTo(Diagram, { foreignKey: 'diagramId', constraints: false });

AiSummary.belongsTo(System,   { foreignKey: 'systemId' });
System.hasOne(AiSummary,      { foreignKey: 'systemId', as: 'aiSummary', onDelete: 'CASCADE', hooks: true });

module.exports = {
  sequelize,
  User, System, SystemData, Diagram,
  NavButton, NavSubject, NavField, NavFieldOption, NavResponse,
  AiFragment, AiSummary, EnterpriseSummary, AiConfig,
};
