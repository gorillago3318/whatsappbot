const axios = require('axios'); // Import Axios for HTTP requests
const logger = require('../config/logger');
const { calculateRefinanceSavings } = require('../utils/calculation');
const { generateConvincingMessage } = require('../services/openaiService');
const { getBankRate } = require('../services/bankRateService');
const { validatePathAInputs, validatePathBInputs } = require('../utils/validation');
const User = require('../models/User');
require('dotenv').config();

const calculateSavings = async (req, res) => {
  try {
    logger.info(`[DEBUG] Incoming Request Body: ${JSON.stringify(req.body)}`); // Log full request body

    const {
      messengerId,
      name,
      phoneNumber,
      loanAmount,
      tenure,
      repayment,
      originalLoanAmount,
      originalTenure,
      monthlyPayment,
      yearsPaid,
      language = 'en', // Default language
      referrerCode, // Add referrerCode if available
    } = req.body;

    logger.debug(`[DEBUG] Parsed Input Data: messengerId=${messengerId}, name=${name}, phoneNumber=${phoneNumber}, referrerCode=${referrerCode}`);

    // Determine the path and validate inputs
    let path = '';
    let validationResult;
    if (loanAmount && tenure && repayment) {
      path = 'A'; // Path A
      validationResult = validatePathAInputs({ loanAmount, tenure, interestRate: repayment }, language);
      logger.debug(`[DEBUG] Path A Validation Result: ${JSON.stringify(validationResult)}`);
    } else if (originalLoanAmount && originalTenure && monthlyPayment && yearsPaid) {
      path = 'B'; // Path B
      validationResult = validatePathBInputs({ originalLoanAmount, originalTenure, monthlyPayment, yearsPaid }, language);
      logger.debug(`[DEBUG] Path B Validation Result: ${JSON.stringify(validationResult)}`);
    } else {
      logger.error(`[ERROR] Missing required fields for Path A or Path B.`);
      return res.status(400).json({ error: 'Missing required fields for Path A or Path B.' });
    }

    if (!validationResult.valid) {
      logger.error(`[ERROR] Validation failed: ${validationResult.message}`);
      return res.status(400).json({ error: validationResult.message });
    }

    // Perform calculations based on the path
    let result;
    if (path === 'A') {
      logger.debug(`[DEBUG] Performing calculations for Path A`);
      const bankrate = await getBankRate(loanAmount);
      result = calculateRefinanceSavings(loanAmount, tenure, repayment, [bankrate]);
    } else if (path === 'B') {
      logger.debug(`[DEBUG] Performing calculations for Path B`);
      const bankrate = await getBankRate(originalLoanAmount);
      result = calculateRefinanceSavings(originalLoanAmount, originalTenure, monthlyPayment, [bankrate]);
    }

    logger.info(`[DEBUG] Calculation Result: ${JSON.stringify(result)}`);

    // Save or Update User in Database
    logger.debug(`[DEBUG] Checking if user exists in database: messengerId=${messengerId}`);
    let user = await User.findOne({ where: { messengerId } });
    if (user) {
      logger.debug(`[DEBUG] User found, updating user data`);
      await user.update({
        name,
        phoneNumber,
        originalLoanAmount: path === 'A' ? loanAmount : originalLoanAmount,
        originalLoanTenure: path === 'A' ? tenure : originalTenure,
        currentRepayment: path === 'A' ? repayment : monthlyPayment,
        monthlySavings: result.monthlySavings,
        yearlySavings: result.yearlySavings,
        lifetimeSavings: result.lifetimeSavings,
        referral_code: referrerCode || user.referral_code, // Update referral code if available
      });
    } else {
      logger.debug(`[DEBUG] User not found, creating new user`);
      user = await User.create({
        messengerId,
        name,
        phoneNumber,
        originalLoanAmount: path === 'A' ? loanAmount : originalLoanAmount,
        originalLoanTenure: path === 'A' ? tenure : originalTenure,
        currentRepayment: path === 'A' ? repayment : monthlyPayment,
        monthlySavings: result.monthlySavings,
        yearlySavings: result.yearlySavings,
        lifetimeSavings: result.lifetimeSavings,
        referral_code: referrerCode || null, // Save referral code if available
      });
    }

    logger.info(`[DEBUG] User data saved/updated successfully: ${JSON.stringify(user.toJSON())}`);

    // Send Lead Data to the /api/leads Endpoint
    try {
      const backendUrl = process.env.BACKEND_URL || 'http://qaichatbot.chat/api/leads'; // Backend endpoint for leads
      const leadData = {
        name: user.name,
        phone: user.phoneNumber,
        referrer_code: user.referral_code,
        loan_amount: path === 'A' ? loanAmount : originalLoanAmount,
      };

      logger.debug(`[DEBUG] Sending lead data to backend: ${JSON.stringify(leadData)} via ${backendUrl}`);
      const response = await axios.post(backendUrl, leadData);
      logger.info(`[INFO] Lead sent to backend successfully: ${JSON.stringify(response.data)}`);
    } catch (error) {
      logger.error(`[ERROR] Failed to send lead to backend: ${error.message}`);
    }

    // Generate a convincing message using GPT-4
    let convincingMessage;
    try {
      logger.debug(`[DEBUG] Generating convincing message`);
      convincingMessage = await generateConvincingMessage(result);
    } catch (error) {
      logger.error(`[ERROR] GPT-4 Error: ${error.message}`);
      convincingMessage = 'Refinancing could help you save significantly. Contact us for more details!';
    }

    // Respond to the user with the summary and convincing message
    const response = {
      success: true,
      data: {
        savingsSummary: result,
        convincingMessage,
      },
    };

    logger.info(`[DEBUG] Final Response to User: ${JSON.stringify(response)}`);
    res.json(response);

    // Notify Admin (placeholder for actual notification logic)
    logger.info(`[DEBUG] Admin notified of new lead: ${JSON.stringify(user)}`);
  } catch (err) {
    logger.error(`[ERROR] Internal Server Error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { calculateSavings };
