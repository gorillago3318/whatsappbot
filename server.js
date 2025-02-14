const express = require('express');
const path = require('path'); // Added for serving static files
const dotenvConfig = require('./config/dotenvConfig');
const sequelize = require('./config/dbConfig');
const logger = require('./config/logger');
const chatbotRoutes = require('./routes/chatbotRoutes');
const { processWebhookEvent } = require('./services/whatsappService'); // For handling webhook events

// Validate Environment Variables
const validateEnvVars = () => {
  const requiredVars = [
    'DATABASE_URL',
    'PORT',
    'WHATSAPP_API_URL',
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_VERIFY_TOKEN'
  ];
  const missingVars = requiredVars.filter((varName) => !process.env[varName]);

  if (missingVars.length > 0) {
    logger.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }
};
validateEnvVars();

const app = express();
app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

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

// WhatsApp Webhook Routes
app.post('/webhook', async (req, res) => {
  try {
    await processWebhookEvent(req, res);
  } catch (err) {
    logger.error(`[ERROR] Failed to process webhook: ${err.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// WhatsApp Webhook Verification
app.get('/webhook', (req, res) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('✅ Webhook verified successfully.');
      res.status(200).send(challenge);
    } else {
      logger.error('❌ Webhook verification failed.');
      res.status(403).send('Verification failed.');
    }
  } else {
    res.status(400).send('Bad Request');
  }
});

// Chatbot Routes
app.use('/chatbot', chatbotRoutes);

// Fallback: For any route not handled above, serve the index.html from public folder
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// Start Server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
});
