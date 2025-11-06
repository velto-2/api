import { registerAs } from '@nestjs/config';

export default registerAs('payment', () => ({
  moyasar: {
    apiKey: process.env.MOYASAR_API_KEY,
    publishableKey: process.env.MOYASAR_PUBLISHABLE_KEY,
    webhookSecret: process.env.MOYASAR_WEBHOOK_SECRET,
  },
}));