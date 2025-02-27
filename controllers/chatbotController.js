const axios = require('axios');
const logger = require('../config/logger');
const { calculateRefinanceSavings } = require('../utils/calculation');
const { generateConvincingMessage } = require('../services/openaiService');
const { getBankRate } = require('../services/bankRateService');
const { validatePathAInputs, validatePathBInputs } = require('../utils/validation');
const User = require('../models/User');
require('dotenv').config();

const calculateSavings = async (req, res) => {
  try {
    logger.info(`[DEBUG] Incoming Request Body: ${JSON.stringify(req.body)}`);

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
      language = 'en',
      referrerCode,
    } = req.body;

    logger.debug(`[DEBUG] Parsed Input Data: messengerId=${messengerId}, name=${name}, phoneNumber=${phoneNumber}, referrerCode=${referrerCode}`);

    // Determine the path and validate inputs
    let path = '';
    let validationResult;
    if (loanAmount && tenure && repayment) {
      path = 'A';
      validationResult = validatePathAInputs({ loanAmount, tenure, interestRate: repayment }, language);
    } else if (originalLoanAmount && originalTenure && monthlyPayment && yearsPaid) {
      path = 'B';
      validationResult = validatePathBInputs({ originalLoanAmount, originalTenure, monthlyPayment, yearsPaid }, language);
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
      const bankrate = await getBankRate(loanAmount);
      result = calculateRefinanceSavings(loanAmount, tenure, repayment, [bankrate]);
    } else if (path === 'B') {
      const bankrate = await getBankRate(originalLoanAmount);
      result = calculateRefinanceSavings(originalLoanAmount, originalTenure, monthlyPayment, [bankrate]);
    }

    // Save or Update User in Database
    let user = await User.findOne({ where: { messengerId } });
    if (user) {
      await user.update({
        name,
        phoneNumber,
        originalLoanAmount: path === 'A' ? loanAmount : originalLoanAmount,
        originalLoanTenure: path === 'A' ? tenure : originalTenure,
        currentRepayment: path === 'A' ? repayment : monthlyPayment,
        monthlySavings: result.monthlySavings,
        yearlySavings: result.yearlySavings,
        lifetimeSavings: result.lifetimeSavings,
        referral_code: referrerCode || user.referral_code,
      });
    } else {
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
        referral_code: referrerCode || null,
      });
    }

    logger.info(`[INFO] User data saved successfully for messengerId: ${messengerId}`);

    // Backend Lead Submission
    try {
      const backendUrl = process.env.BACKEND_URL || 'http://qaichatbot.chat/api/leads';
    
      const leadData = {
        name: name || user.name,
        phone: phoneNumber || user.phoneNumber,
        referrer_code: referrerCode || user.referral_code || null,
        loan_amount: path === 'A' ? loanAmount : originalLoanAmount,
        monthly_savings: result.monthlySavings,
        yearly_savings: result.yearlySavings,
        lifetime_savings: result.lifetimeSavings,
      };

      logger.debug(`[DEBUG] Lead Data: ${JSON.stringify(leadData)}`);
    
      const response = await axios.post(backendUrl, leadData, {
        headers: { 'Content-Type': 'application/json' },
      });
    
      logger.info(`[INFO] Lead submitted successfully: ${response.status}`);
    } catch (error) {
      logger.error(`[ERROR] Failed to submit lead: ${error.message}`);
    }

    // Generate convincing message
    let convincingMessage;
    try {
      convincingMessage = await generateConvincingMessage(result);
    } catch (error) {
      convincingMessage = 'Refinancing could help you save significantly. Contact us for more details!';
    }

    const response = {
      success: true,
      data: {
        savingsSummary: result,
        convincingMessage,
      },
    };

    res.json(response);
  } catch (err) {
    logger.error(`[ERROR] Internal Server Error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { calculateSavings };