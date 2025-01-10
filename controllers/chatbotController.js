const logger = require('../config/logger');
const { calculateRefinanceSavings } = require('../utils/calculation');
const { generateConvincingMessage } = require('../services/openaiService');
const { getBankRate } = require('../services/bankRateService');
const { validatePathAInputs, validatePathBInputs } = require('../utils/validation');
const User = require('../models/User');

const calculateSavings = async (req, res) => {
  try {
    logger.info(`Request Body: ${JSON.stringify(req.body)}`); // Log request body

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
    } = req.body;

    // Determine the path and validate inputs
    let path = '';
    let validationResult;
    if (loanAmount && tenure && repayment) {
      path = 'A'; // Path A
      validationResult = validatePathAInputs({ loanAmount, tenure, interestRate: repayment }, language);
    } else if (originalLoanAmount && originalTenure && monthlyPayment && yearsPaid) {
      path = 'B'; // Path B
      validationResult = validatePathBInputs({ originalLoanAmount, originalTenure, monthlyPayment, yearsPaid }, language);
    } else {
      return res.status(400).json({ error: 'Missing required fields for Path A or Path B.' });
    }

    if (!validationResult.valid) {
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
      });
    }

    // Generate a convincing message using GPT-4
    let convincingMessage;
    try {
      convincingMessage = await generateConvincingMessage(result);
    } catch (error) {
      logger.error(`GPT-4 Error: ${error.message}`);
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

    logger.info(`Calculation Result: ${JSON.stringify(response)}`);
    res.json(response);

    // Notify Admin (placeholder for actual notification logic)
    logger.info(`Admin notified of new lead: ${JSON.stringify(user)}`);
  } catch (err) {
    logger.error(`❌ Error calculating savings: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { calculateSavings };
