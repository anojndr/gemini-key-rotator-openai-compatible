# Gemini API Key Rotator - OpenAI Compatible Proxy

A proxy server that rotates multiple Gemini API keys to distribute requests and avoid rate limits while maintaining OpenAI-compatible endpoints.

## Setup

### Option 1: .env File (Recommended)

1. Install dependencies and set up the environment file:
   ```bash
   npm install
   npm run setup
   ```

2. Edit `.env` and add your actual Gemini API keys:
   ```bash
   GEMINI_API_KEYS=your_actual_key_1,your_actual_key_2,your_actual_key_3
   ```

3. Start the server:
   ```bash
   npm start
   ```

### Option 2: Environment Variable

1. Set your API keys in the GEMINI_API_KEYS environment variable:
   ```bash
   export GEMINI_API_KEYS="key1,key2,key3"
   npm install
   npm start
   ```

### Option 3: Config File

1. Copy the example config:
   ```bash
   cp config.json.example config.json
   ```

2. Edit `config.json` and add your Gemini API keys:
   ```json
   {
     "apiKeys": [
       "your_actual_gemini_api_key_1",
       "your_actual_gemini_api_key_2", 
       "your_actual_gemini_api_key_3"
     ]
   }
   ```

3. Install dependencies and start the server:
   ```bash
   npm install
   npm start
   ```

## Usage

Instead of using:
```javascript
baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
```

Use:
```javascript
baseURL: "http://localhost:1507/v1beta/openai/"
```

The proxy automatically rotates between your configured API keys for each request.

## Example

```javascript
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: "dummy", // Not used, proxy handles authentication
    baseURL: "http://localhost:1507/v1beta/openai/"
});

const response = await openai.chat.completions.create({
    model: "gemini-2.0-flash",
    messages: [
        { role: "user", content: "Hello!" }
    ],
});
```

## API Endpoints

- `http://localhost:1507/v1beta/openai/*` - Proxied Gemini API requests
- `http://localhost:1507/health` - Health check and status
- `http://localhost:1507/rotate-key` - Manually rotate to next API key

## Features

- Automatic API key rotation
- OpenAI library compatibility
- Request forwarding to Gemini API
- Health monitoring
- Manual key rotation
- Multiple configuration options (.env file, environment variables, config file)
- Comprehensive error logging and monitoring
- Graceful shutdown handling
- Request/response logging

## Deployment Examples

### Local Development
```bash
cp .env.example .env
# Edit .env with your API keys
npm start
```

### Docker
```bash
docker run -e GEMINI_API_KEYS="key1,key2,key3" -p 1507:1507 your-app
```

### PM2
```bash
GEMINI_API_KEYS="key1,key2,key3" pm2 start index.js --name gemini-proxy
```

### Systemd
```bash
export GEMINI_API_KEYS="key1,key2,key3"
npm start
```

## Error Logging

The proxy includes comprehensive error logging:

### Logged Events
- Configuration loading errors
- API key rotation events
- Request/response details for all proxied requests
- Network and API errors with full details
- JSON parsing errors
- Server startup/shutdown events
- Uncaught exceptions and unhandled rejections

### Log Levels
- `console.log`: Normal operations (startup, key rotation, requests)
- `console.warn`: Warnings (configuration issues, missing keys)
- `console.error`: Errors (API failures, network issues, exceptions)

### Example Error Log Output
```
2024-07-15T09:10:00.000Z POST /chat/completions from ::1
Proxy error for POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
Error details: {
  message: "Request failed with status code 400",
  code: "ERR_BAD_REQUEST",
  status: 400,
  statusText: "Bad Request"
}
API response error: 400 Bad Request
```