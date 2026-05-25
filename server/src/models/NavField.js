const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NavField = sequelize.define('NavField', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  subjectId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  exampleValue: {
    type: DataTypes.STRING,
  },
  type: {
    type: DataTypes.ENUM('text', 'textarea', 'select', 'multi_value', 'multi_value_select'),
    allowNull: false,
    defaultValue: 'text',
  },
  isRequired: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  isHoverText: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

module.exports = NavField;
