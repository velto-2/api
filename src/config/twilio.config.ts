import { registerAs } from '@nestjs/config';

export default registerAs('twilio', () => ({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  webhookBaseUrl: process.env.TWILIO_WEBHOOK_BASE_URL || 'http://localhost:3000',
  // Enable simulation mode to test without making real calls
  // Set to 'true' to simulate calls without using Twilio
  simulateCalls: process.env.TWILIO_SIMULATE_CALLS === 'true',
}));


