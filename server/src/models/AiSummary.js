const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Stores the synthesized CTO-level Markdown report for a system.
 * One record per system (upserted on each analysis run).
 */
const AiSummary = sequelize.define('AiSummary', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  systemId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
  },
  // Full Markdown CTO report
  content: {
    type: DataTypes.TEXT,
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'ready', 'error'),
    defaultValue: 'pending',
    allowNull: false,
  },
  // Human-readable error (shown to user on failure)
  errorMessage: {
    type: DataTypes.STRING,
  },
  // Current analysis stage — updated by worker during processing
  progress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // Number of file fragments used in the last synthesis
  fragmentCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  processedAt: {
    type: DataTypes.DATE,
  },
});

module.exports = AiSummary;
