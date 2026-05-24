const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const NavSubject = sequelize.define('NavSubject', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  buttonId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  icon: {
    type: DataTypes.STRING,
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});

module.exports = NavSubject;
