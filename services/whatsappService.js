const { Client, LocalAuth } = require('whatsapp-web.js');
const logger = require('../config/logger');
const { handleState, initializeUserState } = require('../utils/stateManager');
const { STATES } = require('../config/constants');

// Initialize WhatsApp Client with better error handling
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    handleSIGINT: false, // Prevent Puppeteer from registering its own SIGINT handler
  }
});

// QR Code Event
client.on('qr', (qr) => {
  logger.info('QR Code received. Scan it with your WhatsApp app.');
});

// Ready Event
client.on('ready', () => {
  logger.info('✅ WhatsApp client is ready!');
});

// Authentication Failed Event
client.on('auth_failure', (msg) => {
  logger.error('WhatsApp authentication failed:', msg);
});

// Disconnected Event
client.on('disconnected', (reason) => {
  logger.warn('WhatsApp client disconnected:', reason);
  // Attempt to reconnect
  client.initialize().catch(err => {
    logger.error('Failed to reinitialize after disconnect:', err);
  });
});

// Message Event
client.on('message', async (msg) => {
  const chatId = msg.from;
  const message = msg.body.trim();
  
  // Log incoming message with masked phone number for privacy
  const maskedChatId = chatId.replace(/(\d{4})$/, '**');
  logger.info(`Message received from ${maskedChatId}: ${message}`);

  try {
    const userState = initializeUserState(chatId);

    // Handle restart command
    if (message.toLowerCase() === 'restart') {
      userState.state = STATES.GET_STARTED;
      userState.data = {};
      logger.info(`User state reset for ${maskedChatId}`);
      // Remove welcome message here to avoid double prompting
      return await handleState(userState, chatId, message, client);
    }

    // Handle the user's current state
    await handleState(userState, chatId, message, client);

  } catch (err) {
    logger.error(`Error processing message from ${maskedChatId}:`, {
      error: err.message,
      stack: err.stack,
      state: userState?.state,
    });

    // Send user-friendly error message
    const errorMessage = 'Sorry, something went wrong. Please type "restart" to start over.';
    await client.sendMessage(chatId, errorMessage).catch(sendErr => {
      logger.error(`Failed to send error message to ${maskedChatId}:`, sendErr);
    });
  }
});

// Initialize WhatsApp Client with error handling
const initializeWhatsApp = async () => {
  try {
    logger.info('Initializing WhatsApp client...');
    await client.initialize();
  } catch (err) {
    logger.error('Failed to initialize WhatsApp client:', err);
    throw err; // Re-throw to be handled by the calling code
  }
};

// Graceful shutdown handler
const handleShutdown = async () => {
  logger.info('Shutting down WhatsApp client...');
  try {
    await client.destroy();
    logger.info('WhatsApp client shut down successfully');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown:', err);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

module.exports = { 
  initializeWhatsApp,
  handleShutdown // Export for testing purposes
};