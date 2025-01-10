const faqs = require('../public/faqs.json'); // Load FAQs JSON
const { generateFaqResponse } = require('../services/openaiService'); // Ensure this is correctly imported

const handleFaqQuery = async (query, language = 'en') => {
  try {
    // Check if the language exists in the FAQ JSON
    if (!faqs[language]?.faq) {
      console.warn(`Language "${language}" not found in FAQs. Falling back to English.`);
      language = 'en'; // Fallback to default language
    }

    const faqList = faqs[language]?.faq || {};

    // Check if the query matches any question in the JSON
    const match = Object.keys(faqList).find((question) =>
      query.toLowerCase().includes(question.toLowerCase())
    );

    if (match) {
      console.log(`Matched FAQ for query "${query}": ${match}`);
      return faqList[match]; // Return the corresponding answer
    }

    // If no match, escalate to GPT
    console.log(`No match found in FAQs for query: "${query}". Escalating to GPT.`);
    const gptResponse = await generateFaqResponse(query, language);
    return gptResponse;
  } catch (error) {
    console.error(`Error in handleFaqQuery: ${error.message}`);
    // Return contact information or a fallback message
    return (
      faqs[language]?.contact ||
      'We are unable to process your request. Please contact our admin for further assistance.'
    );
  }
};

module.exports = { handleFaqQuery };
