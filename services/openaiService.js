const axios = require('axios');
const logger = require('../config/logger');

// Centralized API Configuration
const BASE_URL = 'https://api.openai.com/v1/chat/completions';
const HEADERS = {
  Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
  'Content-Type': 'application/json',
};

// GPT-4 API Call for Convincing Message
const callGpt4Api = async (messages, temperature = 0.7) => {
  try {
    const response = await axios.post(
      BASE_URL,
      { model: 'gpt-4', messages, temperature },
      { headers: HEADERS }
    );
    return response.data.choices[0].message.content.trim();
  } catch (error) {
    logger.error(`Error in GPT-4 API call: ${error.message}`);
    throw new Error('Failed to retrieve response from GPT-4.');
  }
};

// Helper to Format Numerical Values
const formatValue = (value) => {
  const num = parseFloat(value);
  return isNaN(num) ? '0.00' : num.toLocaleString('en-MY', { minimumFractionDigits: 2 });
};

// Generate Convincing Message (GPT-4)
const generateConvincingMessage = async (savingsData, language = 'en') => {
  // System roles based on language
  const languageSpecificSystemRole = {
    en: 'You are a professional financial assistant specializing in refinancing. Respond in English.',
    ms: 'Anda adalah seorang pembantu kewangan profesional yang pakar dalam pembiayaan semula. Jawab dalam Bahasa Melayu.',
    zh: '您是一位专业的财务助理，专门从事再融资。用中文回答。',
  };

  // Prompts based on language
  const languageSpecificPrompt = {
    en: `You are Quantify AI Assistant, a friendly and professional consultant specializing in refinancing solutions. 
         Focus first on presenting the user's potential savings clearly and confidently. Then, explain why refinancing is an opportunity many homeowners overlook. 
         Highlight that banks benefit from borrowers continuing to pay higher interest rates, but refinancing empowers users to save more and invest in their future, a holiday getaway, or even an upgrade of lifestyle. 
         Keep the tone approachable, helpful, and reassuring, positioning yourself as a knowledgeable partner in financial improvement. 
         The response should be concise, persuasive, and less than 500 characters. Avoid greetings and closings.`,
    ms: `Anda adalah Pembantu AI Quantify, seorang perunding mesra dan profesional yang pakar dalam penyelesaian pembiayaan semula. 
         Fokus terlebih dahulu pada menyampaikan penjimatan pengguna dengan jelas dan yakin. Kemudian, jelaskan mengapa pembiayaan semula adalah peluang yang banyak pemilik rumah terlepas pandang. 
         Tekankan bahawa bank mendapat manfaat daripada peminjam yang terus membayar kadar faedah yang lebih tinggi, tetapi pembiayaan semula memberi kuasa kepada pengguna untuk menjimatkan lebih banyak dan melabur dalam masa depan mereka, percutian impian, atau gaya hidup yang lebih baik. 
         Nada harus mesra, membantu, dan meyakinkan, menunjukkan bahawa anda adalah rakan kongsi yang berpengetahuan dalam peningkatan kewangan. 
         Respons mestilah ringkas, meyakinkan, dan kurang daripada 500 aksara. Elakkan salam dan penutup.`,
    zh: `您是 Quantify AI 助手，一名专业的友好顾问，专门从事再融资解决方案。 
         首先专注于清晰而自信地展示用户的潜在节省。然后解释为什么再融资是许多房主忽视的一个机会。 
         强调银行受益于借款人继续支付较高利率，但再融资使用户能够节省更多，投资于他们的未来、度假或提升生活方式。 
         语气应是亲切、乐于助人和令人放心的，彰显您是财务改进方面的知识渊博的合作伙伴。 
         响应应该简洁、有说服力，并少于500个字符。避免问候和结束语。`,
  };

  // Dynamically select system role and prompt
  const systemRole = languageSpecificSystemRole[language] || languageSpecificSystemRole.en;
  const selectedPrompt = languageSpecificPrompt[language] || languageSpecificPrompt.en;

  // Build the full prompt
  const prompt = `
    ${selectedPrompt}

    Based on the following savings details:
    - Monthly Savings: RM${formatValue(savingsData.monthlySavings)}
    - Yearly Savings: RM${formatValue(savingsData.yearlySavings)}
    - Lifetime Savings: RM${formatValue(savingsData.lifetimeSavings)}
    - New Monthly Repayment: RM${formatValue(savingsData.newMonthlyRepayment)}
    - Interest Rate: ${formatValue(savingsData.newInterestRate)}%
    - Bank: ${savingsData.bankname}
  `;

  try {
    logger.info(`Sending prompt to GPT-4: ${prompt}`);
    const messages = [
      { role: 'system', content: systemRole },
      { role: 'user', content: prompt },
    ];
    const convincingMessage = await callGpt4Api(messages);
    logger.info('Generated convincing message from GPT-4.');
    return convincingMessage;
  } catch (error) {
    logger.error(`Error generating convincing message: ${error.message}`);
    return language === 'ms'
      ? 'Pembiayaan semula boleh menjimatkan jumlah yang besar sepanjang tempoh pinjaman anda. Hubungi kami untuk maklumat lanjut.'
      : language === 'zh'
      ? '再融资可以帮助您在贷款期限内节省大量资金。联系我们了解更多信息。'
      : 'Refinancing could save you significant amounts over time. Contact us to learn more about optimizing your finances.';
  }
};

module.exports = { generateConvincingMessage };
