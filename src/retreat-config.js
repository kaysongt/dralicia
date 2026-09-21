// Public settings only. Never put API keys, sheet IDs, or attendee data here.
export const retreatConfig = Object.freeze({
  // Deployed Apps Script /exec URL; see integrations/priority-list/README.md.
  // Empty keeps the form in explicitly labeled email-request mode.
  priorityListEndpoint: '',
  // Paste the verified $5,795 Arizona pricing-plan URL only after checkout,
  // intake, and the total 12-person enrollment cap have been tested.
  checkoutUrl: '',
  contactEmail: 'yasmeen@coachingwithdralicia.com',
  capacity: 12,
});
