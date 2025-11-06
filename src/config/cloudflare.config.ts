import { registerAs } from '@nestjs/config';

export default registerAs('cloudflare', () => ({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
  baseUrl: process.env.CLOUDFLARE_BASE_URL || 'https://api.cloudflare.com/client/v4',
}));


