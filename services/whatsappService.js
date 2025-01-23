const { Client, LocalAuth } = require('whatsapp-web.js');
const logger = require('../config/logger');
const qrcode = require('qrcode-terminal');
const axios = require('axios'); // For referral token validation
const { handleState, initializeUserState } = require('../utils/stateManager');
const { STATES } = require('../config/constants');
const { LEADS_API_URL } = process.env;
const { TEMP_REFERRAL_API_URL } = process.env; // Ensure this is in your .env file

// Initialize WhatsApp Client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: '/usr/bin/chromium-browser', // Path to the system-installed Chromium
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
    // Initialize or retrieve the user's state
    const userState = initializeUserState(chatId);

    // Handle referral code if the message starts with `ref:`
    if (message.startsWith('ref:')) {
      const token = message.replace('ref:', '').trim();
      logger.info(`[DEBUG] Referral token detected: ${token}`);

      try {
        // Validate the referral token using the API
        const response = await axios.get(`${TEMP_REFERRAL_API_URL}/validate/${token}`);
        if (response.data && response.data.referral_code) {
          const referralCode = response.data.referral_code;

          logger.info(`[INFO] Referral token is valid. Referral code: ${referralCode}`);
          userState.data.referral_code = referralCode;

          // Inform the user that the referral code has been linked
          await client.sendMessage(chatId, `Referral code "${referralCode}" has been successfully linked to your profile.`);
        } else {
          logger.warn(`[WARN] Invalid referral token: ${token}`);
          await client.sendMessage(chatId, 'Invalid or expired referral token. Please try again.');
          return;
        }
      } catch (error) {
        logger.error(`[ERROR] Failed to validate referral token: ${error.message}`);
        await client.sendMessage(chatId, 'An error occurred while validating your referral token. Please try again later.');
        return;
      }
    }

    // Handle the restart command
    if (message.toLowerCase() === 'restart') {
      userState.state = STATES.GET_STARTED;
      userState.data = {};
      logger.info(`[INFO] User state reset for ${maskedChatId}`);
      return await handleState(userState, chatId, message, client);
    }

    // Handle the finish command to save user data
    if (message.toLowerCase() === 'finish') {
      try {
        await Users.create({
          phone_number: userState.data.phone_number,
          name: userState.data.name,
          referral_code: userState.data.referral_code || null,
        });
    
        logger.info(`[INFO] User data saved successfully for ${maskedChatId}`);
    
        // Optionally, notify an external API endpoint
        const leadData = {
          name: userState.data.name,
          phone_number: userState.data.phone_number,
          referral_code: userState.data.referral_code,
        };
    
        await axios.post(LEADS_API_URL, leadData);
        logger.info('[INFO] Lead successfully sent to external API');
      } catch (error) {
        logger.error(`[ERROR] Failed to save user data for ${maskedChatId}: ${error.message}`);
        await client.sendMessage(chatId, 'Something went wrong while saving your details. Please try again.');
      }
    
      return;
    }
    

    // Default user state handling
    await handleState(userState, chatId, message, client);
  } catch (err) {
    logger.error(`[ERROR] Failed to process message from ${maskedChatId}:`, {
      error: err.message,
      stack: err.stack,
      state: userState?.state,
    });

    const errorMessage = 'Sorry, something went wrong. Please type "restart" to start over.';
    await client.sendMessage(chatId, errorMessage).catch((sendErr) => {
      logger.error(`[ERROR] Failed to send error message to ${maskedChatId}:`, sendErr);
    });
  }
});

// Initialize WhatsApp Client
const initializeWhatsApp = async () => {
  logger.info('Initializing WhatsApp client...');
  try {
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
