const axios = require('axios');
const logger = require('../config/logger');

// WhatsApp Cloud API Configuration
const apiUrl = process.env.WHATSAPP_API_URL; // Base API URL
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN; // Your access token

// Function to send a message
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

// Process Webhook Events
const processWebhookEvent = async (req, res) => {
  try {
    const body = req.body;

    // Ensure it's a WhatsApp webhook event
    if (body.object === 'whatsapp_business_account') {
      body.entry.forEach((entry) => {
        entry.changes.forEach((change) => {
          if (change.value.messages) {
            change.value.messages.forEach(async (message) => {
              const from = message.from; // Sender's phone number
              const text = message.text.body; // Message content
              logger.info(`Message from ${from}: ${text}`);
              // Add custom handling logic here
            });
          }
        });
      });
      res.status(200).send('Event received');
    } else {
      res.status(404).send('Not a WhatsApp webhook event');
    }
  } catch (err) {
    logger.error(`[ERROR] Failed to process webhook: ${err.message}`);
    res.status(500).send('Internal Server Error');
  }
};

module.exports = { sendMessage, processWebhookEvent };
