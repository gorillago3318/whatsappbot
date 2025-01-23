const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL, // Ensure it matches the variable in .env
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PORTAL_API_URL: process.env.PORTAL_API_URL,
};
