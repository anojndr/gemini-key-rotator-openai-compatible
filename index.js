require('dotenv').config();

const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 1507;

let apiKeys = [];
let currentKeyIndex = 0;

function loadConfig() {
  // First try environment variable
  if (process.env.GEMINI_API_KEYS) {
    apiKeys = process.env.GEMINI_API_KEYS.split(',').map(key => key.trim()).filter(key => key.length > 0);
    console.log(`Loaded ${apiKeys.length} API keys from environment variable`);
    return;
  }

  // Fall back to config.json
  try {
    const config = require('./config.json');
    apiKeys = config.apiKeys || [];
    console.log(`Loaded ${apiKeys.length} API keys from config.json`);
  } catch (error) {
    console.error('Error loading config file:', error.message);
    console.warn('No API keys found. Set GEMINI_API_KEYS environment variable or create config.json.');
    console.warn('Environment variable example: GEMINI_API_KEYS="key1,key2,key3"');
    console.warn('Config file example: {"apiKeys": ["key1", "key2", "key3"]}');
  }
}

function getNextApiKey() {
  if (apiKeys.length === 0) {
    const error = new Error('No API keys configured');
    console.error('getNextApiKey failed:', error.message);
    throw error;
  }
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  console.log(`Using API key ${currentKeyIndex + 1}/${apiKeys.length}`);
  return key;
}

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path} from ${req.ip}`);
  next();
});

// Body parsing with error handling
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (error) {
      console.error('JSON parsing error:', error.message);
      console.error('Request body preview:', buf.toString().substring(0, 200));
    }
  }
}));

app.use(express.raw({ 
  type: '*/*', 
  limit: '50mb'
}));

// Error handling middleware for body parsing
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    console.error('Body parsing error:', error.message);
    console.error('Request details:', {
      method: req.method,
      url: req.url,
      headers: req.headers,
      ip: req.ip
    });
    return res.status(400).json({ 
      error: 'Invalid request body',
      message: error.message 
    });
  }
  next();
});

app.use('/v1beta', async (req, res) => {
  let targetUrl;
  try {
    const targetPath = req.originalUrl;
    targetUrl = `https://generativelanguage.googleapis.com${targetPath.split('?')[0]}`;
    
    const apiKey = getNextApiKey();
    const isGcpPath = req.originalUrl.includes('/openai/') || req.originalUrl.includes('/embeddings');
    
    const config = {
      method: req.method,
      url: targetUrl,
      headers: {
        ...req.headers,
        'host': 'generativelanguage.googleapis.com'
      },
      params: req.query,
      validateStatus: () => true
    };

    if (isGcpPath) {
      config.headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      config.params.key = apiKey;
      delete config.headers['authorization'];
    }

    delete config.headers['content-length'];

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.is('application/json')) {
        config.data = req.body;
        config.headers['Content-Type'] = 'application/json';
      } else {
        config.data = req.body;
        if (req.headers['content-type']) {
          config.headers['Content-Type'] = req.headers['content-type'];
        }
      }
    }

    console.log(`${req.method} ${targetUrl}`);
    
    const response = await axios(config);
    
    Object.keys(response.headers).forEach(key => {
      if (key.toLowerCase() !== 'transfer-encoding') {
        res.set(key, response.headers[key]);
      }
    });
    
    res.status(response.status);
    res.send(response.data);
    
  } catch (error) {
    console.error('Proxy error for', req.method, targetUrl || req.originalUrl);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      headers: error.response?.headers,
      stack: error.stack
    });
    
    if (error.response) {
      console.error('API response error:', error.response.status, error.response.statusText);
      res.status(error.response.status);
      res.send(error.response.data);
    } else {
      console.error('Network or configuration error:', error.message);
      res.status(500).json({
        error: 'Proxy server error',
        message: error.message
      });
    }
  }
});

app.get('/health', (req, res) => {
  try {
    res.json({
      status: 'healthy',
      apiKeysConfigured: apiKeys.length,
      currentKeyIndex: currentKeyIndex
    });
  } catch (error) {
    console.error('Health endpoint error:', error.message, error.stack);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

app.get('/rotate-key', (req, res) => {
  try {
    if (apiKeys.length === 0) {
      console.warn('Rotate key attempted but no API keys configured');
      return res.status(400).json({ error: 'No API keys configured' });
    }
    
    const oldIndex = currentKeyIndex;
    currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
    
    console.log(`Manual key rotation: ${oldIndex} -> ${currentKeyIndex}`);
    
    res.json({
      message: 'API key rotated',
      previousIndex: oldIndex,
      currentIndex: currentKeyIndex,
      totalKeys: apiKeys.length
    });
  } catch (error) {
    console.error('Rotate key endpoint error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to rotate API key',
      message: error.message
    });
  }
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

loadConfig();

const server = app.listen(PORT, () => {
  console.log(`Gemini API Key Rotator Proxy running on http://localhost:${PORT}`);
  console.log(`Base URL for OpenAI-compatible requests: http://localhost:${PORT}/v1beta/openai/`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Manual key rotation: http://localhost:${PORT}/rotate-key`);
});

server.on('error', (error) => {
  console.error('Server error:', error.message);
  console.error('Error code:', error.code);
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please use a different port or stop the existing process.`);
  }
  process.exit(1);
});