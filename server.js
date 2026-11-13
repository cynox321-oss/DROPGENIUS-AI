
const express = require('express');
require('dotenv').config();
const OpenAI = require('openai');
const app = express();
const PORT = process.env.PORT || 3000;
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
      maxRetries: 0
    })
  : null;

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// ---------- Middleware ----------

app.use(express.json({ limit: '10kb' }));

// ---------- Health check ----------

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'DROPGENIUS AI backend is running!'
  });
});
// ---------- AI ping ----------

app.get('/api/ai/ping', (req, res) => {
  res.json({
    success: true,
    mode: openai ? 'live' : 'demo',
    model: openai ? OPENAI_MODEL : null,
    message: openai
      ? 'DROPGENIUS AI is ready for AI requests.'
      : 'DROPGENIUS AI is ready in local demo mode.'
  });
});

// ---------- AI ping ----------

const MAX_MESSAGE_LENGTH = 2000;

app.post('/api/ai/generate', async (req, res) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      error: 'Request body must be a JSON object.'
    });
  }

  const { message } = body;

  if (typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({
      error: 'message is required and must be a non-empty string.'
    });
  }
if (message.length > MAX_MESSAGE_LENGTH) {
  return res.status(400).json({
    error: `message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`
  });
}

const prompt = message.trim();
const query = prompt.toLowerCase();

// Use real AI when an API key is configured.
if (openai) {
  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are DROPGENIUS AI, a helpful ecommerce and business assistant. ' +
            'Give clear, practical answers. Never invent live market data, ' +
            'product features, prices, or supplier details. Tell users when ' +
            'information needs verification.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const aiReply = completion.choices[0]?.message?.content;

    if (typeof aiReply !== 'string' || !aiReply.trim()) {
      return res.status(502).json({
        success: false,
        error: 'The AI model returned an empty response.'
      });
    }

    return res.json({
      success: true,
      mode: 'live',
      reply: aiReply.trim()
    });
  } catch (error) {
    console.error(
      '[DropGenius AI] OpenAI request failed:',
      error.status || error.message || 'Unknown error'
    );

    return res.status(502).json({
      success: false,
      error: 'AI request failed. Check your API configuration and connection.'
    });
  }
}

let reply;
  // GREETING
  if (/^(hi|hello|hey)[!. ]*$/i.test(query)) {
    reply = `Hey! Welcome to DROPGENIUS AI! 🚀

I'm running in LOCAL DEMO MODE.

Try product descriptions, product research, ad copy,
SEO suggestions, business ideas, or pricing calculations.

These are predefined demo responses, not live AI output.`;

  // PRODUCT RESEARCH
  } else if (/product research|product finder|winning product|product ideas/.test(query)) {
    reply = `DROPGENIUS AI — PRODUCT RESEARCH

1. Identify your target audience.
2. Find a problem customers want to solve.
3. Research competitors and customer reviews.
4. Compare supplier costs and selling prices.
5. Estimate profit after expenses.
6. Validate demand before investing.

DEMO NOTE:
This is a research checklist. No live market data is retrieved.`;

  // AD COPY
  } else if (/ad copy|advertising|facebook ads|instagram ads/.test(query)) {
    reply = `DROPGENIUS AI — AD CREATOR

HEADLINE:
Discover a Smarter Way to Shop

AD TEXT:
Looking for a product that fits your needs?
Explore its features, compare your options,
and discover whether it is right for you.

CALL TO ACTION:
Learn More

DEMO NOTE:
Provide your product details to customise this draft.`;

  // DYNAMIC PRODUCT DESCRIPTION
  } else if (/product description|product listing/.test(query)) {
    const extract = (pattern, fallback) => {
      const match = prompt.match(pattern);
      return match && match[1] ? match[1].trim() : fallback;
    };

const productName = extract(
  /product description for\s+(.+?)(?=\s*(?:[.;,]\s*)?(?:category|target audience|main benefit)\s*:|$)/i,
  'Your Product'
);

const category = extract(
  /category:\s*(.+?)(?=\s*(?:[.;,]\s*)?(?:target audience|main benefit)\s*:|$)/i,
  'General'
);

const audience = extract(
  /target audience:\s*(.+?)(?=\s*(?:[.;,]\s*)?main benefit\s*:|$)/i,
  'your target customers'
);

    const benefit = extract(
      /main benefit:\s*(.+?)(?:[.!]+)?$/i,
      'everyday convenience'
    ).replace(/[.!]+$/, '');

    const titleBenefit =
      benefit.charAt(0).toUpperCase() + benefit.slice(1);

    reply = `DROPGENIUS AI — PRODUCT DESCRIPTION (DEMO)

PRODUCT:
${productName}

CATEGORY:
${category}

TARGET AUDIENCE:
${audience}

PRODUCT TITLE:
${productName} — ${titleBenefit}

DESCRIPTION:
Meet ${productName}, designed for ${audience}.
With a focus on ${benefit}, this product aims to fit
into everyday life and address your customers' needs.

Explore how it fits within the ${category} category
and highlight the features that make it useful.

KEY SELLING POINTS:
• ${productName} for ${audience}
• Focus on ${benefit}
• Category: ${category}

FEATURES TO ADD:
• [Enter a verified product feature]
• [Enter an accurate specification]
• [Enter a genuine customer benefit]

DEMO NOTE:
This description uses the information you provided.
Verify product features and claims before publishing.
No live AI model is connected.`;

  // SEO
  } else if (/\bseo\b|keywords|search engine/.test(query)) {
    reply = `DROPGENIUS AI — SEO PLANNER

1. Choose a relevant main keyword.
2. Research related long-tail keywords.
3. Write a clear page title and description.
4. Create useful, original content.
5. Make the page easy to navigate.
6. Monitor performance and improve.

DEMO NOTE:
Live keyword volumes and rankings are unavailable.`;

  // PRICING AND PROFIT
  } else if (/\bpricing\b|\bprice\b|\bprofit\b|\bmargin\b/.test(query)) {
    reply = `DROPGENIUS AI — PRICING GUIDE

Profit = Selling Price - Total Cost

Profit Margin (%) = (Profit / Selling Price) * 100

EXAMPLE:
Selling price: ₹1,000
Total cost: ₹700
Estimated profit: ₹300
Estimated profit margin: 30%

Include shipping, advertising, taxes, returns,
and platform fees in your real calculations.

This example is illustrative, not a profit guarantee.`;

  // BUSINESS IDEAS
  } else if (/business idea|startup idea|business niche/.test(query)) {
    reply = `DROPGENIUS AI — BUSINESS IDEAS

1. Digital study products
2. Personalised gifts and accessories
3. Productivity templates for small businesses

Evaluate customer demand, competition,
startup costs, and your ability to reach customers.

DEMO NOTE:
These are brainstorming examples, not validated opportunities.`;

  // GENERAL RESPONSE
  } else {
    reply = `DROPGENIUS AI — LOCAL DEMO

YOUR REQUEST:
"${prompt}"

SUGGESTED WORKFLOW:

1. Define the goal.
2. Gather relevant information.
3. Compare available options.
4. Create an action plan.
5. Evaluate the results.

Try asking for a product description,
product research, ad copy, SEO suggestions,
business ideas, or a pricing guide.

DEMO LIMITATION:
This version uses predefined keyword-based responses.
It does not generate answers using a real AI model.`;
  }

  return res.json({
    success: true,
    mode: 'demo',
    reply
  });
});

// ---------- 404 handler ----------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found.'
  });
});

// ---------- Centralized error handler ----------

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON in request body.'
    });
  }

  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'Request body too large.'
    });
  }

  console.error(
    'Unhandled error:',
    err && err.message ? err.message : err
  );

  return res.status(500).json({
    success: false,
    error: 'Internal server error.'
  });
});

// ---------- Start ----------

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Backend running at http://127.0.0.1:${PORT}`);
});
