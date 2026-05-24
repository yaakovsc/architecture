const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Diagram = sequelize.define('Diagram', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  systemId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('components', 'integration'),
    allowNull: false,
  },
  filename: { type: DataTypes.STRING, allowNull: false },
  originalName: { type: DataTypes.STRING },
  mimetype: { type: DataTypes.STRING },
  size: { type: DataTypes.INTEGER },
  uploadedBy: { type: DataTypes.UUID },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Diagram;
