// Public settings only. Never put API keys, sheet IDs, or attendee data here.
export const retreatConfig = Object.freeze({
  // Deployed Apps Script /exec URL; see integrations/priority-list/README.md.
  // Empty keeps the form in explicitly labeled email-request mode.
  priorityListEndpoint: 'https://script.google.com/macros/s/AKfycbyUcpVH0wRfcFjvXpMXsA0M_gCp6WQ_tbo2ignZEZlvO48ILvvfrzfAS71N_0cW4hdF_w/exec',
  // Paste the verified Arizona pricing-plan URL only after checkout,
  // intake, and the total 12-person enrollment cap have been tested.
  checkoutUrl: '',
  contactEmail: 'yaya@coachingwithdralicia.org',
});
