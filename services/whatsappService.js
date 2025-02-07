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
    logger.info(`[INFO] Referral button sent to ${recipientId} with code: ${referralCode}`);
  } catch (err) {
    logger.error(`[ERROR] Failed to send referral button to ${recipientId}: ${err.message}`);
  }
};

// Handle incoming messages
const handleIncomingMessage = async (message) => {
  const chatId = message.from;

  if (!message.text || !message.text.body) {
    logger.warn(`[WARN] Received a non-text message from ${chatId}`);
    return;
  }

  const text = message.text.body.trim();
  const maskedChatId = chatId.replace(/(\d{4})$/, '**');
  logger.info(`Message received from ${maskedChatId}: ${text}`);

  try {
    // Extract referral code from the message (if exists)
    let referralCode = null;
    if (text.toLowerCase().startsWith('ref:')) {
      referralCode = text.replace(/ref:/i, '').trim();
      logger.info(`[INFO] Detected referral code: ${referralCode}`);
    }

    // Retrieve or create user state
    let userState = initializeUserState(chatId, referralCode ? `ref=${referralCode}` : '');

    // ✅ Fetch existing user from DB to check if referral already exists
    let user = await User.findOne({ where: { messengerId: chatId } });

    if (referralCode) {
      // ✅ Store referral in userState
      userState.data.referral_code = referralCode;

      // ✅ Save or update the referral in the database
      if (user) {
        if (!user.referral_code) {
          await user.update({ referral_code: referralCode });
          logger.info(`[INFO] Updated referral code for existing user: ${maskedChatId}`);
        }
      } else {
        await User.create({
          messengerId: chatId,
          referral_code: referralCode,
          name: null,
          phoneNumber: null,
        });
        logger.info(`[INFO] New user created with referral code: ${maskedChatId}`);
      }
    } else {
      // ✅ If no referral found in message, check if user already has a referral
      if (user && user.referral_code) {
        userState.data.referral_code = user.referral_code;
        logger.info(`[INFO] Retrieved referral code from DB: ${user.referral_code} for ${maskedChatId}`);
      }
    }

    // Handle the restart command
    if (text.toLowerCase() === 'restart') {
      userState.state = STATES.GET_STARTED;
      userState.data = {};
      logger.info(`[INFO] User state reset for ${maskedChatId}`);
      return await handleState(userState, chatId, text, sendMessage);
    }

    // Proceed directly to the welcome message if referral code is received
    if (referralCode) {
      await handleState(userState, chatId, 'GET_STARTED', sendMessage);
      return;
    }

    // Default user state handling (conversation flow)
    await handleState(userState, chatId, text, sendMessage);
  } catch (err) {
    logger.error(`[ERROR] Failed to process message from ${maskedChatId}: ${err.message}`);
    await sendMessage(chatId, 'Sorry, something went wrong. Please type "restart" to start over.');
  }
};


// Webhook for WhatsApp Cloud API
const processWebhookEvent = async (req, res) => {
  try {
    const body = req.body;

    if (!body.object || body.object !== 'whatsapp_business_account' || !body.entry) {
      logger.warn('[WARN] Received a non-WhatsApp webhook event');
      return res.status(404).send('Not a WhatsApp webhook');
    }

    // Extract messages from webhook payload
    const messages = body.entry.flatMap(entry =>
      entry.changes.flatMap(change => change.value.messages || [])
    );

    if (!messages.length) {
      logger.warn('[WARN] No messages found in webhook payload.');
      return res.status(200).send('No messages to process');
    }

    for (const message of messages) {
      const chatId = message.from;

      // Debug incoming message payload
      logger.debug(`[DEBUG] Incoming Webhook Payload:`, JSON.stringify(message, null, 2));

      // Extract referral code
      const text = message.text?.body?.trim();
      const referralCode = text?.toLowerCase().startsWith('ref:') ? text.replace(/ref:/i, '').trim() : null;

      if (referralCode) {
        logger.info(`[INFO] Referral code detected: ${referralCode}`);
      }

      // ✅ Initialize user state with referral code
      let userState = initializeUserState(chatId, referralCode ? `ref=${referralCode}` : '');

      try {
        // ✅ Ensure referral is stored immediately in DB
        let user = await User.findOne({ where: { messengerId: chatId } });

        if (referralCode) {
          userState.data.referral_code = referralCode;

          if (user) {
            if (!user.referral_code) {
              await user.update({ referral_code: referralCode });
              logger.info(`[INFO] Updated referral code for existing user: ${chatId}`);
            }
          } else {
            await User.create({
              messengerId: chatId,
              referral_code: referralCode,
              name: null,
              phoneNumber: null,
            });
            logger.info(`[INFO] New user created with referral code: ${chatId}`);
          }
        }

        await handleIncomingMessage(message);
      } catch (err) {
        logger.error(`[ERROR] Failed to process message for chatId: ${chatId}: ${err.message}`);
      }
    }

    res.status(200).send('Event received');
  } catch (err) {
    logger.error('[ERROR] Error processing webhook:', err.message);
    res.status(500).send('Internal Server Error');
  }
};


module.exports = {
  sendMessage,
  processWebhookEvent,
};
