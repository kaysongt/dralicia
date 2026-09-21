import { retreatConfig as config } from './retreat-config.js';

const form = document.getElementById('priority-form');
const fields = document.getElementById('priority-fields');
const submit = document.getElementById('priority-submit');
const status = document.getElementById('priority-status');
const draftWrap = document.getElementById('email-draft-wrap');
const count = document.getElementById('interest-count');
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
    count.textContent = `${data.interestCount} ${noun} joined the interest list. Retreat capacity: ${config.capacity} guests.`;
    if (data.interestCount > config.capacity) count.textContent += ' Interest exceeds retreat capacity; the team will confirm availability when booking opens.';
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
    const body = `Please add me to the Arizona Wellness Retreat priority list.\n\nFirst Name: ${firstName}\nLast Name: ${lastName}\nEmail Address: ${email}\n\nI agree to receive Arizona retreat updates. I understand this request does not reserve a retreat spot.`;
    document.getElementById('email-draft').href = `mailto:${config.contactEmail}?subject=${encodeURIComponent('Arizona Retreat Priority List')}&body=${encodeURIComponent(body)}`;
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
    setStatus('Thank you. Your priority-list request has been received. If this email is already on the list, your original place is kept. This does not reserve a retreat spot.');
    await refreshCount();
  } catch {
    setStatus('We couldn’t confirm your signup. Your details are still here so you can try again, or email the retreat team below. If the request reached us, retrying will not add a duplicate.', true);
  } finally {
    submitting = false;
    fields.disabled = false;
    form.removeAttribute('aria-busy');
    submit.textContent = 'Join the Priority List';
  }
});
