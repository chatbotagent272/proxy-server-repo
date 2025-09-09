const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();

// Middleware to handle JSON and CORS
app.use(express.json());
app.use(cors());

// This reads the secret URL you stored in Vercel's environment variables
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_MRWOO;

// The API endpoint the chatbot widget will call
app.post('/api/chat', async (req, res) => {
  // Check if the webhook URL is configured
  if (!N8N_WEBHOOK_URL) {
    return res.status(500).json({ error: 'Webhook URL is not configured.' });
  }

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      throw new Error(`n8n workflow responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'An error occurred in the proxy server.' });
  }
});

// Export the app for Vercel
module.exports = app;
