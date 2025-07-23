# Gemini API Key Rotator - OpenAI Compatible Proxy

A simple but powerful proxy server that rotates multiple Gemini API keys to distribute requests and help avoid rate limits. It's designed to be a drop-in replacement for the Gemini API endpoint, offering full compatibility with libraries like `openai-node`.

## Features

- **Automatic Key Rotation**: Rotates API keys in a round-robin fashion for each new request.
- **OpenAI-Compatible**: Acts as a drop-in replacement for `generativelanguage.googleapis.com`, allowing you to use it directly with OpenAI client libraries.
- **Multiple Configuration Methods**: Load API keys from a `.env` file, system environment variables, or a `config.json` file.
- **Health & Management API**: Includes endpoints to check the server's health and manually rotate keys.
- **Detailed Logging**: Provides clear logs for incoming requests, key usage, and errors.
- **Lightweight & Fast**: Built with Express.js for minimal overhead.
- **Graceful Shutdown**: Handles `SIGINT` and `SIGTERM` signals to prevent abrupt termination.

## How It Works

The proxy intercepts requests sent to it. For each request, it picks the next available Gemini API key from your list and forwards the request to the official Google Gemini API endpoint (`https://generativelanguage.googleapis.com`). It transparently handles adding the API key to the request, either as a `key` parameter or as a `Bearer` token for OpenAI-compatible paths.

## 1. Installation

```bash
npm install
```

## 2. Configuration

You can provide your Gemini API keys in one of three ways. The server uses the following priority:
1.  **Environment Variables / `.env` file** (Highest Priority)
2.  `config.json` file (Fallback)

### Option A: `.env` File (Recommended)

1.  Use the handy setup script to create a `.env` file from the example:
    ```bash
    npm run setup
    ```
2.  Edit the newly created `.env` file and add your comma-separated API keys:
    ```.env
    # .env
    GEMINI_API_KEYS=your_actual_key_1,your_actual_key_2,your_actual_key_3

    # Optional: Change the default port
    # PORT=8000
    ```

### Option B: Environment Variables

Set the `GEMINI_API_KEYS` environment variable directly in your shell or deployment environment.

```bash
export GEMINI_API_KEYS="key1,key2,key3"
```

### Option C: `config.json` File

If no environment variable is found, the server will look for a `config.json` file.

1.  Copy the example file:
    ```bash
    cp config.json.example config.json
    ```
2.  Edit `config.json` and add your keys to the array:
    ```json
    {
      "apiKeys": [
        "your_actual_gemini_api_key_1",
        "your_actual_gemini_api_key_2",
        "your_actual_gemini_api_key_3"
      ]
    }
    ```

## 3. Running the Server

Start the proxy server with:
```bash
npm start
```
You should see output confirming that the server is running and how many keys were loaded:
```
Loaded 3 API keys from environment variable
Gemini API Key Rotator Proxy running on http://localhost:1507
Base URL for OpenAI-compatible requests: http://localhost:1507/v1beta/openai/
Health check: http://localhost:1507/health
Manual key rotation: http://localhost:1507/rotate-key
```

## 4. Usage with OpenAI Library

Update your client code to point to the local proxy server's URL instead of the official Gemini API URL. The `apiKey` in the client can be any non-empty string, as authentication is handled by the proxy.

**Before:**
```javascript
const openai = new OpenAI({
    apiKey: "YOUR_GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});
```

**After:**
```javascript
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: "any-key-will-work", // Not used by the proxy, but required by the library
    baseURL: "http://localhost:1507/v1beta/openai/", // Point to your proxy
});

async function main() {
    const response = await openai.chat.completions.create({
        model: "gemini-2.5-pro", // Use a valid Gemini model
        messages: [
            { role: "user", content: "Hello, how does an API key rotator work?" }
        ],
    });
    console.log(response.choices[0].message);
}

main();
```
The proxy will automatically rotate through the keys you provided for each request you make.

## Management Endpoints

The proxy exposes a few endpoints for management and monitoring:

-   **`GET /health`**
    Checks the status of the proxy.
    *Success Response:*
    ```json
    {
      "status": "healthy",
      "apiKeysConfigured": 3,
      "currentKeyIndex": 0
    }
    ```

-   **`GET /rotate-key`**
    Manually advances to the next API key in the list. Useful for testing or forcing a key change.
    *Success Response:*
    ```json
    {
      "message": "API key rotated",
      "previousIndex": 0,
      "currentIndex": 1,
      "totalKeys": 3
    }
    ```

## Deployment

Here are some examples of how to run this proxy in different environments.

### Docker
First, create a `Dockerfile`:
```Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Expose the default port
EXPOSE 1507

CMD ["npm", "start"]
```
Then build and run:
```bash
# Build the image
docker build -t gemini-proxy .

# Run the container
docker run -d -p 1507:1507 \
  -e GEMINI_API_KEYS="key1,key2,key3" \
  --name gemini-proxy-container \
  gemini-proxy
```

### PM2 (Process Manager)
```bash
# Install PM2 if you haven't already
npm install pm2 -g

# Start the proxy with PM2
# Replace with your actual keys
GEMINI_API_KEYS="key1,key2,key3" pm2 start index.js --name gemini-proxy
```

## Error Logging

The proxy includes comprehensive logging for easier debugging.

### Logged Events
- Server startup and shutdown.
- API key loading status.
- Incoming request details (`method`, `path`, `IP`).
- Which API key is being used for a request.
- Errors from the Gemini API, including status codes and response data.
- Network errors or internal proxy errors.

### Example Error Log
If a request fails (e.g., due to an invalid model name), you'll see a detailed log:
```
2024-07-28T10:30:00.123Z POST /v1beta/openai/chat/completions from ::1
Using API key 1/3
POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
Proxy error for POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
Error details: {
  message: 'Request failed with status code 400',
  ...
}
API response error: 400 Bad Request
```

## License

This project is licensed under the MIT License. See the [LICENSE.md](LICENSE.md) file for details.