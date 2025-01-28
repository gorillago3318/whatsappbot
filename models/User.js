// models/User.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/dbConfig');

const User = sequelize.define('User', {
  messengerId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true, // Allow null for name
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  referral_code: {
    type: DataTypes.STRING,
    allowNull: true, // Optional
  },
  originalLoanAmount: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  originalLoanTenure: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  currentRepayment: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  monthlySavings: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  yearlySavings: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  lifetimeSavings: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  lastInteraction: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = User;