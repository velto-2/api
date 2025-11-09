import { registerAs } from '@nestjs/config';

export default registerAs('telephony', () => ({
  // Provider selection: 'twilio' or 'vonage'
  provider: process.env.TELEPHONY_PROVIDER || 'twilio',
}));

