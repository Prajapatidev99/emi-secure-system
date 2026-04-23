const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require('../utils/logger');

// Local Knowledge Base to save token costs
const KNOWLEDGE_BASE = `
1. HOW TO ADD CUSTOMER: Go to "Customers" tab -> Click "Add Customer" -> Fill name/details.
2. HOW TO REGISTER DEVICE: Go to "Devices" -> "Register Device" -> Scan QR code from device.
3. HOW TO LOCK DEVICE: Find device in list -> Click "Actions" -> Select "Lock".
4. WALLET: Top up wallet to register new devices. Each device costs 100 credits.
5. SECURITY: USB Data is blocked on locked devices. Safe mode is also blocked.
6. CONTACT: Support number is 9876543210.
7. REFUNDS: Contact admin for credit refunds.
`;

class AssistantService {
    constructor() {
        this.genAI = null;
        if (process.env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        }
    }

    async getAnswer(query, lang = 'en') {
        // Step 1: Check if answer is in local KB (Keyword search for token optimization)
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('add') && lowerQuery.includes('customer')) return "To add a customer, go to the 'Customers' tab and click the 'Add Customer' button.";
        if (lowerQuery.includes('lock') && lowerQuery.includes('device')) return "Find the device in your list, click 'Actions', and choose 'Lock'.";
        if (lowerQuery.includes('wallet') || lowerQuery.includes('credit')) return "Top up your wallet in the 'Wallet' tab. Each device registration costs 100 credits.";

        // Step 2: Fallback to AI if KB keyword search fails
        if (!this.genAI) return "I'm currently in offline mode. Please contact technical support for manual assistance.";

        try {
            const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `
                You are a helpful assistant for the "EMI Secure" device management platform used by shopkeepers in India.
                Your goal: Provide extremely short, 1-2 sentence answers to save on display space and tokens.
                Target Language: ${lang}
                
                Product Knowledge:
                ${KNOWLEDGE_BASE}
                
                User Query: ${query}
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            logger.error('Assistant AI Error:', error);
            return "Sorry, I'm having trouble connecting to my AI brain. Try again later.";
        }
    }
}

module.exports = new AssistantService();
