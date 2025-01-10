const { calculateMonthlyPayment, estimateLoanDetails } = require('../utils/calculation');
const { getBankRate } = require('../services/bankRateService');
const logger = require('../config/logger');

const performPathACalculation = async (loanAmount, tenure, interestRate) => {
  try {
    // Calculate current monthly payment
    const currentMonthlyPayment = calculateMonthlyPayment(loanAmount, interestRate, tenure);

    // Fetch the best bank rate dynamically
    const { interestRate: newInterestRate, bankname } = await getBankRate(loanAmount);

    // Calculate new monthly payment with the fetched rate
    const newMonthlyPayment = calculateMonthlyPayment(loanAmount, newInterestRate, tenure);

    // Calculate savings
    const monthlySavings = currentMonthlyPayment - newMonthlyPayment;
    const yearlySavings = monthlySavings * 12;
    const lifetimeSavings = monthlySavings * tenure * 12;

    return {
      monthlySavings: parseFloat(monthlySavings.toFixed(2)),
      yearlySavings: parseFloat(yearlySavings.toFixed(2)),
      lifetimeSavings: parseFloat(lifetimeSavings.toFixed(2)),
      newMonthlyPayment: parseFloat(newMonthlyPayment.toFixed(2)),
      newInterestRate: parseFloat(newInterestRate.toFixed(2)),
      bankname,
    };
  } catch (error) {
    logger.error(`Error in Path A calculation: ${error.message}`);
    throw new Error('Failed to calculate Path A savings');
  }
};

const performPathBCalculation = async (originalLoanAmount, originalTenure, monthlyPayment, yearsPaid) => {
  try {
    // Estimate loan details (e.g., outstanding balance, remaining tenure)
    const { guessedRate, outstandingBalance, remainingTenure } = estimateLoanDetails(
      originalLoanAmount,
      originalTenure,
      monthlyPayment,
      yearsPaid
    );

    // Fetch the best bank rate dynamically
    const { interestRate: newInterestRate, bankname } = await getBankRate(outstandingBalance);

    // Calculate new monthly payment with the fetched rate
    const newMonthlyPayment = calculateMonthlyPayment(outstandingBalance, newInterestRate, remainingTenure);

    // Calculate savings
    const currentMonthlyPayment = calculateMonthlyPayment(outstandingBalance, guessedRate, remainingTenure);
    const monthlySavings = currentMonthlyPayment - newMonthlyPayment;
    const yearlySavings = monthlySavings * 12;
    const lifetimeSavings = monthlySavings * remainingTenure * 12;

    return {
      monthlySavings: parseFloat(monthlySavings.toFixed(2)),
      yearlySavings: parseFloat(yearlySavings.toFixed(2)),
      lifetimeSavings: parseFloat(lifetimeSavings.toFixed(2)),
      newMonthlyPayment: parseFloat(newMonthlyPayment.toFixed(2)),
      newInterestRate: parseFloat(newInterestRate.toFixed(2)),
      bankname,
    };
  } catch (error) {
    logger.error(`Error in Path B calculation: ${error.message}`);
    throw new Error('Failed to calculate Path B savings');
  }
};

module.exports = { performPathACalculation, performPathBCalculation };
