const { Sequelize } = require('sequelize');
const { DATABASE_URL } = require('./dotenvConfig');

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not defined. Check your .env file.');
}

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Accept self-signed certificates
    },
  },
  host: '[2001:d08:d9:41b:20d1:b9b1:35f8:ddc5]', // Use your IPv6 address here
  logging: false,
});

module.exports = sequelize;
