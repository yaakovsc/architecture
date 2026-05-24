const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NavFieldOption = sequelize.define('NavFieldOption', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  fieldId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  label: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // Stored value (defaults to label when not set). Allows label='קריטי', value='critical'.
  value: {
    type: DataTypes.STRING,
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

module.exports = NavFieldOption;
