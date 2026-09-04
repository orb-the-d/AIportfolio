let BIO = null;
let started = false;

const stage = document.getElementById('stage');
const avatarWrap = document.getElementById('avatarWrap');
const avatarImg = document.getElementById('avatarImg');
const chatHeaderAvatar = document.querySelector('.chat-header-avatar');
const messages = document.getElementById('messages');
const input = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const pillRow = document.getElementById('pillRow');
const contactPill = document.getElementById('contactPill');
const brandLink = document.getElementById('brandLink');
const chatHeader = document.getElementById('chatHeader');

// Clicking the name top-left takes the visitor back to the welcome/landing
// state via a real page refresh (state lives only in memory, so a reload
// naturally lands back on the greeting + centered avatar, nothing to reset).
// The pinned chat-header avatar does the exact same thing — it's the other
// "go home" affordance once a conversation is in progress.
function goHome() { window.location.reload(); }

[brandLink, chatHeader].forEach((el) => {
  if (!el) return;
  el.addEventListener('click', goHome);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goHome(); }
  });
});

// The 5 real expression photos supplied for this avatar.
const FACE = {
  idle: 'assets/images/avatar0.jpg',   // calm, mouth closed — resting face
  neutral2: 'assets/images/avatar2.jpg', // alternate calm angle, used to vary idle/blinks
  happy: 'assets/images/avatar1.jpg',    // big open smile — reactions / jokes
  talkA: 'assets/images/avatar3.jpg',    // mouth open (round) — talking frame A
  talkB: 'assets/images/avatar4.jpg',    // mouth open (wider) — talking frame B
};

let talkInterval = null;

// Rotation pool: every new question settles on a different one of the 5
// supplied avatar photos once the answer finishes, so the face visibly
// changes question to question (not just idle -> thinking -> talking -> idle
// with the same resting shot every time).
const IDLE_POOL = [FACE.idle, FACE.neutral2, FACE.happy, FACE.talkA, FACE.talkB];
let idlePoolIndex = 0;

function nextIdleFace() {
  const face = IDLE_POOL[idlePoolIndex % IDLE_POOL.length];
  idlePoolIndex++;
  return face;
}

function setFace(src) {
  avatarImg.src = src;
  chatHeaderAvatar.src = src;
}

function startTalkingLoop() {
  stopTalkingLoop();
  let toggle = false;
  talkInterval = setInterval(() => {
    setFace(toggle ? FACE.talkA : FACE.talkB);
    toggle = !toggle;
  }, 220);
}

function stopTalkingLoop() {
  if (talkInterval) { clearInterval(talkInterval); talkInterval = null; }
}

avatarWrap.classList.add('idle');
setFace(FACE.idle);

fetch('assets/data/bio.json').then(r => r.json()).then(data => { BIO = data; });

function enterChatMode() {
  if (started) return;
  started = true;
  stage.classList.add('started');
}

function setAvatarState(state) {
  avatarWrap.classList.remove('thinking', 'reacting');
  if (state) avatarWrap.classList.add(state);
}

function addUserBubble(text) {
  const row = document.createElement('div');
  row.className = 'msg-row user';
  const bubble = document.createElement('div');
  bubble.className = 'bubble-user';
  bubble.textContent = text;
  row.appendChild(bubble);
  messages.appendChild(row);
  scrollToBottom();
}

function addTypingBubble() {
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  row.innerHTML = `<div class="bubble-bot"><span class="typing-dots"><span></span><span></span><span></span></span></div>`;
  messages.appendChild(row);
  scrollToBottom();
  return row.querySelector('.bubble-bot');
}

function revealBotText(bubbleEl, text, isJoke) {
  let paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) {
    paragraphs = text.split(/\n/).map(p => p.trim()).filter(Boolean);
  }
  if (paragraphs.length === 0) paragraphs = [text];

  bubbleEl.innerHTML = '';
  startTalkingLoop();

  paragraphs.forEach((p, i) => {
    const pEl = document.createElement('p');
    pEl.textContent = p;
    pEl.style.animationDelay = `${i * 140}ms`;
    bubbleEl.appendChild(pEl);
  });
  scrollToBottom();

  // Let the talking loop run roughly as long as the reveal animation takes,
  // then settle: happy face for a beat if it was a joke, otherwise straight to idle.
  const revealDuration = 400 + paragraphs.length * 140;
  setTimeout(() => {
    stopTalkingLoop();
    const settledFace = nextIdleFace();
    if (isJoke) {
      setFace(FACE.happy);
      setAvatarState('reacting');
      setTimeout(() => { setFace(settledFace); setAvatarState('idle'); }, 900);
    } else {
      setFace(settledFace);
      setAvatarState('idle');
    }
  }, revealDuration);
}

function renderContactCard() {
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  const c = (BIO && BIO.contact) || {};
  const links = [];
  links.push(c.linkedin
    ? `<a href="${c.linkedin}" target="_blank">💼 LinkedIn</a>`
    : `<a href="#" onclick="return false;" style="opacity:.5;">💼 LinkedIn — add link</a>`);
  links.push(c.github
    ? `<a href="${c.github}" target="_blank">🐙 GitHub</a>`
    : `<a href="#" onclick="return false;" style="opacity:.5;">🐙 GitHub — add link</a>`);
  links.push(c.cvFile
    ? `<a href="${c.cvFile}" download>📄 Download CV</a>`
    : `<a href="#" onclick="return false;" style="opacity:.5;">📄 CV — add file</a>`);

  // No mailto/email link on purpose — Djamal's address is never sent to the
  // browser (see api/contact.js), so it can't be scraped off the page. This
  // form is the only way to actually reach him from the site; submitting it
  // hits /api/contact, which emails him the message server-side.
  row.innerHTML = `<div class="contact-card">
      <div style="font-size:14px;color:var(--muted);">${c.availability || 'Reach out directly:'}</div>
      ${links.join('')}
      <div class="contact-form-divider">or leave a message — it goes straight to Djamal's inbox</div>
      <form class="contact-form" id="contactForm" novalidate>
        <input type="text" name="name" placeholder="Your name (optional)" maxlength="120" autocomplete="name" />
        <input type="email" name="email" placeholder="Your email, so he can reply (optional)" maxlength="200" autocomplete="email" />
        <textarea name="message" placeholder="Your message" maxlength="4000" required rows="3"></textarea>
        <input type="text" name="website" class="contact-form-honeypot" tabindex="-1" autocomplete="off" aria-hidden="true" />
        <button type="submit">Send message</button>
        <div class="contact-form-status" id="contactFormStatus"></div>
      </form>
    </div>`;
  messages.appendChild(row);
  scrollToBottom();
  setFace(FACE.happy);
  setAvatarState('reacting');
  const settledFace = nextIdleFace();
  setTimeout(() => { setFace(settledFace); setAvatarState('idle'); }, 900);

  const form = row.querySelector('#contactForm');
  const status = row.querySelector('#contactFormStatus');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const payload = {
      name: form.elements.name.value,
      email: form.elements.email.value,
      message: form.elements.message.value,
      website: form.elements.website.value, // honeypot — real visitors never fill this in
    };
    if (!payload.message.trim()) {
      status.textContent = 'Write a message first.';
      status.className = 'contact-form-status error';
      return;
    }
    submitBtn.disabled = true;
    status.textContent = 'Sending…';
    status.className = 'contact-form-status';
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        form.reset();
        Array.from(form.elements).forEach((el) => { el.disabled = true; });
        status.textContent = '✅ Sent — Djamal will get back to you.';
        status.className = 'contact-form-status success';
      } else {
        status.textContent = (data && data.error) || "Couldn't send that just now — try again in a moment.";
        status.className = 'contact-form-status error';
        submitBtn.disabled = false;
      }
    } catch (err) {
      status.textContent = "Couldn't reach the server — try again in a moment.";
      status.className = 'contact-form-status error';
      submitBtn.disabled = false;
    }
  });
}

function scrollToBottom() {
  const conv = document.getElementById('conversation');
  requestAnimationFrame(() => { conv.scrollTop = conv.scrollHeight; });
}

// Grounded fallback answerer — only used when /api/chat can't be reached at
// all (e.g. the page was opened directly as a file, or is running on a plain
// static host with no serverless function deployed behind it). It reads the
// same bio.json the real AI is grounded in, so the assistant still gives a
// correct, on-topic answer about Djamal instead of an error message. Once the
// site is deployed on Vercel with GEMINI_API_KEY set, /api/chat succeeds
// and this path is never used.
function localAnswer(question) {
  if (!BIO) return "I'm still loading Djamal's info — try asking again in a second.";
  const q = question.toLowerCase();
  const p = BIO.profile || {};
  const c = BIO.contact || {};

  if (/project|built|build|bank|dpi/.test(q)) {
    const proj = (BIO.projects || []).map(pr => `• ${pr.title} (${pr.org}) — ${pr.description}`).join('\n\n');
    return `Here's what Djamal has built:\n\n${proj}`;
  }
  if (/skill|certif|stack|tech|know/.test(q)) {
    const skills = Object.entries(BIO.skills || {}).map(([k, v]) => `${k}: ${v.join(', ')}`).join('\n\n');
    return `Djamal's skills:\n\n${skills}`;
  }
  if (/fun|hobby|outside|besides|beyond work/.test(q)) {
    return `${p.name || 'Djamal'} is ${p.age ? p.age + ', ' : ''}currently doing an MSc in IoT at the University of Salerno, Italy — outside of that he's focused on the intersection of software dev, cybersecurity, and IoT. Ask about his projects or certifications for more!`;
  }
  if (/contact|reach|email|hire|available|linkedin|github|cv|resume/.test(q)) {
    const bits = [];
    if (c.linkedin) bits.push(`LinkedIn (${c.linkedin})`);
    if (c.github) bits.push(`GitHub (${c.github})`);
    const alt = bits.length ? ` He's also on ${bits.join(' and ')}.` : '';
    return `Djamal doesn't list his email publicly to avoid spam — use the Contact option below to leave him a message and he'll get notified right away.${alt}`;
  }
  if (/who|about yourself|yourself|tell me about/.test(q)) {
    return `${p.lead || p.tagline || "Djamal is a software developer working across cybersecurity and IoT."}`;
  }
  return `${p.tagline || "Djamal builds and secures systems — from bank IT platforms to connected devices."} Try asking about his projects, skills, or certifications.`;
}

async function ask(question) {
  if (!question || !question.trim()) return;
  enterChatMode();
  addUserBubble(question);
  input.value = '';
  sendBtn.disabled = true;
  setFace(FACE.neutral2);
  setAvatarState('thinking');

  const bubble = addTypingBubble();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    if (response.status === 404) {
      // No serverless function behind this host — answer locally instead
      // of showing an error.
      revealBotText(bubble, localAnswer(question), false);
      return;
    }

    const data = await response.json();
    const answer = data.answer || "Sorry, I couldn't generate a response just now.";
    const isJoke = /not chatgpt|ha!|😄|😂|joke/i.test(answer);
    revealBotText(bubble, answer, isJoke);
  } catch (err) {
    // fetch() itself threw — e.g. opened via file:// with no server at all.
    revealBotText(bubble, localAnswer(question), false);
  } finally {
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener('click', () => ask(input.value));
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(input.value); });

pillRow.addEventListener('click', (e) => {
  const pill = e.target.closest('.pill');
  if (!pill) return;
  if (pill.id === 'contactPill') {
    enterChatMode();
    addUserBubble('How can I get in touch with you?');
    setTimeout(renderContactCard, 250);
    return;
  }
  if (pill.dataset.q) ask(pill.dataset.q);
});