const axios = require('axios');
const logger = require('../config/logger');
const { handleState, initializeUserState } = require('../utils/stateManager');
const { STATES } = require('../config/constants');
const User = require('../models/User'); // Added import for User model

// WhatsApp Cloud API URLs and Token
const apiUrl = process.env.WHATSAPP_API_URL; // e.g., https://graph.facebook.com/v14.0/YOUR_PHONE_NUMBER_ID/messages
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN; // Access token from Meta Cloud API

// Validate environment variables
if (!apiUrl || !accessToken) {
  logger.error('❌ Missing required environment variables: WHATSAPP_API_URL or WHATSAPP_ACCESS_TOKEN');
  process.exit(1);
}

// Send a message using WhatsApp Cloud API
const sendMessage = async (recipientId, message) => {
  try {
    const response = await axios.post(
      apiUrl,
      {
        messaging_product: 'whatsapp',
        to: recipientId,
        type: 'text',
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info(`[INFO] Message sent to ${recipientId}: ${message}`);
    return response.data;
  } catch (err) {
    logger.error(`[ERROR] Failed to send message to ${recipientId}: ${err.message}`);
    throw err;
  }
};

// Handle incoming messages
const handleIncomingMessage = async (message) => {
  const chatId = message.from; // Sender's phone number

  if (!message.text || !message.text.body) {
    logger.warn(`[WARN] Received a non-text message from ${chatId}`);
    return;
  }

  const text = message.text.body.trim(); // Message text
  const maskedChatId = chatId.replace(/(\d{4})$/, '**');
  logger.info(`Message received from ${maskedChatId}: ${text}`);

  try {
    // Initialize or retrieve the user's state
    const userState = initializeUserState(chatId);

    // Automatically detect and save referral code from the first message
    if (text.startsWith('ref:')) {
      const referralCode = text.replace('ref:', '').trim();
      logger.info(`[INFO] Referral code detected: ${referralCode}`);

      // Save referral code to the Users table
      let user = await User.findOne({ where: { chatId } });
      if (user) {
        await user.update({ referral_code: referralCode });
        logger.info(`[INFO] Updated referral code for existing user: ${maskedChatId}`);
      } else {
        await User.create({ chatId, referral_code: referralCode });
        logger.info(`[INFO] New user created with referral code: ${maskedChatId}`);
      }

      // Confirm referral code to the user
      await sendMessage(chatId, `Referral code "${referralCode}" has been linked to your profile.`);
      return; // End processing for the current message
    }

    // Handle the restart command
    if (text.toLowerCase() === 'restart') {
      userState.state = STATES.GET_STARTED;
      userState.data = {};
      logger.info(`[INFO] User state reset for ${maskedChatId}`);
      return await handleState(userState, chatId, text, sendMessage);
    }

    // Default user state handling (conversation flow)
    await handleState(userState, chatId, text, sendMessage);
  } catch (err) {
    logger.error(`[ERROR] Failed to process message from ${maskedChatId}: ${err.message}`);

    const errorMessage = 'Sorry, something went wrong. Please type "restart" to start over.';
    await sendMessage(chatId, errorMessage).catch((sendErr) => {
      logger.error(`[ERROR] Failed to send error message to ${maskedChatId}: ${sendErr.message}`);
    });
  }
};

// Webhook for WhatsApp Cloud API
const processWebhookEvent = async (req, res) => {
  try {
    const body = req.body;

    // Ensure this is a WhatsApp webhook event
    if (body.object === 'whatsapp_business_account' && body.entry) {
      const messages = body.entry.flatMap(entry =>
        entry.changes.flatMap(change => change.value.messages || [])
      );

      for (const message of messages) {
        await handleIncomingMessage(message);
      }

      res.status(200).send('Event received');
    } else {
      res.status(404).send('Not a WhatsApp webhook');
    }
  } catch (err) {
    logger.error('Error processing webhook:', err.message);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  sendMessage,
  processWebhookEvent,
};
