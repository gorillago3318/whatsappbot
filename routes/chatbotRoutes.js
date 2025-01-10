const express = require('express');
const router = express.Router();
const { calculateSavings, handlePathSelection, startChatbot } = require('../controllers/chatbotController');

// Start chatbot interaction
router.post('/start', async (req, res, next) => {
  try {
    await startChatbot(req, res);
  } catch (err) {
    next(err);
  }
});

// Handle path selection (A or B)
router.post('/choose-path', async (req, res, next) => {
  try {
    await handlePathSelection(req, res);
  } catch (err) {
    next(err);
  }
});

// Perform savings calculation
router.post('/calculate-savings', async (req, res, next) => {
  try {
    await calculateSavings(req, res);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
