const { Client, LocalAuth } = require('whatsapp-web.js');
const logger = require('../config/logger');
const qrcode = require('qrcode-terminal');
const axios = require('axios'); // For referral token validation
const { handleState, initializeUserState } = require('../utils/stateManager');
const { STATES } = require('../config/constants');

const { TEMP_REFERRAL_API_URL } = process.env; // Ensure this is in your .env file

// Initialize WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage', 
      '--disable-extensions', 
      '--disable-gpu', 
      '--no-zygote', 
      '--single-process',
    ],
    handleSIGINT: false,
  },
});

// QR Code Event
client.on('qr', (qr) => {
  logger.info('QR Code received. Scan it with your WhatsApp app.');
  console.log('QR Code received, displaying below:'); // Additional log for clarity
  qrcode.generate(qr, { small: true }); // Ensure QR code appears in the terminal
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
  logger.info('Reinitializing WhatsApp client...');
  client.initialize().catch(err => {
    logger.error('Failed to reinitialize after disconnect:', err);
  });
});

// Message Event
client.on('message', async (msg) => {
  const chatId = msg.from;
  const message = msg.body.trim();

  const maskedChatId = chatId.replace(/(\d{4})$/, '**');
  logger.info(`Message received from ${maskedChatId}: ${message}`);

  try {
    const userState = initializeUserState(chatId);

    // Handle referral token validation
    if (message.startsWith('ref:')) {
      const token = message.replace('ref:', '').trim();
      logger.info(`[DEBUG] Referral token detected: ${token}`);

      try {
        const response = await axios.get(`${TEMP_REFERRAL_API_URL}/validate/${token}`);
        const referralCode = response.data.referral_code;

        logger.info(`[DEBUG] Referral token valid. Referral code: ${referralCode}`);
        userState.data.referral_code = referralCode;

        await client.sendMessage(chatId, `Referral code ${referralCode} has been linked to your profile.`);
      } catch (error) {
        logger.error(`[ERROR] Failed to validate referral token: ${error.message}`);
        await client.sendMessage(chatId, 'Invalid or expired referral token. Please try again.');
        return;
      }
    }

    // Handle restart command
    if (message.toLowerCase() === 'restart') {
      userState.state = STATES.GET_STARTED;
      userState.data = {};
      logger.info(`User state reset for ${maskedChatId}`);
      return await handleState(userState, chatId, message, client);
    }

    // Handle user state
    await handleState(userState, chatId, message, client);
  } catch (err) {
    logger.error(`Error processing message from ${maskedChatId}:`, {
      error: err.message,
      stack: err.stack,
      state: userState?.state,
    });

    const errorMessage = 'Sorry, something went wrong. Please type "restart" to start over.';
    await client.sendMessage(chatId, errorMessage).catch(sendErr => {
      logger.error(`Failed to send error message to ${maskedChatId}:`, sendErr);
    });
  }
});

// Initialize WhatsApp Client
const initializeWhatsApp = async () => {
  console.log('initializeWhatsApp function called'); // Debug log
  try {
    logger.info('Initializing WhatsApp client...');
    await client.initialize();
  } catch (err) {
    logger.error('Failed to initialize WhatsApp client:', err);
    throw err;
  }
};

// Graceful Shutdown
const handleShutdown = async () => {
  logger.info('Shutting down WhatsApp client...');
  try {
    await client.destroy();
    logger.info('WhatsApp client shut down successfully.');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

module.exports = { 
  initializeWhatsApp,
  handleShutdown,
};
