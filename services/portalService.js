// portalService.js
const axios = require('axios');
const PORTAL_LEADS_URL = process.env.PORTAL_API_URL || 'https://qaichatbot.chat/api/leads';

// Trim the API key to remove any extra spaces
const LEADS_API_KEY = (process.env.LEADS_API_KEY || '').trim();

async function createLeadOnPortal(leadData) {
  try {
    console.log('[DEBUG] Sending payload to portal:', JSON.stringify(leadData, null, 2));
    console.log('[DEBUG] Using API Key:', LEADS_API_KEY);
    const response = await axios.post(
      PORTAL_LEADS_URL,
      leadData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': LEADS_API_KEY
        }
      }
    );
    console.log('[INFO] Lead created on portal:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error(
      '[ERROR] Failed to create lead on portal:',
      error.response ? JSON.stringify(error.response.data, null, 2) : error.message
    );
    throw error;
  }
}

module.exports = {
  createLeadOnPortal,
};
