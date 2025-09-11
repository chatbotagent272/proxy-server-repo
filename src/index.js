import express from 'express';
import cors from 'cors';
import crypto from 'crypto'; // Import the crypto module to generate IDs

const app = express();

// Middleware to handle JSON and CORS
app.use(express.json());
app.use(cors());

// The API endpoint the chatbot widget will call
app.post('/api/chat', async (req, res) => {
  // This reads the secret URL you stored in Vercel's environment variables
  const n8nWebhookUrl = process.env.TEST;

  if (!n8nWebhookUrl) {
    console.error('Webhook URL is not configured.');
    return res.status(500).json({ error: 'Webhook URL is not configured.' });
  }

  try {
    // Check for a session ID from the widget, or generate a new one.
    const sessionId = req.body.sessionId || req.body.user?.sessionId || crypto.randomUUID();

    // Construct the payload with the nested user object n8n expects.
    const payload = { ...req.body };
    payload.user = {
      ...(payload.user || {}),
      sessionId: sessionId
    };
    // Clean up top-level sessionId to avoid redundancy
    delete payload.sessionId;


    // This block correctly prepares and sends the request to n8n
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      // Send the new payload with the nested user.sessionId
      body: JSON.stringify(payload),
    });

    // Check if the n8n server responded with an error
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`n8n workflow responded with status: ${response.status}`, errorText);
        throw new Error(`n8n workflow responded with status: ${response.status}`);
    }

    // Get the response as text to handle empty bodies gracefully
    const responseText = await response.text();

    // If n8n returns an empty response, send back an empty object.
    if (!responseText) {
      return res.status(200).json({});
    }

    // This block handles the successful response from n8n
    const responseData = JSON.parse(responseText);
    res.status(200).json(responseData);

  } catch (error) {
    console.error('Proxy Error:', error.message);
    if (!res.headersSent) {
        res.status(500).json({ error: 'An error occurred while proxying the request.' });
    }
  }
});

// Export the app for Vercel
export default app;
