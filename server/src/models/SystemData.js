const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SystemData = sequelize.define('SystemData', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  systemId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // Basic Info
  systemName: { type: DataTypes.STRING },
  alias: { type: DataTypes.STRING },
  businessDomain: { type: DataTypes.STRING },
  systemOwner: { type: DataTypes.STRING },
  vendor: { type: DataTypes.STRING },
  version: { type: DataTypes.STRING },
  deploymentYear: { type: DataTypes.INTEGER },
  // Service Type
  serviceType: { type: DataTypes.STRING },
  serviceSubtype: { type: DataTypes.STRING },
  // Criticality
  criticality: {
    type: DataTypes.ENUM('critical', 'high', 'medium', 'low'),
    defaultValue: 'medium',
  },
  // Integrations
  upstreamSystems: { type: DataTypes.JSONB, defaultValue: [] },
  downstreamSystems: { type: DataTypes.JSONB, defaultValue: [] },
  protocols: { type: DataTypes.JSONB, defaultValue: [] },
  integrationFrequency: { type: DataTypes.STRING },
  // Tech Stack
  appServer: { type: DataTypes.STRING },
  database: { type: DataTypes.STRING },
  loadBalancer: { type: DataTypes.STRING },
  firewall: { type: DataTypes.STRING },
  loggingSystem: { type: DataTypes.STRING },
  // SLA
  rto: { type: DataTypes.STRING },
  rpo: { type: DataTypes.STRING },
  sla: { type: DataTypes.STRING },
  availability: { type: DataTypes.STRING },
  // Documentation
  hasDocumentation: { type: DataTypes.BOOLEAN, defaultValue: false },
  documentationUrl: { type: DataTypes.STRING },
  notes: { type: DataTypes.TEXT },
  // Metadata
  lastUpdatedBy: { type: DataTypes.UUID },
});

module.exports = SystemData;
