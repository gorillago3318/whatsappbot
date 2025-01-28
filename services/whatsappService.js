const axios = require('axios');
const logger = require('../config/logger');
const { handleState, initializeUserState } = require('../utils/stateManager');
const { STATES } = require('../config/constants');
const User = require('../models/User');

// WhatsApp Cloud API URLs and Token
const apiUrl = process.env.WHATSAPP_API_URL;
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

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

// Send dynamic referral button
const sendReferralButton = async (recipientId, referralCode) => {
  try {
    const response = await axios.post(
      apiUrl,
      {
        messaging_product: 'whatsapp',
        to: recipientId,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: `Hi! You were referred by code ${referralCode}. Please confirm your referral.`,
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: referralCode,
                  title: 'Confirm Referral',
                },
              },
            ],
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log(`[INFO] Referral button sent to ${recipientId} with code: ${referralCode}`);
  } catch (err) {
    console.error(`[ERROR] Failed to send referral button to ${recipientId}: ${err.message}`);
  }
};

const handleIncomingMessage = async (message, refCode) => {
  const chatId = message.from;

  if (!message.text || !message.text.body) {
    logger.warn(`[WARN] Received a non-text message from ${chatId}`);
    return;
  }

  const text = message.text.body.trim();
  const maskedChatId = chatId.replace(/(\d{4})$/, '**');
  logger.info(`Message received from ${maskedChatId}: ${text}`);

  try {
    // Extract referral code from the message
    let referralCode = null;
    const referralPrefix = 'Please send this message to activate your case number:';
    if (text.startsWith(referralPrefix)) {
      referralCode = text.replace(referralPrefix, '').trim(); // Extract the code after the prefix
    } else if (text.startsWith('ref:')) {
      referralCode = text.replace('ref:', '').trim(); // For simpler referral codes
    }

    if (referralCode) {
      logger.info(`[INFO] Referral code detected in message: ${referralCode}`);

      try {
        // Save referral code to the Users table
        let user = await User.findOne({ where: { messengerId: chatId } });
        if (user) {
          if (!user.referral_code) {
            await user.update({ referral_code: referralCode });
            logger.info(`[INFO] Updated referral code for existing user: ${maskedChatId}`);
          } else {
            logger.info(`[INFO] User already has a referral code: ${user.referral_code}`);
          }
        } else {
          await User.create({
            messengerId: chatId,
            referral_code: referralCode,
            name: null, // Allow null names to avoid conflicts
            phoneNumber: null, // Optional placeholder
          });
          logger.info(`[INFO] New user created with referral code: ${referralCode}`);
        }
      } catch (dbError) {
        logger.error(`[ERROR] Failed to save referral code for chatId: ${chatId}`, dbError.message);
      }
    }

    // Initialize or retrieve the user's state
    const userState = initializeUserState(chatId, { ref: refCode });

    logger.debug(`[DEBUG] Referral code passed to userState: ${refCode || 'None'}`);

    // Handle the restart command
    if (text.toLowerCase() === 'restart') {
      userState.state = STATES.GET_STARTED;
      userState.data = {};
      logger.info(`[INFO] User state reset for ${maskedChatId}`);
      return await handleState(userState, chatId, text, sendMessage);
    }

    // Proceed directly to the welcome message
    if (referralCode) {
      await handleState(userState, chatId, 'GET_STARTED', sendMessage);
      return;
    }

    // Default user state handling (conversation flow)
    await handleState(userState, chatId, text, sendMessage);
  } catch (err) {
    logger.error(`[ERROR] Failed to process message from ${maskedChatId}: ${err.message}`);
    const errorMessage = 'Sorry, something went wrong. Please type "restart" to start over.';
    await sendMessage(chatId, errorMessage).catch(sendErr =>
      logger.error(`[ERROR] Failed to send error message to ${maskedChatId}: ${sendErr.message}`)
    );
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
        const chatId = message.from;

        // Debug incoming message payload
        console.log(`[DEBUG] Incoming Webhook Payload:`, JSON.stringify(message, null, 2));

        // Extract referral code from the user's pre-filled message (e.g., "ref:REF-5A559DFF")
        const text = message.text?.body?.trim();
        const referralCode = text?.startsWith('ref:') ? text.replace('ref:', '').trim() : null;

        // Log referral code if found
        if (referralCode) {
          console.log(`[DEBUG] Referral code detected in user message: ${referralCode}`);
        } else {
          console.warn(`[WARN] No referral code found in message from chatId: ${chatId}`);
        }

        // Initialize user state with referral code (store temporarily)
        const userState = initializeUserState(chatId, { ref: referralCode });
        console.log(`[DEBUG] User state initialized with referral code: ${userState.data.referral_code}`);

        // Process incoming message
        try {
          await handleIncomingMessage(message, referralCode);
        } catch (err) {
          console.error(`[ERROR] Failed to process message for chatId: ${chatId}`, err.message);
        }
      }

      res.status(200).send('Event received');
    } else {
      console.warn('[WARN] Received a non-WhatsApp webhook event');
      res.status(404).send('Not a WhatsApp webhook');
    }
  } catch (err) {
    console.error('Error processing webhook:', err.message);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = {
  sendMessage,
  processWebhookEvent,
};
