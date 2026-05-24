const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NavResponse = sequelize.define('NavResponse', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  systemId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  buttonId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  // { [fieldId: UUID]: string | string[] }
  data: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  updatedBy: {
    type: DataTypes.UUID,
  },
}, {
  indexes: [
    { unique: true, fields: ['systemId', 'buttonId'] },
  ],
});

module.exports = NavResponse;
