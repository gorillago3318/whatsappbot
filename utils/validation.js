 
// utils/validation.js
const { ERROR_MESSAGES } = require('../config/constants');

const getErrorMessage = (key, language) => {
  return ERROR_MESSAGES[language]?.[key] || ERROR_MESSAGES['en'][key];
};

// Validate loan amount (Path A or Path B)
const validateLoanAmount = (loanAmount, language = 'en') => {
  if (isNaN(loanAmount) || loanAmount < 100000 || loanAmount > 30000000) {
    return { valid: false, message: getErrorMessage('invalidLoanAmount', language) };
  }
  return { valid: true };
};

// Validate tenure (Path A or Path B)
const validateTenure = (tenure, min, max, language = 'en') => {
  if (!Number.isInteger(tenure) || tenure < min || tenure > max) {
    return { valid: false, message: getErrorMessage('invalidTenure', language) };
  }
  return { valid: true };
};

// Validate interest rate (Path A)
const validateInterestRate = (interestRate, language = 'en') => {
  if (isNaN(interestRate) || interestRate < 3 || interestRate > 8) {
    return { valid: false, message: getErrorMessage('invalidInterestRate', language) };
  }
  return { valid: true };
};

// Validate repayment amount (Path B)
const validateRepayment = (repayment, language = 'en') => {
  if (isNaN(repayment) || repayment < 500 || repayment > 60000) {
    return { valid: false, message: getErrorMessage('invalidRepayment', language) };
  }
  return { valid: true };
};

// Validate years paid (Path B)
const validateYearsPaid = (yearsPaid, originalTenure, language = 'en') => {
  if (isNaN(yearsPaid) || yearsPaid < 0 || yearsPaid >= originalTenure) {
    return { valid: false, message: getErrorMessage('invalidYearsPaid', language) };
  }
  return { valid: true };
};

// Validate Path A inputs
const validatePathAInputs = ({ loanAmount, tenure, interestRate }, language = 'en') => {
  const amountValidation = validateLoanAmount(loanAmount, language);
  if (!amountValidation.valid) return amountValidation;

  const tenureValidation = validateTenure(tenure, 5, 35, language);
  if (!tenureValidation.valid) return tenureValidation;

  const rateValidation = validateInterestRate(interestRate, language);
  if (!rateValidation.valid) return rateValidation;

  return { valid: true };
};

// Validate Path B inputs
const validatePathBInputs = ({ originalLoanAmount, originalTenure, monthlyPayment, yearsPaid }, language = 'en') => {
  const amountValidation = validateLoanAmount(originalLoanAmount, language);
  if (!amountValidation.valid) return amountValidation;

  const tenureValidation = validateTenure(originalTenure, 10, 35, language);
  if (!tenureValidation.valid) return tenureValidation;

  const repaymentValidation = validateRepayment(monthlyPayment, language);
  if (!repaymentValidation.valid) return repaymentValidation;

  const yearsValidation = validateYearsPaid(yearsPaid, originalTenure, language);
  if (!yearsValidation.valid) return yearsValidation;

  return { valid: true };
};

module.exports = {
  validateLoanAmount,
  validateTenure,
  validateInterestRate,
  validateRepayment,
  validateYearsPaid,
  validatePathAInputs,
  validatePathBInputs,
};
