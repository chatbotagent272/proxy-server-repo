import express from 'express';
import cors from 'cors';

const app = express();

// Middleware to handle JSON and CORS
app.use(express.json());
app.use(cors());

// The API endpoint the chatbot widget will call
app.post('/api/chat', async (req, res) => {
  // This reads the secret URL you stored in Vercel's environment variables
  const n8nWebhookUrl = process.env.N8N_WEBHOOK_MRWOO;

  if (!n8nWebhookUrl) {
    console.error('Webhook URL is not configured.');
    return res.status(500).json({ error: 'Webhook URL is not configured.' });
  }

  try {
    // This block correctly prepares and sends the request to n8n
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json', // Added for robustness
      },
      body: JSON.stringify(req.body),
    });

    // Check if the n8n server responded with an error
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`n8n workflow responded with status: ${response.status}`, errorText);
        throw new Error(`n8n workflow responded with status: ${response.status}`);
    }

    // This block handles the successful response from n8n
    const responseData = await response.json();
    res.status(200).json(responseData);

  } catch (error) {
    console.error('Proxy Error:', error.message);
    res.status(500).json({ error: 'An error occurred while proxying the request.' });
  }
});

// Export the app for Vercel
export default app;
