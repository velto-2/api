import { registerAs } from '@nestjs/config';

export default registerAs('huggingface', () => ({
  apiKey: process.env.HUGGINGFACE_API_KEY,
  baseUrl: process.env.HUGGINGFACE_BASE_URL || 'https://api-inference.huggingface.co/models',
}));

