const { DataTypes } = require('sequelize');
const sequelize = require('../config/dbConfig');

const BankRate = sequelize.define(
  'BankRate',
  {
    bankName: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Default Bank', // Ensure default value is set in Sequelize
      field: 'bankname', // Map to the existing "bankname" column
    },
    minAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'minamount',
    },
    maxAmount: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'maxamount',
    },
    interestRate: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'interestrate',
    },
  },
  {
    tableName: 'BankRates',
    timestamps: true,
  }
);

sequelize
  .sync({ alter: true }) // Align the Sequelize model with the database schema
  .then(() => {
    console.log('✅ Database synchronized successfully.');
  })
  .catch((err) => {
    console.error(`❌ Error syncing database: ${err.message}`);
  });

module.exports = BankRate;
