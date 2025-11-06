# Cloudflare Configuration Guide

This project uses **Cloudflare Workers AI** for:
1. **Speech-to-Text (STT)**: Whisper model for transcribing agent audio
2. **Large Language Model (LLM)**: LLaMA 3.1 8B for generating digital human responses

## Step 1: Sign Up for Cloudflare (if needed)

1. Go to https://dash.cloudflare.com/sign-up
2. Sign up for a free account
3. Verify your email address

## Step 2: Get Your Account ID

1. Log into Cloudflare Dashboard: https://dash.cloudflare.com/
2. Select any website/zone in your account (or create a test one)
3. Scroll down on the right sidebar - you'll see **Account ID**
4. Copy the Account ID (it's a long alphanumeric string)

**Alternative method:**
- Go to https://dash.cloudflare.com/
- Click on your profile icon (top right)
- Your Account ID is shown in the account selector dropdown

## Step 3: Create an API Token

1. Go to **My Profile** → **API Tokens**: https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Use the **Edit Cloudflare Workers** template, OR create a custom token:
   - **Token name**: `Velto Workers AI` (or any name you prefer)
   - **Permissions**:
     - **Account** → **Workers AI** → **Edit**
   - **Account Resources**:
     - **Include** → **All accounts** (or select your specific account)
4. Click **Continue to summary** → **Create Token**
5. **IMPORTANT**: Copy the token immediately - you won't be able to see it again!

## Step 4: Enable Workers AI (if not already enabled)

1. Go to **Workers & Pages** in the Cloudflare dashboard
2. Click on **AI** in the left sidebar
3. If you see a message about enabling Workers AI, click **Enable Workers AI**
4. This is free for development/testing (with usage limits)

## Step 5: Configure Environment Variables

Add these to your `.env` file in the `velto-api` directory:

```env
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_API_TOKEN=your_api_token_here
```

**Example:**
```env
CLOUDFLARE_ACCOUNT_ID=abc123def456ghi789
CLOUDFLARE_API_TOKEN=your_very_long_api_token_string_here
```

## Step 6: Verify Configuration

1. **Restart your backend server** to load the new environment variables
2. **Check backend logs** - you should see:
   - No warnings about "Cloudflare credentials not found"
   - If you see warnings, double-check your `.env` file

3. **Test the configuration** by creating a test run:
   - The system will use Cloudflare Workers AI for:
     - Generating digital human responses (LLaMA 3.1 8B)
     - Transcribing agent audio (Whisper)

## What Cloudflare Workers AI Provides

### Models Used:

1. **LLaMA 3.1 8B** (`@cf/meta/llama-3.1-8b-instruct`)
   - Used for: Generating digital human conversation responses
   - Location: `velto-api/src/modules/digital-human/strategies/arabic-digital-human.strategy.ts`

2. **Whisper Large V3** (`@cf/openai/whisper-large-v3`)
   - Used for: Transcribing agent audio to text
   - Location: `velto-api/src/modules/speech/providers/cloudflare-whisper.provider.ts`

### API Endpoints Used:

- **LLM**: `POST https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`
- **STT**: `POST https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/run/@cf/openai/whisper-large-v3`

## Free Tier Limits

Cloudflare Workers AI free tier includes:
- **10,000 requests per day** (resets daily)
- **Limited compute time** per request
- Perfect for MVP testing and development

**Note**: For production, you may need to upgrade to a paid plan based on usage.

## Troubleshooting

### Issue: "Cloudflare credentials not found"
**Solution**: 
- Check that `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are set in your `.env` file
- Make sure there are no extra spaces or quotes around the values
- Restart your backend server

### Issue: "401 Unauthorized" errors
**Solution**:
- Verify your API token is correct
- Check that the token has **Workers AI** permissions
- Make sure the Account ID matches the account where the token was created

### Issue: "Model not found" errors
**Solution**:
- Ensure Workers AI is enabled in your Cloudflare account
- Go to **Workers & Pages** → **AI** and verify it's enabled
- Check that you're using the correct model names (they start with `@cf/`)

### Issue: Rate limit errors
**Solution**:
- You've hit the free tier limit (10,000 requests/day)
- Wait for the daily reset, or upgrade to a paid plan
- Check your usage in Cloudflare Dashboard → **Workers & Pages** → **AI**

## Security Notes

⚠️ **Important**:
- Never commit your `.env` file to git
- Never share your API token publicly
- Rotate tokens if exposed
- Use different tokens for development and production
- Store tokens securely (consider using a secrets manager in production)

## Cost Estimation

**Free Tier**: 
- 10,000 requests/day
- Perfect for MVP testing

**Paid Plans** (if needed):
- Pay-as-you-go pricing
- Check current pricing at: https://developers.cloudflare.com/workers-ai/platform/pricing/

## Next Steps

1. ✅ Get Account ID from Cloudflare Dashboard
2. ✅ Create API Token with Workers AI permissions
3. ✅ Add credentials to `.env` file
4. ✅ Enable Workers AI in your account
5. ✅ Restart backend server
6. ✅ Test by creating a test run

## Additional Resources

- Cloudflare Workers AI Docs: https://developers.cloudflare.com/workers-ai/
- Available Models: https://developers.cloudflare.com/workers-ai/models/
- API Reference: https://developers.cloudflare.com/api/operations/workers-ai-post-run-model

