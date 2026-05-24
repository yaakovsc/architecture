'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Single-row singleton table for the enterprise-level AI report.
 * Use findOrCreate with a fixed id='enterprise' to ensure only one row.
 */
const EnterpriseSummary = sequelize.define('EnterpriseSummary', {
  id: {
    type: DataTypes.STRING(32),
    primaryKey: true,
    defaultValue: 'enterprise',
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('none', 'pending', 'processing', 'ready', 'error'),
    defaultValue: 'none',
    allowNull: false,
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  systemCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // Current analysis stage — updated by worker during processing
  progress: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  processedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'enterprise_summaries',
  timestamps: true,
});

module.exports = EnterpriseSummary;
