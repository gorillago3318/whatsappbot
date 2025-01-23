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
      const backendUrl = process.env.BACKEND_URL || 'http://qaichatbot.chat/api/leads';
      
      // Detailed logging of environment and configuration
      console.log('Backend URL Configuration:', {
        envBackendUrl: process.env.BACKEND_URL,
        fallbackUrl: 'http://qaichatbot.chat/api/leads'
      });
    
      // Ensure lead data matches exact backend expectations
      const leadData = {
        name: name || user.name,
        phone: phoneNumber || user.phoneNumber,
        referrer_code: referrerCode || user.referral_code || null,
        loan_amount: path === 'A' ? loanAmount : originalLoanAmount
      };
    
      // Validate lead data before sending
      console.log('Prepared Lead Data:', JSON.stringify(leadData, null, 2));
      
      // Axios configuration with detailed error handling
      const axiosConfig = {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10-second timeout
      };
    
      console.log('Axios Configuration:', axiosConfig);
    
      try {
        const response = await axios.post(backendUrl, leadData, axiosConfig);
        console.log('Backend Response:', {
          status: response.status,
          data: response.data
        });
      } catch (error) {
        console.error('Detailed Axios Error:', {
          message: error.message,
          code: error.code,
          response: error.response ? {
            status: error.response.status,
            data: error.response.data,
            headers: error.response.headers
          } : 'No response received',
          request: error.request ? 'Request was made' : 'No request made',
          config: error.config
        });
    
        // Rethrow to maintain original error handling
        throw error;
      }
    } catch (error) {
      logger.error(`[CRITICAL] Lead Submission Failed: ${error.message}`);
      // Consider additional error handling or notification mechanism
    }

module.exports = { calculateSavings };
