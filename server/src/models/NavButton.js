const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NavButton = sequelize.define('NavButton', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('questionnaire', 'documents'),
    allowNull: false,
  },
  // Only relevant when type = 'documents'. Values: 'components' | 'integration' | custom
  documentType: {
    type: DataTypes.STRING,
  },
  icon: {
    type: DataTypes.STRING,
    defaultValue: '📋',
  },
  color: {
    type: DataTypes.STRING,
    defaultValue: '#1a3a6b',
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = NavButton;
