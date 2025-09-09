import express from 'express';
import cors from 'cors';

const app = express();

// Middleware to handle JSON and CORS
app.use(express.json());
app.use(cors());

// This reads the secret URL you stored in Vercel's environment variables
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_MRWOO; // Using your custom variable name

// The API endpoint the chatbot widget will call
app.post('/api/chat', async (req, res) => {
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

// Export the app for Vercel using the new syntax
export default app;
