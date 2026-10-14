import { retreatConfig as config } from './retreat-config.js';

const form = document.getElementById('priority-form');
const fields = document.getElementById('priority-fields');
const submit = document.getElementById('priority-submit');
const status = document.getElementById('priority-status');
const draftWrap = document.getElementById('email-draft-wrap');
const count = document.getElementById('interest-count');
const formPanel = document.getElementById('priority-form-panel');
const success = document.getElementById('priority-success');
const successTitle = document.getElementById('priority-success-title');
const endpoint = config.priorityListEndpoint;
let pendingRequest = null;
let submitting = false;

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('is-error', isError);
  status.focus({ preventScroll: true });
}

async function request(options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(endpoint, { ...options, signal: controller.signal, credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error('Request unavailable');
    const data = await response.json();
    if (data.ok !== true) throw new Error('Request not confirmed');
    return data;
  } finally { clearTimeout(timer); }
}

async function refreshCount() {
  if (!endpoint) return;
  try {
    const data = await request();
    if (!Number.isSafeInteger(data.interestCount) || data.interestCount < 0) {
      count.hidden = true;
      return;
    }
    const noun = data.interestCount === 1 ? 'person has' : 'people have';
    count.textContent = `${data.interestCount} ${noun} joined the interest list.`;
    count.hidden = false;
  } catch { count.hidden = true; }
}

if (config.checkoutUrl) {
  try {
    const checkout = new URL(config.checkoutUrl);
    if (checkout.protocol === 'https:' && checkout.hostname === 'coachingwithdralicia.teachable.com') {
      document.getElementById('booking-link').href = checkout.href;
      document.getElementById('booking-link-wrap').hidden = false;
    }
  } catch { /* Keep pre-launch state for an invalid checkout URL. */ }
}

fields.disabled = false;
if (endpoint) {
  document.getElementById('form-instructions').textContent = 'Enter your contact details to join the Arizona retreat priority list. All fields are required.';
  submit.textContent = 'Join the Priority List';
  refreshCount();
}

form.addEventListener('input', () => {
  draftWrap.hidden = true;
  status.textContent = '';
});

// Brand-colored confetti from the top of the screen. Skipped for reduced motion.
function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let width = 0;
  let height = 0;
  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);
  const colors = ['#f5c518', '#ecd27b', '#d4a80f', '#ffe27a', '#886200', '#1a1810'];
  const pieces = Array.from({ length: width < 600 ? 130 : 220 }, () => ({
    x: Math.random() * width,
    y: -20 - Math.random() * height * 0.7,
    w: 6 + Math.random() * 6,
    h: 9 + Math.random() * 9,
    vx: -1 + Math.random() * 2,
    vy: 2 + Math.random() * 3,
    spin: -0.15 + Math.random() * 0.3,
    angle: Math.random() * Math.PI * 2,
    sway: Math.random() * Math.PI * 2,
    round: Math.random() < 0.25,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const duration = 4200;
  const start = performance.now();
  const frame = now => {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = elapsed > duration - 900 ? Math.max(0, (duration - elapsed) / 900) : 1;
    for (const p of pieces) {
      p.sway += 0.05;
      p.x += p.vx + Math.sin(p.sway) * 0.9;
      p.y += p.vy;
      p.vy = Math.min(p.vy + 0.03, 6.5);
      p.angle += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.round) {
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.scale(1, Math.cos(p.sway * 1.6));
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      window.removeEventListener('resize', resize);
      canvas.remove();
    }
  };
  requestAnimationFrame(frame);
}

function showSuccess(firstName) {
  formPanel.hidden = true;
  successTitle.textContent = firstName ? `Congratulations, ${firstName}!` : 'Congratulations!';
  success.hidden = false;
  successTitle.focus({ preventScroll: true });
  success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  celebrate();
}

document.getElementById('priority-again').addEventListener('click', () => {
  success.hidden = true;
  formPanel.hidden = false;
  status.textContent = '';
  document.getElementById('first-name').focus();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || !form.reportValidity()) return;
  const values = new FormData(form);
  const firstName = String(values.get('firstName') || '').trim();
  const lastName = String(values.get('lastName') || '').trim();
  const email = String(values.get('email') || '').trim();
  if (!firstName || !lastName) {
    setStatus('Please enter both your first and last name.', true);
    return;
  }
  if (values.get('website')) return;
  if (!endpoint) {
    const body = `Please add me to the Desert BLOOM Wellness Retreat priority list.\n\nFirst Name: ${firstName}\nLast Name: ${lastName}\nEmail Address: ${email}\n\nI agree to receive Arizona retreat updates. I understand this request does not reserve a retreat spot.`;
    document.getElementById('email-draft').href = `mailto:${config.contactEmail}?subject=${encodeURIComponent('Desert BLOOM Retreat Priority List')}&body=${encodeURIComponent(body)}`;
    draftWrap.hidden = false;
    setStatus('Your email draft is ready. Open it and send it to the retreat team to request signup. Your details have not been submitted yet.');
    return;
  }
  // Keep the same token when retrying an uncertain submission. No contact data
  // is written to browser storage, analytics, query strings, or the repository.
  const fingerprint = JSON.stringify([firstName, lastName, email.toLowerCase()]);
  if (!pendingRequest || pendingRequest.fingerprint !== fingerprint) {
    pendingRequest = { fingerprint, id: crypto.randomUUID() };
  }
  const body = new URLSearchParams({ firstName, lastName, email, website: '', consent: 'true', requestId: pendingRequest.id });
  submitting = true;
  fields.disabled = true;
  form.setAttribute('aria-busy', 'true');
  submit.textContent = 'Submitting…';
  try {
    await request({ method: 'POST', body });
    form.reset();
    pendingRequest = null;
    status.textContent = '';
    showSuccess(firstName);
    refreshCount();
  } catch {
    setStatus('Something went wrong on our end and your signup didn’t go through. Your details are still here, so please try again. If it keeps happening, call or email Yaya below.', true);
  } finally {
    submitting = false;
    fields.disabled = false;
    form.removeAttribute('aria-busy');
    submit.textContent = 'Join the Priority List';
  }
});
