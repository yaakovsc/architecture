const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const System = sequelize.define('System', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'Unique identifier key for diagram hotspot mapping',
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // Position on diagram (percentage-based)
  posX: { type: DataTypes.FLOAT, defaultValue: 0 },
  posY: { type: DataTypes.FLOAT, defaultValue: 0 },
  width: { type: DataTypes.FLOAT, defaultValue: 10 },
  height: { type: DataTypes.FLOAT, defaultValue: 5 },
  color: { type: DataTypes.STRING, defaultValue: '#2554a3' },
  status: {
    type: DataTypes.ENUM('active', 'disabled'),
    defaultValue: 'active',
    allowNull: false,
  },
  displayOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
});

module.exports = System;
