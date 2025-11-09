import { registerAs } from '@nestjs/config';

export default registerAs('vonage', () => ({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
  phoneNumber: process.env.VONAGE_PHONE_NUMBER,
  applicationId: process.env.VONAGE_APPLICATION_ID,
  webhookBaseUrl: process.env.VONAGE_WEBHOOK_BASE_URL || process.env.TWILIO_WEBHOOK_BASE_URL || 'http://localhost:3000',
  // Enable simulation mode to test without making real calls
  // Set to 'true' to simulate calls without using Vonage
  simulateCalls: process.env.VONAGE_SIMULATE_CALLS === 'true',
}));

