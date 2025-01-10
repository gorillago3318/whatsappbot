const { Op } = require('sequelize');
const BankRate = require('../models/BankRate');
const logger = require('../config/logger');
const { defaultRate, defaultBank } = require('../config/defaultRates');

const getBankRate = async (loanAmount) => {
  try {
    // Validate loanAmount
    if (isNaN(loanAmount) || loanAmount <= 0) {
      logger.error(`Invalid loanAmount provided: ${loanAmount}`);
      return { interestRate: defaultRate, bankname: defaultBank };
    }

    // Log the query conditions
    logger.info(`Fetching bank rate for loanAmount=${loanAmount}`);
    const queryConditions = {
      where: {
        minAmount: { [Op.lte]: loanAmount },
        maxAmount: { [Op.gte]: loanAmount },
      },
      order: [['interestRate', 'ASC']], // Prioritize the lowest interest rate
    };
    logger.debug(`Query conditions: ${JSON.stringify(queryConditions)}`);

    // Query the database for a matching rate
    const bankrate = await BankRate.findOne(queryConditions);

    // Handle no matching rate
    if (!bankrate) {
      logger.warn(`No matching bank rate found for loanAmount=${loanAmount}`);
      return { interestRate: defaultRate, bankname: defaultBank };
    }

    // Extract and validate data from the query result
    const bankrateData = bankrate.toJSON();
    if (!bankrateData.interestRate || !bankrateData.minAmount || !bankrateData.maxAmount) {
      logger.warn(`Incomplete bank rate data for loanAmount=${loanAmount}`);
      return { interestRate: defaultRate, bankname: defaultBank };
    }

    // Log the selected rate details
    logger.info(
      `Selected rate for loanAmount=${loanAmount}: ${bankrateData.interestRate}% from ${bankrateData.bankname} (range: ${bankrateData.minAmount} - ${bankrateData.maxAmount})`
    );

    return {
      interestRate: parseFloat(bankrateData.interestRate.toFixed(2)), // Ensure consistent decimal format
      bankname: bankrateData.bankname || defaultBank, // Fallback to defaultBank if bankname is missing
    };
  } catch (error) {
    // Log unexpected errors and fallback to default rates
    logger.error(`Error fetching bank rate for loanAmount=${loanAmount}: ${error.message}`);
    return { interestRate: defaultRate, bankname: defaultBank };
  }
};

module.exports = { getBankRate };
