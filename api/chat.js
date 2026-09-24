// Vercel serverless function: POST /api/chat
// Keeps the Gemini API key server-side and grounds every answer in bio.json.
//
// Uses Google's Gemini API instead of a paid provider because Gemini has a
// genuinely free tier (no credit card, no trial period that expires) that's
// more than enough for a personal portfolio site.
//
// RELIABILITY: Google renames/retires specific Gemini model ids over time
// (this file has already been through gemini-2.0-flash -> gemini-3.6-flash ->
// gemini-3.5-flash-lite as older ones stopped working). Rather than betting
// the whole site on one hardcoded model id staying valid forever, this tries
// a short ordered list of candidates and falls through to the next one the
// moment any candidate fails for ANY reason (retired model, rate limit,
// transient 5xx, timeout). Only if every single candidate fails does this
// function return an error — and even then, the frontend (assets/js/chat.js)
// has its own local fallback that answers correctly from bio.json instead of
// showing the visitor a raw error, so a visitor should never actually see
// "something went wrong" even during a bad patch on Google's end.
//
// "-latest" aliases (e.g. gemini-flash-latest) are deliberately placed LAST,
// not first: Google auto-updates what they point to, which is exactly what
// you want in a last-resort fallback (it'll never 404 from being retired)
// but is not recommended as a primary pin because its behavior/quality can
// shift under you without warning. As a safety net specifically, that's fine.
const MODEL_CANDIDATES = [
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest',
];

const PER_ATTEMPT_TIMEOUT_MS = 15000; // leaves room to try all 3 within the 60s function budget in vercel.json

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bio = JSON.parse(
  readFileSync(path.join(__dirname, '../assets/data/bio.json'), 'utf-8')
);

async function callGemini(model, question, apiKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: bio.aiSystemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: question }] }],
          generationConfig: { maxOutputTokens: 200 }
        }),
        signal: controller.signal
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`${model} returned ${response.status}: ${JSON.stringify(data).slice(0, 300)}`);
    }

    const candidate = (data.candidates || [])[0];
    const text = candidate && candidate.content && candidate.content.parts
      ? candidate.content.parts.map((p) => p.text || '').join('')
      : '';

    if (!text) {
      throw new Error(`${model} returned no text (finishReason: ${candidate && candidate.finishReason})`);
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

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
    // No "answer" field here on purpose — this tells the frontend to use its
    // own local fallback instead of displaying an error as if it were a
    // real answer. See assets/js/chat.js's ask().
    return res.status(500).json({ error: 'not_configured' });
  }

  const errors = [];
  for (const model of MODEL_CANDIDATES) {
    try {
      const text = await callGemini(model, question, process.env.GEMINI_API_KEY);
      return res.status(200).json({ answer: text, model });
    } catch (err) {
      const msg = err.name === 'AbortError' ? `${model} timed out after ${PER_ATTEMPT_TIMEOUT_MS}ms` : err.message;
      errors.push(msg);
      console.error('Gemini attempt failed:', msg);
      // fall through to the next candidate
    }
  }

  // Every candidate failed — log the full trail for debugging, but return a
  // plain error (no "answer" field) so the frontend falls back locally
  // instead of showing the visitor a scary "something broke" message.
  console.error('All Gemini model candidates failed:', errors);
  return res.status(502).json({ error: 'all_models_failed' });
}