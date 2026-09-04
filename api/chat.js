// Vercel serverless function: POST /api/chat
// Keeps the Gemini API key server-side and grounds every answer in bio.json.
//
// Uses Google's Gemini API instead of a paid provider because Gemini has a
// genuinely free tier (no credit card, no trial period that expires) that's
// more than enough for a personal portfolio site — see the setup notes in
// README.md for how to get a key and what the free limits actually are.
//
// Notes on why this is written the way it is (things that commonly break this
// exact setup, fixed here):
//  - bio.json is read with fs.readFileSync instead of a JSON import assertion.
//    Import assertions ("assert { type: 'json' }") depend on the exact Node.js
//    runtime version Vercel builds with; on some runtimes that syntax fails to
//    parse and the whole function 500s before it ever calls the AI. Reading the
//    file at runtime works everywhere and needs no special syntax.
//  - The model id is "gemini-3.6-flash" — the current generally-available
//    Flash model as of Sept 2026. Google retires older model ids over time
//    (this file used to point at gemini-2.0-flash, which stopped working),
//    so if this starts 404ing again in the future, check
//    https://ai.google.dev/gemini-api/docs/models for whatever the current
//    stable Flash model id is and swap it in here.
//  - If GEMINI_API_KEY isn't set in Vercel's environment variables, this now
//    says so explicitly instead of returning a generic failure.

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bio = JSON.parse(
  readFileSync(path.join(__dirname, '../assets/data/bio.json'), 'utf-8')
);

const MODEL = 'gemini-3.6-flash';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { question } = req.body || {};
  if (!question || typeof question !== 'string') {
    return res.status(400).json({ error: 'Missing question' });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in this deployment\'s environment variables.');
    return res.status(500).json({
      answer: "The AI isn't configured yet — the site owner needs to add a GEMINI_API_KEY in the hosting dashboard."
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: bio.aiSystemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: question }] }],
          generationConfig: { maxOutputTokens: 300 }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Surface the real reason (bad model id, bad key, rate limit, etc.)
      // in the server logs so it's actually debuggable.
      console.error('Gemini API error:', response.status, data);
      return res.status(200).json({
        answer: "Sorry, I couldn't reach the AI just now (the AI provider returned an error). Please try again in a moment."
      });
    }

    const candidate = (data.candidates || [])[0];
    const text = candidate && candidate.content && candidate.content.parts
      ? candidate.content.parts.map((p) => p.text || '').join('')
      : '';

    return res.status(200).json({
      answer: text || "Sorry, I couldn't generate a response just now."
    });
  } catch (err) {
    console.error('Request to Gemini failed:', err);
    return res.status(500).json({ error: 'Failed to reach the AI provider' });
  }
}