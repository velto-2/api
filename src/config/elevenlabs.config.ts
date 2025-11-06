import { registerAs } from '@nestjs/config';

export default registerAs('elevenlabs', () => ({
  apiKey: process.env.ELEVENLABS_API_KEY,
  baseUrl: process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io/v1',
  // Optional: Default voice ID to use if not specified in language config
  voiceId: process.env.ELEVENLABS_VOICE_ID,
}));


