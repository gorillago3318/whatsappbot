const express = require('express');
const dotenvConfig = require('./config/dotenvConfig');
const sequelize = require('./config/dbConfig');
const logger = require('./config/logger');
const chatbotRoutes = require('./routes/chatbotRoutes'); // Chatbot-specific routes
const { initializeWhatsApp, handleShutdown } = require('./services/whatsappService');

const app = express();
app.use(express.json());

const PORT = dotenvConfig.PORT || 3000;

require('dotenv').config(); // Default behavior loads `.env` in the current working directory

// Validate required environment variables (remove if not necessary)
if (!dotenvConfig.TEMP_REFERRAL_API_URL) {
  logger.warn('⚠️ TEMP_REFERRAL_API_URL is not set. Ensure this is intentional.');
}

// Database connection check
sequelize.authenticate()
  .then(() => logger.info('✅ Database connected successfully.'))
  .catch((err) => logger.error(`❌ Database connection failed: ${err.message}`));

// Sync Database
sequelize.sync({ alter: true }) // Use alter for syncing schema without dropping data
  .then(() => {
    logger.info('✅ Database schema synced successfully.');
  })
  .catch((err) => {
    logger.error(`❌ Error syncing database: ${err.message}`);
  });

// Initialize WhatsApp Client
try {
  initializeWhatsApp();
} catch (err) {
  logger.error(`❌ Error initializing WhatsApp client: ${err.message}`);
}

// Test Route
app.get('/', (req, res) => {
  res.send('Server and WhatsApp Bot are running!');
});

// Health Check Route
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error('❌ Health check failed:', error.message);
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Chatbot Routes
app.use('/chatbot', chatbotRoutes); // Only chatbot routes are used

// Graceful Shutdown
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

// Start Server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
});
