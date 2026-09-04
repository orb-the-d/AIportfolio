// Vercel serverless function: POST /api/contact
// Lets a visitor leave a message without ever seeing Djamal's real email
// address in the page source — the address only ever lives server-side, as
// an environment variable, so it can't be scraped for spam/spearphishing.
// On submit, this sends Djamal a notification email (via Resend) containing
// the visitor's message and their reply-to address, if they gave one.
//
// Required environment variables (set in Vercel's dashboard, never in code):
//  - RESEND_API_KEY   — API key from https://resend.com (free tier is fine)
//  - CONTACT_TO_EMAIL — the address that should receive notifications
//                        (djamaleddinedjeddou@gmail.com)
//  - CONTACT_FROM_EMAIL — optional; the "from" address Resend sends as. Must
//                        be on a domain you've verified with Resend. If you
//                        haven't verified a domain yet, leave this unset and
//                        it falls back to Resend's shared test sender
//                        (onboarding@resend.dev) — that one only works if
//                        CONTACT_TO_EMAIL is the same address you signed up
//                        to Resend with, so verifying your own domain is the
//                        real fix once you're ready to go live.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message, website } = req.body || {};

  // Honeypot: a real visitor never fills this hidden field in; a bot
  // filling every field usually does. Pretend success so bots don't learn
  // to look for a different tell.
  if (website) {
    return res.status(200).json({ ok: true });
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: 'Message is too long' });
  }
  if (email && typeof email === 'string' && email.trim()) {
    const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!looksLikeEmail) {
      return res.status(400).json({ error: 'That email address doesn\'t look right' });
    }
  }

  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_TO_EMAIL) {
    console.error('RESEND_API_KEY or CONTACT_TO_EMAIL is not set in this deployment\'s environment variables.');
    return res.status(500).json({
      error: "The contact form isn't fully configured yet — the site owner needs to add RESEND_API_KEY and CONTACT_TO_EMAIL in the hosting dashboard."
    });
  }

  const safeName = (name && String(name).trim().slice(0, 120)) || 'Someone';
  const safeEmail = (email && String(email).trim().slice(0, 200)) || null;
  const safeMessage = String(message).trim().slice(0, 4000);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM_EMAIL || 'Portfolio <onboarding@resend.dev>',
        to: [process.env.CONTACT_TO_EMAIL],
        reply_to: safeEmail || undefined,
        subject: `New portfolio message from ${safeName}`,
        text: `${safeName} left a message on your portfolio site.\n\n` +
          (safeEmail ? `Their email: ${safeEmail}\n\n` : `They didn't leave a reply email.\n\n`) +
          `Message:\n${safeMessage}`
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', response.status, data);
      return res.status(200).json({
        error: "Sorry, that couldn't be sent just now. Please try again in a moment."
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Request to Resend failed:', err);
    return res.status(500).json({ error: 'Failed to send the message' });
  }
}
