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

// Function to authenticate the agent and get a JWT token
async function getAgentToken(phone) {
  try {
    const response = await axios.post('https://qaichatbot.chat/api/auth/login', {
      phone: phone,
      password: "Admin!" // You might need a fixed password for first-time logins
    });

    return response.data.accessToken;
  } catch (error) {
    console.error('[ERROR] Failed to log in agent:', error.response ? error.response.data : error.message);
    return null;
  }
}

// Function to send lead data directly (No authentication)
async function sendLeadToPortal(name, phone, loanAmount, referrerCode) {
  try {
    console.log(`[DEBUG] Sending lead to portal: Name=${name}, Phone=${phone}, Loan=${loanAmount}, Ref=${referrerCode}`);

    const response = await axios.post('https://qaichatbot.chat/api/leads', {
      name,
      phone,
      loan_amount: loanAmount,
      referrer_code: referrerCode || null
    }, {
      headers: {
        "Content-Type": "application/json"
      }
    });

    console.log('[INFO] Lead sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('[ERROR] Failed to send lead:', error.response ? error.response.data : error.message);
    if (error.response) {
      console.error('[DEBUG] Full Error Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Modified: Now handleIncomingMessage accepts userState as a parameter
const handleIncomingMessage = async (message, userState) => {
  const chatId = message.from;

  if (!message.text || !message.text.body) {
    logger.warn(`[WARN] Received a non-text message from ${chatId}`);
    return;
  }

  const text = message.text.body.trim();
  const maskedChatId = chatId.replace(/(\d{4})$/, '**');
  logger.info(`[INFO] Message received from ${maskedChatId}: ${text}`);

  try {
    // ✅ Loan Processing Debug Logs
    if (text.toLowerCase().startsWith('loan:')) {
      console.log(`[DEBUG] Processing Loan Request: ${text}`);

      const details = text.replace(/loan:/i, '').trim().split(',');
      if (details.length < 3) {
        return sendMessage(chatId, '❌ Please provide loan details in this format: Loan: Name, Phone, LoanAmount, [Referral Code]');
      }

      const name = details[0].trim();
      const phone = details[1].trim();
      const loanAmount = parseFloat(details[2].trim());
      const referrerCode = details.length > 3 ? details[3].trim() : null;

      console.log(`[DEBUG] Extracted Loan Details: Name=${name}, Phone=${phone}, Loan=${loanAmount}, Ref=${referrerCode}`);

      sendMessage(chatId, '✅ Processing your loan request...');

      // Send lead to portal
      const leadResponse = await sendLeadToPortal(name, phone, loanAmount, referrerCode);
      if (leadResponse && leadResponse.lead) {
        console.log(`[INFO] Lead sent successfully, Assigned Agent: ${leadResponse.lead.assigned_agent_id}`);
        sendMessage(chatId, `🎉 Lead created successfully! Assigned Agent: ${leadResponse.lead.assigned_agent_id}`);
      } else {
        console.error(`[ERROR] Lead submission failed:`, leadResponse);
        sendMessage(chatId, '❌ Failed to create lead. Please try again later.');
      }
      return;
    }

    // Default user state handling (pass null for client if you don't have one)
    await handleState(userState, chatId, text, sendMessage, null);
  } catch (err) {
    logger.error(`[ERROR] Failed to process message from ${maskedChatId}: ${err.message}`);
    await sendMessage(chatId, '❌ Something went wrong. Please try again.');
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

      // Extract referral code (if the message starts with "ref:")
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

        // Pass the created userState to the message handler
        await handleIncomingMessage(message, userState);
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
