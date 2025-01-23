const express = require('express');
const dotenvConfig = require('./config/dotenvConfig');
const sequelize = require('./config/dbConfig');
const logger = require('./config/logger');
const chatbotRoutes = require('./routes/chatbotRoutes');
const { initializeWhatsApp, handleShutdown } = require('./services/whatsappService');

// Validate Environment Variables
const validateEnvVars = () => {
  const requiredVars = ['DATABASE_URL', 'PORT'];
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }
};
validateEnvVars();

const app = express();
app.use(express.json());

const PORT = dotenvConfig.PORT || 3000;

// Log all incoming requests
app.use((req, res, next) => {
  logger.info(`[REQUEST] ${req.method} ${req.originalUrl}`);
  next();
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
app.use('/chatbot', chatbotRoutes);

// 404 Handler for Undefined Routes
app.use((req, res) => {
  logger.warn(`[404] Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handling
app.use((err, req, res, next) => {
  logger.error(`[ERROR] ${err.message}`);
  res.status(500).json({
    error: 'Internal Server Error',
    details: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
});

// Database Connection
sequelize.authenticate()
  .then(() => logger.info('✅ Database connected successfully.'))
  .catch((err) => logger.error(`❌ Database connection failed: ${err.message}`));

// Sync Database
sequelize.sync({ alter: true })
  .then(() => logger.info('✅ Database schema synced successfully.'))
  .catch((err) => logger.error(`❌ Error syncing database: ${err.message}`));

// Initialize WhatsApp Client
try {
  initializeWhatsApp();
} catch (err) {
  logger.error(`❌ Error initializing WhatsApp client: ${err.message}`);
}

// Graceful Shutdown
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

// Start Server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
});
