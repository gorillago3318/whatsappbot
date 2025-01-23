// handleState.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { PORTAL_API_URL } = require('../config/dotenvConfig');


// Constants, Messages, Translations
const { STATES } = require('../config/constants');
const { MESSAGES, SUMMARY_TRANSLATIONS } = require('../config/translations');
// Validation & Calculation
const {
  validateLoanAmount,
  validateTenure,
  validateInterestRate,
  validateRepayment,
  validateYearsPaid,
} = require('./validation');
const {
  performPathACalculation,
  performPathBCalculation,
} = require('./calculation');
// GPT Utility
const { generateConvincingMessage } = require('../services/openaiService');
// Database Model
const User = require('../models/User');

// If you have a custom logger, import it; otherwise, use console
// const logger = require('../config/logger'); 
// We'll just use `console` for debugging.

// ────────────────────────────────────────────────────────────────────────────────
// Helper to extract phone number from chatId
// ────────────────────────────────────────────────────────────────────────────────
function extractPhoneNumber(chatId) {
  return chatId.split('@')[0];
}

// ────────────────────────────────────────────────────────────────────────────────
// In-memory user states
// ────────────────────────────────────────────────────────────────────────────────
let userStates = {};

function extractReferralCode(queryString) {
  const params = new URLSearchParams(queryString);
  return params.get('ref') || null;
}

// Initialize user state with referral_code
function initializeUserState(chatId, queryString) {
  const phoneNumber = extractPhoneNumber(chatId);
  const referralCode = extractReferralCode(queryString);
  console.log(`[DEBUG] initializeUserState: chatId=${chatId}, referralCode=${referralCode}`);

  if (!userStates[chatId]) {
    userStates[chatId] = {
      state: STATES.GET_STARTED,
      data: {
        phoneNumber,
        referral_code: referralCode, // Track referral_code
      },
      language: 'en',
    };
    console.log('[DEBUG] New userState created:', userStates[chatId]);
  } else {
    console.log('[DEBUG] Existing userState found:', userStates[chatId]);
  }
  return userStates[chatId];
}

// ────────────────────────────────────────────────────────────────────────────────
// Format currency in MYR
// ────────────────────────────────────────────────────────────────────────────────
function formatCurrency(value) {
  const safeValue = isNaN(value) || value === null ? 0 : value;
  return safeValue.toLocaleString('en-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 2,
  });
}

// ────────────────────────────────────────────────────────────────────────────────
// Save user data to DB (upsert)
// ────────────────────────────────────────────────────────────────────────────────
async function saveUserData(userState, chatId) {
  const phoneNumber = userState.data.phoneNumber || extractPhoneNumber(chatId);

  try {
    await User.upsert({
      messengerId: chatId,
      name: userState.data.name || null,
      phoneNumber: phoneNumber || null,
      referral_code: userState.data.referral_code || null,
      loanAmount: userState.data.loanAmount || null,
      tenure: userState.data.tenure || null,
      interestRate: userState.data.interestRate || null,
      originalLoanAmount: userState.data.originalLoanAmount || null,
      originalTenure: userState.data.originalTenure || null,
      currentRepayment: userState.data.currentRepayment || userState.data.monthlyPayment || null,
      yearsPaid: userState.data.yearsPaid || null,
      monthlySavings: userState.data.monthlySavings || null,
      yearlySavings: userState.data.yearlySavings || null,
      lifetimeSavings: userState.data.lifetimeSavings || null,
      newMonthlyRepayment: userState.data.newMonthlyRepayment || null,
      bankname: userState.data.bankname || null,
      outstandingBalance: userState.data.outstandingBalance || null,
      lastInteraction: new Date(),
    });

    console.log('[DEBUG] User data saved successfully.');
  } catch (error) {
    console.error('[ERROR] Failed to save user data:', error.message);
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// If userState.data.phoneNumber is missing, we fetch from DB
// ────────────────────────────────────────────────────────────────────────────────
async function ensurePhoneNumber(userState, chatId) {
  if (userState.data.phoneNumber) {
    console.log('[DEBUG] Phone number found in userState:', userState.data.phoneNumber);
    return userState.data.phoneNumber;
  }

  console.log('[DEBUG] Phone number missing in userState; querying DB for chatId:', chatId);
  try {
    const userRecord = await User.findOne({ where: { messengerId: chatId } });
    if (userRecord && userRecord.phoneNumber) {
      userState.data.phoneNumber = userRecord.phoneNumber;
      console.log('[DEBUG] Pulled phone number from DB:', userRecord.phoneNumber);
      return userRecord.phoneNumber;
    } else {
      console.warn('[WARN] No phone number found in DB for messengerId=', chatId);
      return null;
    }
  } catch (error) {
    console.error('[ERROR] Failed to fetch phone number from DB:', error.message);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// sendLeadSummaryToAdmin with DB fallback for phone
// ────────────────────────────────────────────────────────────────────────────────
async function sendLeadSummaryToAdmin(userState, client, chatId) {
  // 1) Ensure we have the phone number
  const phone = await ensurePhoneNumber(userState, chatId);
  const phoneNumber = phone || 'Not provided';

  console.log('[DEBUG] sendLeadSummaryToAdmin - userState.data:', userState.data);

  const leadData = userState.data;
  const currentRepayment = leadData.currentRepayment || leadData.monthlyPayment || 0;
  const finalInterestRate = leadData.interestRate || leadData.currentInterestRate || 'Not provided';

  console.log(
    `[DEBUG] Building leadSummary with phoneNumber=${phoneNumber}, currentRepayment=${currentRepayment}, finalInterestRate=${finalInterestRate}`
  );

  const leadSummary = `
🚨 *New Lead Alert* 🚨

📋 *Customer Details*:
- *Name*: ${leadData.name || 'Not provided'}
- *Contact Number*: ${phoneNumber}

💰 *Loan Information*:
- *Loan Size*: ${formatCurrency(leadData.loanAmount || leadData.originalLoanAmount || 0)}
- *Current Interest Rate*: ${finalInterestRate}%
- *Current Monthly Repayment*: ${formatCurrency(currentRepayment)}
- *New Monthly Repayment*: ${formatCurrency(leadData.newMonthlyRepayment || 0)}

📈 *Savings Analysis*:
- *Monthly Savings*: ${formatCurrency(leadData.monthlySavings || 0)}
- *Yearly Savings*: ${formatCurrency(leadData.yearlySavings || 0)}
- *Lifetime Savings*: ${formatCurrency(leadData.lifetimeSavings || 0)}

🌐 *Language Preference*: ${userState.language || 'en'}
`.trim();

  try {
    await client.sendMessage('60126181683@c.us', leadSummary);
    console.log('[DEBUG] Lead summary sent to admin successfully.');
  } catch (error) {
    console.error(`[DEBUG] Failed to send lead summary to admin: ${error.message}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Main handleState function
// ────────────────────────────────────────────────────────────────────────────────
async function handleState(userState, chatId, message, client) {
  const language = userState.language || 'en';
  console.log(`[DEBUG] handleState - Current State: ${userState.state}, Message: "${message}"`);
  console.log('[DEBUG] handleState - userState.data at start:', userState.data);

  try {
    switch (userState.state) {
      // ------------------ GET_STARTED ------------------
      case STATES.GET_STARTED: {
        userState.state = STATES.LANGUAGE_SELECTION;
        console.log('[DEBUG] Transition to LANGUAGE_SELECTION');
        await client.sendMessage(chatId, 'Welcome to FinZo AI! 👋');
        await client.sendMessage(chatId, MESSAGES.WELCOME['en']);
        break;
      }

      // ------------------ LANGUAGE_SELECTION ------------------
      case STATES.LANGUAGE_SELECTION: {
        const trimmedMessage = message.trim();
        if (['1', '2', '3'].includes(trimmedMessage)) {
          userState.language =
            trimmedMessage === '1' ? 'en' : trimmedMessage === '2' ? 'ms' : 'zh';
          userState.state = STATES.NAME_COLLECTION;
          console.log('[DEBUG] Language selected:', userState.language);
          await client.sendMessage(chatId, MESSAGES.ASK_NAME[userState.language]);
        } else {
          console.log('[DEBUG] Invalid language selection');
          await client.sendMessage(chatId, MESSAGES.INVALID_INPUT['en']);
        }
        break;
      }

      // ------------------ NAME_COLLECTION ------------------
      case STATES.NAME_COLLECTION: {
        if (!message.trim()) {
          console.log('[DEBUG] Empty name input');
          await client.sendMessage(chatId, MESSAGES.INVALID_INPUT[language]);
        } else {
          userState.data.name = message.trim();
          console.log('[DEBUG] Name collected:', userState.data.name);
          await saveUserData(userState, chatId);
          userState.state = STATES.PATH_SELECTION;
          await client.sendMessage(chatId, MESSAGES.ASK_LOAN_DETAILS[language]);
        }
        break;
      }

      // ------------------ PATH_SELECTION ------------------
      case STATES.PATH_SELECTION: {
        console.log('[DEBUG] Path selection input:', message);
        if (message === '1') {
          userState.state = STATES.PATH_A_LOAN_AMOUNT;
          console.log('[DEBUG] User chose Path A');
          await saveUserData(userState, chatId);
          await client.sendMessage(chatId, MESSAGES.PATH_A_LOAN_AMOUNT[language]);
        } else if (message === '2') {
          userState.state = STATES.PATH_B_ORIGINAL_LOAN_AMOUNT;
          console.log('[DEBUG] User chose Path B');
          await saveUserData(userState, chatId);
          await client.sendMessage(chatId, MESSAGES.PATH_B_ORIGINAL_LOAN_AMOUNT[language]);
        } else {
          console.log('[DEBUG] Invalid input at PATH_SELECTION');
          await client.sendMessage(chatId, MESSAGES.INVALID_INPUT[language]);
        }
        break;
      }

      // ------------------ Path A ------------------
      case STATES.PATH_A_LOAN_AMOUNT: {
        console.log('[DEBUG] PATH_A_LOAN_AMOUNT input:', message);
        const loanAmountValidation = validateLoanAmount(parseFloat(message), language);
        if (!loanAmountValidation.valid) {
          return await client.sendMessage(chatId, loanAmountValidation.message);
        }
        userState.data.loanAmount = parseFloat(message);
        await saveUserData(userState, chatId);
        userState.state = STATES.PATH_A_TENURE;
        await client.sendMessage(chatId, MESSAGES.PATH_A_TENURE[language]);
        break;
      }

      case STATES.PATH_A_TENURE: {
        console.log('[DEBUG] PATH_A_TENURE input:', message);
        const tenureValidation = validateTenure(parseInt(message), 5, 35, language);
        if (!tenureValidation.valid) {
          return await client.sendMessage(chatId, tenureValidation.message);
        }
        userState.data.tenure = parseInt(message);
        await saveUserData(userState, chatId);
        userState.state = STATES.PATH_A_INTEREST_RATE;
        await client.sendMessage(chatId, MESSAGES.PATH_A_INTEREST_RATE[language]);
        break;
      }

      case STATES.PATH_A_INTEREST_RATE: {
        console.log('[DEBUG] PATH_A_INTEREST_RATE input:', message);
        const interestRateValidation = validateInterestRate(parseFloat(message), language);
        if (!interestRateValidation.valid) {
          return await client.sendMessage(chatId, interestRateValidation.message);
        }
        userState.data.interestRate = parseFloat(message);
        console.log('[DEBUG] Path A Inputs before calculation:', userState.data);

        const pathAResults = await performPathACalculation(
          userState.data.loanAmount,
          userState.data.tenure,
          userState.data.interestRate
        );

        console.log('[DEBUG] Path A Calculation Results:', pathAResults);

        if (!pathAResults) {
          await client.sendMessage(
            chatId,
            'No suitable rates found for your loan amount. Please contact support.'
          );
          userState.state = STATES.COMPLETE;
          return;
        }

        userState.data.currentRepayment = pathAResults.currentRepayment || 0;
        console.log(`[DEBUG] Path A currentRepayment set to ${userState.data.currentRepayment}`);

        if (pathAResults.lifetimeSavings <= 0 || pathAResults.monthlySavings <= 0) {
          await client.sendMessage(
            chatId,
            'Your current loan terms are already optimal. Refinancing might not be beneficial at this time.'
          );
          userState.state = STATES.COMPLETE;
          return;
        }

        if (pathAResults.lifetimeSavings < 10000) {
          await client.sendMessage(
            chatId,
            'The savings from refinancing are below RM10,000. It might not be worth refinancing at this time.'
          );
          userState.state = STATES.COMPLETE;
          return;
        }

        const summaryMessage = `
Here is your refinancing summary:
- Monthly Savings: ${formatCurrency(pathAResults.monthlySavings)}
- Yearly Savings: ${formatCurrency(pathAResults.yearlySavings)}
- Total Savings: ${formatCurrency(pathAResults.lifetimeSavings)}
- New Monthly Repayment: ${formatCurrency(pathAResults.newMonthlyRepayment)}
- Bank: ${pathAResults.bankname} (Interest Rate: ${pathAResults.newInterestRate}%)
Please hold on while we analyze if refinancing benefits you.
`.trim();

        await client.sendMessage(chatId, summaryMessage);

        userState.data.monthlySavings = pathAResults.monthlySavings;
        userState.data.yearlySavings = pathAResults.yearlySavings;
        userState.data.lifetimeSavings = pathAResults.lifetimeSavings;
        userState.data.newMonthlyRepayment = pathAResults.newMonthlyRepayment;
        userState.data.bankname = pathAResults.bankname;
        await saveUserData(userState, chatId);

        try {
          const convincingMessageA = await generateConvincingMessage(
            pathAResults,
            userState.language
          );
          await client.sendMessage(chatId, convincingMessageA);
        
          console.log('[DEBUG] About to notify admin for Path A lead...');
          console.log('[DEBUG] userState.data before sendLeadSummaryToAdmin:', userState.data);
        
          await client.sendMessage(
            chatId,
            'Thank you for using our service! If you have any questions, please contact our admin at wa.me/60126181683. Alternatively, if you would like to restart the process, kindly type "restart".'
          );
        
          // Notify Admin
          await sendLeadSummaryToAdmin(userState, client, chatId);
        
          // Send lead data to the portal
          await sendLeadToPortal(userState);
        
          userState.state = STATES.COMPLETE;
        } catch (error) {
          console.error('[DEBUG] Error generating convincing message for Path A:', error.message);
          await client.sendMessage(
            chatId,
            'An error occurred while generating the convincing message. Please contact support.'
          );
        
          console.log('[DEBUG] userState.data before sendLeadSummaryToAdmin (Path A Error):', userState.data);
        
          // Notify Admin
          await sendLeadSummaryToAdmin(userState, client, chatId);
        
          // Send lead data to the portal
          await sendLeadToPortal(userState);
        
          userState.state = STATES.COMPLETE;
        }
        break;
      }

      // ------------------ Path B ------------------
      case STATES.PATH_B_ORIGINAL_LOAN_AMOUNT: {
        console.log('[DEBUG] PATH_B_ORIGINAL_LOAN_AMOUNT input:', message);
        const originalLoanAmountValidation = validateLoanAmount(parseFloat(message), language);
        if (!originalLoanAmountValidation.valid) {
          return await client.sendMessage(chatId, originalLoanAmountValidation.message);
        }
        userState.data.originalLoanAmount = parseFloat(message);
        await saveUserData(userState, chatId);
        userState.state = STATES.PATH_B_ORIGINAL_TENURE;
        await client.sendMessage(chatId, MESSAGES.PATH_B_ORIGINAL_TENURE[language]);
        break;
      }

      case STATES.PATH_B_ORIGINAL_TENURE: {
        console.log('[DEBUG] PATH_B_ORIGINAL_TENURE input:', message);
        const originalTenureValidation = validateTenure(
          parseInt(message),
          10,
          35,
          language
        );
        if (!originalTenureValidation.valid) {
          return await client.sendMessage(chatId, originalTenureValidation.message);
        }
        userState.data.originalTenure = parseInt(message);
        await saveUserData(userState, chatId);
        userState.state = STATES.PATH_B_MONTHLY_PAYMENT;
        await client.sendMessage(chatId, MESSAGES.PATH_B_MONTHLY_PAYMENT[language]);
        break;
      }

      case STATES.PATH_B_MONTHLY_PAYMENT: {
        console.log('[DEBUG] PATH_B_MONTHLY_PAYMENT input:', message);
        const repaymentValidation = validateRepayment(parseFloat(message), language);
        if (!repaymentValidation.valid) {
          return await client.sendMessage(chatId, repaymentValidation.message);
        }
        userState.data.monthlyPayment = parseFloat(message);
        await saveUserData(userState, chatId);
        userState.state = STATES.PATH_B_YEARS_PAID;
        await client.sendMessage(chatId, MESSAGES.PATH_B_YEARS_PAID[language]);
        break;
      }

      case STATES.PATH_B_YEARS_PAID: {
        console.log('[DEBUG] PATH_B_YEARS_PAID input:', message);
        const yearsPaidValidation = validateYearsPaid(
          parseInt(message),
          userState.data.originalTenure,
          language
        );
        if (!yearsPaidValidation.valid) {
          return await client.sendMessage(chatId, yearsPaidValidation.message);
        }
        userState.data.yearsPaid = parseInt(message);
        await saveUserData(userState, chatId);

        console.log('[DEBUG] Path B Inputs before calculation:', userState.data);

        try {
          const pathBResults = await performPathBCalculation(
            userState.data.originalLoanAmount,
            userState.data.originalTenure,
            userState.data.monthlyPayment,
            userState.data.yearsPaid
          );

          console.log('[DEBUG] Path B Calculation Results:', pathBResults);

          if (pathBResults.lifetimeSavings <= 0 || pathBResults.monthlySavings <= 0) {
            await client.sendMessage(
              chatId,
              'Your current loan terms are already optimal. Refinancing might not be beneficial at this time.'
            );
            userState.state = STATES.COMPLETE;
            return;
          }

          if (pathBResults.lifetimeSavings < 10000) {
            await client.sendMessage(
              chatId,
              'The savings from refinancing are below RM10,000. It might not be worth refinancing at this time.'
            );
            userState.state = STATES.COMPLETE;
            return;
          }

          const summaryTranslationB = SUMMARY_TRANSLATIONS[userState.language];
          const summaryMessageB = `
${summaryTranslationB.header}
- ${summaryTranslationB.monthlySavings}: ${formatCurrency(pathBResults.monthlySavings)}
- ${summaryTranslationB.yearlySavings}: ${formatCurrency(pathBResults.yearlySavings)}
- ${summaryTranslationB.totalSavings}: ${formatCurrency(pathBResults.lifetimeSavings)}
- ${summaryTranslationB.newRepayment}: ${formatCurrency(pathBResults.newMonthlyRepayment)}
- ${summaryTranslationB.bank}: ${pathBResults.bankname} (${summaryTranslationB.interestRate}: ${
            pathBResults.newInterestRate
          }%)

${summaryTranslationB.analysis}
`.trim();

          await client.sendMessage(chatId, summaryMessageB);

          userState.data.monthlySavings = pathBResults.monthlySavings;
          userState.data.yearlySavings = pathBResults.yearlySavings;
          userState.data.lifetimeSavings = pathBResults.lifetimeSavings;
          userState.data.newMonthlyRepayment = pathBResults.newMonthlyRepayment;
          userState.data.bankname = pathBResults.bankname;
          userState.data.currentRepayment = userState.data.monthlyPayment;
          if (pathBResults.currentInterestRate !== 'N/A') {
            userState.data.currentInterestRate = pathBResults.currentInterestRate;
          }

          await saveUserData(userState, chatId);

          try {
            const convincingMessageB = await generateConvincingMessage(
              pathBResults,
              userState.language
            );
            await client.sendMessage(chatId, convincingMessageB);
          
            console.log('[DEBUG] About to notify admin for Path B lead...');
            console.log('[DEBUG] userState.data before sendLeadSummaryToAdmin:', userState.data);
          
            // Notify Admin
            await sendLeadSummaryToAdmin(userState, client, chatId);
          
            // Send lead data to the portal
            await sendLeadToPortal(userState);
          
            await client.sendMessage(
              chatId,
              'Thank you for using our service! If you have any questions, please contact our admin at wa.me/60126181683. Alternatively, if you would like to restart the process, kindly type "restart".'
            );
          
            userState.state = STATES.COMPLETE;
          } catch (error) {
            console.error('[DEBUG] Error generating convincing message for Path B:', error.message);
            await client.sendMessage(
              chatId,
              'An error occurred while generating the convincing message. Please contact support.'
            );
          
            console.log('[DEBUG] userState.data before sendLeadSummaryToAdmin (Path B Error):', userState.data);
          
            // Notify Admin
            await sendLeadSummaryToAdmin(userState, client, chatId);
          
            // Send lead data to the portal
            await sendLeadToPortal(userState);
          
            await client.sendMessage(
              chatId,
              'Thank you for using our service! If you have any questions, please contact our admin at wa.me/60126181683. Alternatively, if you would like to restart the process, kindly type "restart".'
            );
          
            userState.state = STATES.COMPLETE;
          }
        } catch (error) {
          console.error(`[DEBUG] Error in Path B Calculation: ${error.message}`);
          await client.sendMessage(
            chatId,
            'An error occurred while processing your refinancing details. Please try again.'
          );
        }
        break;
      }

      // ------------------ COMPLETE ------------------
      case STATES.COMPLETE: {
        console.log('[DEBUG] In COMPLETE state. userState:', userState);
      
        try {
          // Send lead data to the portal only after the conversation is complete
          console.log('[DEBUG] Sending final lead data to portal...');
          await sendLeadToPortal(userState);
      
          await client.sendMessage(
            chatId,
            'Thank you for using our service! If you have any questions, please contact our admin at wa.me/60126181683. Alternatively, if you would like to restart the process, kindly type "restart".'
          );
      
          userState.state = STATES.DONE;
        } catch (error) {
          console.error('[ERROR] Failed to send lead to portal in COMPLETE state:', error.message);
        }
        break;
      }
     

      // ------------------ DEFAULT ------------------
      default: {
        console.log('[DEBUG] Default case triggered. Invalid state?');
        await client.sendMessage(chatId, 'Invalid state. Please type "restart" to start again.');
      }
    }
  } catch (error) {
    console.error(`[DEBUG] Error in handleState: ${error.message}`);
    await client.sendMessage(
      chatId,
      'An unexpected error occurred. Please try again or contact support.'
    );
  }
}

async function sendLeadToPortal(userState) {
  const leadData = {
    referrer_code: userState.data.referral_code || 'N/A',
    phone: userState.data.phoneNumber || 'N/A',
    loan_amount: userState.data.loanAmount || userState.data.originalLoanAmount || 0,
    estimated_savings: userState.data.lifetimeSavings || 0,
  };

  if (!leadData.phone || !leadData.loan_amount) {
    console.error('[ERROR] Missing required lead data. Not sending to portal:', leadData);
    return;
  }

  console.log('[DEBUG] Sending lead data to portal:', leadData);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.post(PORTAL_API_URL, leadData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log('[DEBUG] Lead sent to portal successfully:', response.data);
      return; // Exit after successful send
    } catch (error) {
      console.error(`[ERROR] Failed to send lead to portal (Attempt ${attempt}):`, error.message);
      if (attempt === 3) {
        console.error('[ERROR] Giving up after 3 attempts.');
      }
    }
  }
}


// Export everything
module.exports = {
  initializeUserState,
  handleState,
  sendLeadSummaryToAdmin,
  sendLeadToPortal,
};
