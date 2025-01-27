const express = require('express');
const router = express.Router();
require('dotenv').config(); // Ensure your .env file is loaded

// Verification Endpoint (GET)
router.get('/', (req, res) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  // Verify webhook request
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.error('Verification failed. Tokens do not match.');
      res.status(403).send('Verification failed');
    }
  } else {
    res.status(400).send('Bad Request');
  }
});

// Event Listener Endpoint (POST)
router.post('/', (req, res) => {
  try {
    const body = req.body;

    // Ensure this is a WhatsApp webhook event
    if (body.object === 'whatsapp_business_account') {
      console.log('Webhook event:', JSON.stringify(body, null, 2));

      // Process incoming messages or other events here
      if (body.entry) {
        body.entry.forEach(entry => {
          entry.changes.forEach(change => {
            if (change.value.messages) {
              change.value.messages.forEach(message => {
                const from = message.from; // Sender phone number
                const text = message.text.body; // Message text
                console.log(`Received message from ${from}: ${text}`);

                // You can process the message or send a response here
              });
            }
          });
        });
      }

      res.status(200).send('Event received');
    } else {
      res.status(404).send('Not a WhatsApp webhook');
    }
  } catch (err) {
    console.error('Error processing webhook:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
 
