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
  logging: false, // Disable SQL logging for cleaner logs
});

sequelize.authenticate()
  .then(() => console.log('✅ Database connected successfully.'))
  .catch(err => console.error('❌ Unable to connect to the database:', err));

module.exports = sequelize;
