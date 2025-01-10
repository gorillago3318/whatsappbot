const express = require('express');
const dotenvConfig = require('./config/dotenvConfig');
const sequelize = require('./config/dbConfig');
const logger = require('./config/logger');
const chatbotRoutes = require('./routes/chatbotRoutes');
const { initializeWhatsApp } = require('./services/whatsappService');

const app = express();
app.use(express.json());

const PORT = dotenvConfig.PORT || 3000;

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
initializeWhatsApp();

// Test Route
app.get('/', (req, res) => {
  res.send('Server and WhatsApp Bot are running!');
});

// Chatbot Routes
app.use('/chatbot', chatbotRoutes);

// Start Server
app.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
});
