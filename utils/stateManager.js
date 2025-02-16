// handleState.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { PORTAL_API_URL } = require('../config/dotenvConfig');
const { createLeadOnPortal } = require('../services/portalService');

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

// Database Models
const User = require('../models/User');
// (The Agent model is no longer used for sending messages to agents in this version.)

// ────────────────────────────────────────────────────────────────────────────────
// Helper to extract phone number from chatId
// ────────────────────────────────────────────────────────────────────────────────
function extractPhoneNumber(chatId) {
  return chatId.split('@')[0];
}

// ────────────────────────────────────────────────────────────────────────────────
// Helper to extract a referral code from a message, regardless of its position.
// This regex looks for "REF-" followed by 8 or more alphanumeric characters.
// ────────────────────────────────────────────────────────────────────────────────
function extractReferralCodeFromMessage(message) {
  const regex = /(REF-\w{8,})/i;
  const match = message.match(regex);
  return match ? match[1].toUpperCase() : null;
}

// ────────────────────────────────────────────────────────────────────────────────
// In-memory user states
// ────────────────────────────────────────────────────────────────────────────────
let userStates = {};

function extractReferralCode(queryString) {
  const params = new URLSearchParams(queryString);
  return params.get('ref') || null;
}

function initializeUserState(chatId, queryString = '') {
  const phoneNumber = extractPhoneNumber(chatId);
  const referralCode = extractReferralCode(queryString);

  console.log(`[DEBUG] initializeUserState: chatId=${chatId}, referralCode=${referralCode}`);

  if (!userStates[chatId]) {
    userStates[chatId] = {
      state: STATES.GET_STARTED,
      data: {
        phoneNumber,
        referral_code: referralCode || null,
      },
      language: 'en',
    };
    console.log('[DEBUG] New userState created:', userStates[chatId]);
  } else {
    console.log('[DEBUG] Existing userState found:', userStates[chatId]);
    if (referralCode) {
      userStates[chatId].data.referral_code = referralCode;
    }
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
  const referralCode = userState.data.referral_code;

  try {
    let user = await User.findOne({ where: { messengerId: chatId } });

    if (user) {
      await user.update({
        name: userState.data.name || user.name,
        phoneNumber: phoneNumber || user.phoneNumber,
        referral_code: referralCode || user.referral_code,
        loanAmount: userState.data.loanAmount || user.loanAmount,
        tenure: userState.data.tenure || user.tenure,
        interestRate: userState.data.interestRate || user.interestRate,
        originalLoanAmount: userState.data.originalLoanAmount || user.originalLoanAmount,
        originalTenure: userState.data.originalTenure || user.originalTenure,
        currentRepayment: userState.data.currentRepayment || user.currentRepayment,
        monthlySavings: userState.data.monthlySavings || user.monthlySavings,
        yearlySavings: userState.data.yearlySavings || user.yearlySavings,
        lifetimeSavings: userState.data.lifetimeSavings || user.lifetimeSavings,
        newMonthlyRepayment: userState.data.newMonthlyRepayment || user.newMonthlyRepayment,
        bankname: userState.data.bankname || user.bankname,
        outstandingBalance: userState.data.outstandingBalance || user.outstandingBalance,
        lastInteraction: new Date(),
      });
      console.log(`[DEBUG] Updated user data for chatId: ${chatId}`);
    } else {
      await User.create({
        messengerId: chatId,
        name: userState.data.name || null,
        phoneNumber: phoneNumber || null,
        referral_code: referralCode || null,
        loanAmount: userState.data.loanAmount || null,
        tenure: userState.data.tenure || null,
        interestRate: userState.data.interestRate || null,
        originalLoanAmount: userState.data.originalLoanAmount || null,
        originalTenure: userState.data.originalTenure || null,
        currentRepayment: userState.data.currentRepayment || null,
        monthlySavings: userState.data.monthlySavings || null,
        yearlySavings: userState.data.yearlySavings || null,
        lifetimeSavings: userState.data.lifetimeSavings || null,
        newMonthlyRepayment: userState.data.newMonthlyRepayment || null,
        bankname: userState.data.bankname || null,
        outstandingBalance: userState.data.outstandingBalance || null,
        lastInteraction: new Date(),
      });
      console.log(`[DEBUG] Created new user with chatId: ${chatId}`);
    }
  } catch (error) {
    console.error(`[ERROR] Failed to save user data for chatId: ${chatId}`, error.message);
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// If userState.data.phoneNumber is missing, fetch from DB
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
// sendLeadSummaryToAdmin (unchanged)
// ────────────────────────────────────────────────────────────────────────────────
async function sendLeadSummaryToAdmin(userState, client, chatId, sendMessage) {
  const phone = await ensurePhoneNumber(userState, chatId);
  const phoneNumber = phone || 'Not provided';

  console.log('[DEBUG] sendLeadSummaryToAdmin - userState.data:', userState.data);

  const leadData = userState.data;
  const currentRepayment = leadData.currentRepayment || leadData.monthlyPayment || 0;
  const finalInterestRate = leadData.interestRate || leadData.currentInterestRate || 'Not provided';

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
    await sendMessage('60126181683@c.us', leadSummary);
    console.log('[DEBUG] Lead summary sent to admin successfully.');
  } catch (error) {
    console.error(`[DEBUG] Failed to send lead summary to admin: ${error.message}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Helper to create lead on portal and notify admin immediately
// ────────────────────────────────────────────────────────────────────────────────
async function createLeadAndNotify(userState, chatId, sendMessage, client) {
  try {
    await saveUserData(userState, chatId);
    console.log('[DEBUG] Final userState.data before building payload:', JSON.stringify(userState.data, null, 2));

    const payload = {
      name: userState.data.name,
      phone: userState.data.phoneNumber,
      referrer_code: userState.data.referral_code || null,
      loan_amount: userState.data.loanAmount || userState.data.originalLoanAmount || 0,
      estimated_savings: userState.data.lifetimeSavings || 0,
      monthly_savings: userState.data.monthlySavings || 0,
      yearly_savings: userState.data.yearlySavings || 0,
      new_monthly_repayment: userState.data.newMonthlyRepayment || 0,
      bankname: userState.data.bankname || '',
      status: 'New',
      assigned_agent_id: userState.data.assigned_agent_id || null,
      source: 'whatsapp',
    };

    console.log('[DEBUG] Payload for portal:', JSON.stringify(payload, null, 2));
    const portalResponse = await createLeadOnPortal(payload);
    console.log('[DEBUG] Portal response:', JSON.stringify(portalResponse, null, 2));

    await sendMessage(chatId, 'Your lead has been created successfully on our portal!');
    
    // Notify admin.
    await sendLeadSummaryToAdmin(userState, client, chatId, sendMessage);

    userState.state = STATES.DONE;
  } catch (error) {
    console.error(`[ERROR] Failed to create lead on portal: ${error.message}`);
    await sendMessage(chatId, '❌ There was an error creating your lead. Please try again later.');
  }
}

// ────────────────────────────────────────────────────────────────────────────────
// Main handleState function
// ────────────────────────────────────────────────────────────────────────────────
async function handleState(userState, chatId, message, sendMessage, client) {
  if (message.trim().toLowerCase() === 'restart') {
    userState.state = STATES.GET_STARTED;
    userState.data = {
      phoneNumber: extractPhoneNumber(chatId),
      referral_code: userState.data.referral_code || null,
    };
    await saveUserData(userState, chatId);
    await sendMessage(chatId, 'Your session has been restarted. Welcome to Quantify AI! 👋');
    await sendMessage(chatId, MESSAGES.WELCOME[userState.language || 'en']);
    return;
  }

  const language = userState.language || 'en';
  console.log(`[DEBUG] handleState - Current State: ${userState.state}, Message: "${message}"`);
  console.log('[DEBUG] handleState - userState.data at start:', JSON.stringify(userState.data, null, 2));

  try {
    switch (userState.state) {
      case STATES.GET_STARTED: {
        const trimmedMessage = message.trim();
        // Use the helper function to extract referral code anywhere in the message.
        const extractedCode = extractReferralCodeFromMessage(trimmedMessage);
        if (!userState.data.referral_code && extractedCode) {
          userState.data.referral_code = extractedCode;
          console.log('[DEBUG] Referral code captured from message:', userState.data.referral_code);
          userState.state = STATES.LANGUAGE_SELECTION;
          await sendMessage(chatId, "Welcome to Quantify AI! 👋");
          await sendMessage(chatId, MESSAGES.WELCOME[userState.language || 'en']);
          break;
        }
        if (!userState.data.referral_code) {
          userState.state = STATES.REFERRAL_COLLECTION;
          await sendMessage(
            chatId,
            "Welcome! Please enter your referral code containing 'REF-' or type 'none' to use the default referral code (REF-CZ7B640D)."
          );
          break;
        }
        userState.state = STATES.LANGUAGE_SELECTION;
        await sendMessage(chatId, "Welcome to Quantify AI! 👋");
        await sendMessage(chatId, MESSAGES.WELCOME[userState.language || 'en']);
        break;
      }
      
      case STATES.REFERRAL_COLLECTION: {
        const input = message.trim();
        if (input.toLowerCase() === 'none') {
          userState.data.referral_code = 'REF-CZ7B640D';
        } else {
          const extractedCode = extractReferralCodeFromMessage(input);
          if (extractedCode) {
            userState.data.referral_code = extractedCode;
          } else {
            await sendMessage(
              chatId,
              "Invalid referral code format. Please include a referral code containing 'REF-' or type 'none' to use the default referral code (REF-CZ7B640D)."
            );
            break;
          }
        }
        console.log('[DEBUG] Referral code collected:', userState.data.referral_code);
        await saveUserData(userState, chatId);
        userState.state = STATES.LANGUAGE_SELECTION;
        await sendMessage(chatId, "Welcome to Quantify AI! 👋");
        await sendMessage(chatId, MESSAGES.WELCOME[userState.language || 'en']);
        break;
      }
      
      case STATES.LANGUAGE_SELECTION: {
        const trimmedMessage = message.trim();
        if (['1', '2', '3'].includes(trimmedMessage)) {
          userState.language = trimmedMessage === '1' ? 'en' : trimmedMessage === '2' ? 'ms' : 'zh';
          userState.state = STATES.NAME_COLLECTION;
          console.log('[DEBUG] Language selected:', userState.language);
          await sendMessage(chatId, MESSAGES.ASK_NAME[userState.language]);
        } else {
          console.log('[DEBUG] Invalid language selection');
          await sendMessage(chatId, MESSAGES.INVALID_INPUT['en']);
        }
        break;
      }
      
      case STATES.NAME_COLLECTION: {
        if (!message.trim()) {
          console.log('[DEBUG] Empty name input');
          await sendMessage(chatId, MESSAGES.INVALID_INPUT[language]);
        } else {
          userState.data.name = message.trim();
          console.log('[DEBUG] Name collected:', userState.data.name);
          await saveUserData(userState, chatId);
          userState.state = STATES.PATH_SELECTION;
          await sendMessage(chatId, MESSAGES.ASK_LOAN_DETAILS[language]);
        }
        break;
      }
      
      case STATES.PATH_SELECTION: {
        console.log('[DEBUG] Path selection input:', message);
        if (message === '1') {
          userState.state = STATES.PATH_A_LOAN_AMOUNT;
          console.log('[DEBUG] User chose Path A');
          await saveUserData(userState, chatId);
          await sendMessage(chatId, MESSAGES.PATH_A_LOAN_AMOUNT[language]);
        } else if (message === '2') {
          userState.state = STATES.PATH_B_ORIGINAL_LOAN_AMOUNT;
          console.log('[DEBUG] User chose Path B');
          await saveUserData(userState, chatId);
          await sendMessage(chatId, MESSAGES.PATH_B_ORIGINAL_LOAN_AMOUNT[language]);
        } else {
          console.log('[DEBUG] Invalid input at PATH_SELECTION');
          await sendMessage(chatId, MESSAGES.INVALID_INPUT[language]);
        }
        break;
      }
      
      case STATES.PATH_A_LOAN_AMOUNT: {
        console.log('[DEBUG] PATH_A_LOAN_AMOUNT input:', message);
        const loanAmountValidation = validateLoanAmount(parseFloat(message), language);
        if (!loanAmountValidation.valid) {
          return await sendMessage(chatId, loanAmountValidation.message);
        }
        userState.data.loanAmount = parseFloat(message);
        await saveUserData(userState, chatId);
        userState.state = STATES.PATH_A_TENURE;
        await sendMessage(chatId, MESSAGES.PATH_A_TENURE[language]);
        break;
      }
      
      case STATES.PATH_A_TENURE: {
        console.log('[DEBUG] PATH_A_TENURE input:', message);
        const tenureValidation = validateTenure(parseInt(message), 5, 35, language);
        if (!tenureValidation.valid) {
          return await sendMessage(chatId, tenureValidation.message);
        }
        userState.data.tenure = parseInt(message);
        await saveUserData(userState, chatId);
        userState.state = STATES.PATH_A_INTEREST_RATE;
        await sendMessage(chatId, MESSAGES.PATH_A_INTEREST_RATE[language]);
        break;
      }
      
      case STATES.PATH_A_INTEREST_RATE: {
        console.log('[DEBUG] PATH_A_INTEREST_RATE input:', message);
        const interestRateValidation = validateInterestRate(parseFloat(message), language);
        if (!interestRateValidation.valid) {
          return await sendMessage(chatId, interestRateValidation.message);
        }
        userState.data.interestRate = parseFloat(message);
        console.log('[DEBUG] Path A Inputs before calculation:', JSON.stringify(userState.data, null, 2));

        const pathAResults = await performPathACalculation(
          userState.data.loanAmount,
          userState.data.tenure,
          userState.data.interestRate
        );

        console.log('[DEBUG] Path A Calculation Results:', JSON.stringify(pathAResults, null, 2));

        if (!pathAResults) {
          await sendMessage(
            chatId,
            'No suitable rates found for your loan amount. Please contact support.'
          );
          userState.state = STATES.DONE;
          break;
        }

        userState.data.currentRepayment = pathAResults.currentRepayment || 0;
        console.log(`[DEBUG] Path A currentRepayment set to ${userState.data.currentRepayment}`);

        if (pathAResults.lifetimeSavings <= 0 || pathAResults.monthlySavings <= 0) {
          await sendMessage(
            chatId,
            'Your current loan terms are already optimal. Refinancing might not be beneficial at this time.'
          );
          userState.state = STATES.DONE;
          break;
        }

        if (pathAResults.lifetimeSavings < 10000) {
          await sendMessage(
            chatId,
            'The savings from refinancing are below RM10,000. It might not be worth refinancing at this time.'
          );
          userState.state = STATES.DONE;
          break;
        }

        const summaryTranslationA = SUMMARY_TRANSLATIONS[userState.language];
        const summaryMessage = `
${summaryTranslationA.header}
- ${summaryTranslationA.monthlySavings}: ${formatCurrency(pathAResults.monthlySavings)}
- ${summaryTranslationA.yearlySavings}: ${formatCurrency(pathAResults.yearlySavings)}
- ${summaryTranslationA.totalSavings}: ${formatCurrency(pathAResults.lifetimeSavings)}
- ${summaryTranslationA.newRepayment}: ${formatCurrency(pathAResults.newMonthlyRepayment)}
- ${summaryTranslationA.bank}: ${pathAResults.bankname} (${summaryTranslationA.interestRate}: ${pathAResults.newInterestRate}%)

${summaryTranslationA.analysis}
        `.trim();

        await sendMessage(chatId, summaryMessage);

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
          await sendMessage(chatId, convincingMessageA);

          await sendMessage(
            chatId,
            'Thank you for using our service! If you have any questions, please contact our admin at wa.me/60126181683. If you would like to restart the process, simply type "restart".'
          );

          // Immediately create the lead and notify admin.
          await createLeadAndNotify(userState, chatId, sendMessage, client);
        } catch (error) {
          console.error('[DEBUG] Error generating convincing message for Path A:', error.message);
          await sendMessage(
            chatId,
            'An error occurred while generating the convincing message. Please contact support.'
          );
          await sendLeadSummaryToAdmin(userState, client, chatId, sendMessage);
          await createLeadAndNotify(userState, chatId, sendMessage, client);
        }
        break;
      }
      
      case STATES.PATH_B_ORIGINAL_LOAN_AMOUNT: {
        console.log('[DEBUG] PATH_B_ORIGINAL_LOAN_AMOUNT input:', message);
        const originalLoanAmountValidation = validateLoanAmount(parseFloat(message), language);
        if (!originalLoanAmountValidation.valid) {
          return await sendMessage(chatId, originalLoanAmountValidation.message);
        }
        userState.data.originalLoanAmount = parseFloat(message);
        await saveUserData(userState, chatId);
        userState.state = STATES.PATH_B_ORIGINAL_TENURE;
        await sendMessage(chatId, MESSAGES.PATH_B_ORIGINAL_TENURE[language]);
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
          return await sendMessage(chatId, originalTenureValidation.message);
        }
        userState.data.originalTenure = parseInt(message);
        await saveUserData(userState, chatId);
        userState.state = STATES.PATH_B_MONTHLY_PAYMENT;
        await sendMessage(chatId, MESSAGES.PATH_B_MONTHLY_PAYMENT[language]);
        break;
      }
      
      case STATES.PATH_B_MONTHLY_PAYMENT: {
        console.log('[DEBUG] PATH_B_MONTHLY_PAYMENT input:', message);
        const repaymentValidation = validateRepayment(parseFloat(message), language);
        if (!repaymentValidation.valid) {
          return await sendMessage(chatId, repaymentValidation.message);
        }
        userState.data.monthlyPayment = parseFloat(message);
        await saveUserData(userState, chatId);
        userState.state = STATES.PATH_B_YEARS_PAID;
        await sendMessage(chatId, MESSAGES.PATH_B_YEARS_PAID[language]);
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
          return await sendMessage(chatId, yearsPaidValidation.message);
        }
        userState.data.yearsPaid = parseInt(message);
        await saveUserData(userState, chatId);

        console.log('[DEBUG] Path B Inputs before calculation:', JSON.stringify(userState.data, null, 2));

        try {
          const pathBResults = await performPathBCalculation(
            userState.data.originalLoanAmount,
            userState.data.originalTenure,
            userState.data.monthlyPayment,
            userState.data.yearsPaid
          );

          console.log('[DEBUG] Path B Calculation Results:', JSON.stringify(pathBResults, null, 2));

          if (pathBResults.lifetimeSavings <= 0 || pathBResults.monthlySavings <= 0) {
            await sendMessage(
              chatId,
              'Your current loan terms are already optimal. Refinancing might not be beneficial at this time.'
            );
            userState.state = STATES.DONE;
            break;
          }

          if (pathBResults.lifetimeSavings < 10000) {
            await sendMessage(
              chatId,
              'The savings from refinancing are below RM10,000. It might not be worth refinancing at this time.'
            );
            userState.state = STATES.DONE;
            break;
          }

          const summaryTranslationB = SUMMARY_TRANSLATIONS[userState.language];
          const summaryMessageB = `
${summaryTranslationB.header}
- ${summaryTranslationB.monthlySavings}: ${formatCurrency(pathBResults.monthlySavings)}
- ${summaryTranslationB.yearlySavings}: ${formatCurrency(pathBResults.yearlySavings)}
- ${summaryTranslationB.totalSavings}: ${formatCurrency(pathBResults.lifetimeSavings)}
- ${summaryTranslationB.newRepayment}: ${formatCurrency(pathBResults.newMonthlyRepayment)}
- ${summaryTranslationB.bank}: ${pathBResults.bankname} (${summaryTranslationB.interestRate}: ${pathBResults.newInterestRate}%)

${summaryTranslationB.analysis}
          `.trim();

          await sendMessage(chatId, summaryMessageB);

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
            await sendMessage(chatId, convincingMessageB);

            await sendMessage(
              chatId,
              'Thank you for using our service! If you have any questions, please contact our admin at wa.me/60126181683. If you would like to restart the process, simply type "restart".'
            );

            // Immediately create the lead and notify admin.
            await createLeadAndNotify(userState, chatId, sendMessage, client);
          } catch (error) {
            console.error('[DEBUG] Error generating convincing message for Path B:', error.message);
            await sendMessage(
              chatId,
              'An error occurred while generating the convincing message. Please contact support.'
            );
            await sendLeadSummaryToAdmin(userState, client, chatId, sendMessage);
            await createLeadAndNotify(userState, chatId, sendMessage, client);
          }
        } catch (error) {
          console.error(`[DEBUG] Error in Path B Calculation: ${error.message}`);
          await sendMessage(
            chatId,
            'An error occurred while processing your refinancing details. Please try again.'
          );
        }
        break;
      }
      
      case STATES.COMPLETE: {
        console.log('[DEBUG] In COMPLETE state. Creating lead on portal...');
        await createLeadAndNotify(userState, chatId, sendMessage, client);
        break;
      }
      
      default: {
        console.log('[DEBUG] Default case triggered. Invalid state?');
        await sendMessage(chatId, 'Invalid state. Please type "restart" to start again.');
        break;
      }
    }
  } catch (error) {
    console.error(`[DEBUG] Error in handleState: ${error.message}`);
    await sendMessage(
      chatId,
      'An unexpected error occurred. Please try again or contact support.'
    );
  }
}

// Export only what you need.
module.exports = {
  initializeUserState,
  handleState,
  sendLeadSummaryToAdmin,
};
