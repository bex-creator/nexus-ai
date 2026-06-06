export default {
  async fetch(request, env) {
    // 1. Handle CORS Preflight requests so your browser doesn't block the request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // 2. Only allow POST requests for generating text
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      // Parse the incoming request from your frontend (hello.html)
      const body = await request.json();
      
      // Construct the Pollinations API URL
      const apiUrl = new URL('https://text.pollinations.ai/');

      // Forward the request to Pollinations AI, adding your secret key securely
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Accessing the secret key stored safely in Cloudflare Environment variables
          'Authorization': `Bearer ${env.POLLINATIONS_SECRET_KEY}` 
        },
        body: JSON.stringify(body)
      });

      // Get the response text from Pollinations
      const data = await response.text();

      // Send the response back to your website with CORS headers
      return new Response(data, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain'
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        }
      });
    }
  }
};
