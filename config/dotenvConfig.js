const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PORTAL_API_URL: process.env.PORTAL_API_URL,
  TEMP_REFERRAL_API_URL: process.env.TEMP_REFERRAL_API_URL, // Add this
};