# Djamal Eddine — AI-Native Portfolio

A single-page, chat-first portfolio: a big greeting + avatar on load, one input box
("Ask me anything..."), and quick-topic pills (Me / Projects / Skills / Fun / Contact).
Asking a question — by typing or tapping a pill — transitions the page into a
conversation: the avatar shrinks to a small pinned indicator, and the AI's answer
streams in as animated, staggered paragraphs.

## Structure

```
djamal-portfolio/
├── index.html                # single page: landing state + conversation state
├── assets/
│   ├── css/styles.css         # white theme, avatar morph animation, blob background
│   ├── js/chat.js              # landing→chat state machine, avatar reactions, message rendering
│   ├── data/bio.json           # ⭐ edit this to update the AI's knowledge of you + contact info
│   ├── images/avatar0.jpg      # calm / idle face
│   ├── images/avatar1.jpg      # big smile — used for reactions & jokes
│   ├── images/avatar2.jpg      # alternate calm angle — used while "thinking"
│   ├── images/avatar3.jpg      # mouth open (frame A) — talking loop
│   ├── images/avatar4.jpg      # mouth open (frame B) — talking loop
│   └── cv/
├── api/chat.js                 # serverless function — holds the API key, calls Anthropic
├── package.json
├── vercel.json
└── .env.example
```

## How the avatar animation works

You gave me 5 real expressions, so this is now genuine face-switching (not just one
image being scaled/tilted):

- **Idle**: `avatar0.jpg`, resting face, with a slow "breathing" scale so it's never frozen
- **Thinking**: switches to `avatar2.jpg` with a pulsing ring while waiting on the AI
- **Talking**: while the answer's text is revealing, it alternates `avatar3.jpg` ↔
  `avatar4.jpg` every ~220ms — a simple two-frame mouth-flap loop
- **Reacting / happy**: `avatar1.jpg` (the big smile) plays briefly for the Contact
  card and for jokes (off-topic deflections)

Want more nuance (e.g. a genuine "surprised" or "listening" look)? Send more crops and
I'll add more states — the mapping lives at the top of `assets/js/chat.js` (`FACE`
object), easy to extend.

## The mouse-reactive background

The blurred color trail behind the cursor is a WebGL fluid simulation (`assets/js/fluid-init.js`),
rendered full-page on a transparent canvas behind everything. The nav pills and the
chat input use `backdrop-filter: blur(...)` with a translucent white background, so
whatever color the fluid painted underneath shows through, blurred — that's the glass
effect you asked for. It only reacts where the canvas actually receives mouse events;
since the pills/input sit on top and capture clicks, color painted *near* them still
diffuses under them from the simulation itself, so it doesn't look dead under a button
you're hovering directly over.

## What changed in this round

- **Bottom nav → glossy "liquid glass" dock.** `pill-row` is now one continuous
  rounded glass bar (specular highlight streak on top + tinted rim) instead of
  five separate cards, styled after the glass/bubble nav bar reference image.
  Same technique now applied to the search input pill so both read as the same
  material.
- **Nav icons.** The five pill icons are now the images you supplied
  (`assets/images/icons/icon-*.png`) instead of emoji.
- **Bigger avatar + rotation.** `.avatar-wrap` grew from 200px to 248px so
  expressions read clearly. The avatar also now settles on a *different* one
  of your 5 supplied photos after every answer (round-robin, see `IDLE_POOL`
  in `chat.js`) instead of always returning to the same resting shot.
- **AI backend fixed, now on Gemini's free tier.** `api/chat.js` had two bugs
  that could make it fail silently in production: the JSON import assertion
  syntax for `bio.json` isn't reliable across Vercel's Node runtimes, and the
  model id was out of date. Both are fixed — it now reads `bio.json` with
  `fs`, calls Google's Gemini API (`gemini-2.0-flash`, part of the free tier —
  no credit card needed), and returns a clear message if `GEMINI_API_KEY`
  isn't set instead of a silent 500.
- **Local fallback.** If `/api/chat` 404s or the request throws (e.g. you
  open `index.html` directly, or host it as plain static files with no
  serverless function behind it), the front end now answers from `bio.json`
  directly instead of showing an error, so the demo always works. Deploy with
  the key set on Vercel and it automatically uses the real AI instead.

## Edit your content

**`assets/data/bio.json`** drives the AI's knowledge (`aiSystemPrompt`) and the
contact card that appears when someone taps "Contact." Update it, nothing else needs
to change.

## Run locally

```bash
npx.cmd serve .          # Windows PowerShell — or `npx serve .` in cmd/bash
```

The chat calls `/api/chat`, so it won't respond locally unless you also run the
serverless function:

```bash
npm i -g vercel
vercel dev
```

Copy `.env.example` to `.env` and set your real key:

```
GEMINI_API_KEY=AI...
```

## Deploy (Vercel)

```bash
npm i -g vercel
vercel
```

Then in the Vercel dashboard: Project → Settings → Environment Variables → add
`GEMINI_API_KEY`, then redeploy.

## Getting a Gemini API key (free)

1. Go to [aistudio.google.com](https://aistudio.google.com), sign in with any
   Google account.
2. Click "Get API key" → "Create API key". No credit card, no billing setup.
3. That's it — the free tier (as of this writing: 15 requests/min, 1,500
   requests/day on `gemini-2.0-flash`) is plenty for a portfolio site's
   traffic. If Google's limits change or you ever want a paid, higher-limit
   tier, the only thing that changes is enabling billing on that same project
   — no code changes needed.

## Notes

- Never put your API key in client-side code — `api/chat.js` is what keeps it safe.
- Consider adding basic rate limiting to `api/chat.js` before sharing the link widely.