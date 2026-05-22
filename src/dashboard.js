import './style.css'

// Email Summary wiring scaffold (credentials can be connected later)
// Later: replace `mockEmailSummary` with real fetch from Gmail/IMAP sync service.
const mockEmailSummary = {
  unread24h: null,
  inquiryRepliesNeeded: null,
  retreatOrPayment: null,
  urgentFollowups: null,
  lastSync: null,
}

function renderEmailSummary(summary = mockEmailSummary) {
  const unread = document.getElementById('emailUnread')
  const inquiries = document.getElementById('emailInquiries')
  const retreat = document.getElementById('emailRetreat')
  const urgent = document.getElementById('emailUrgent')
  const meta = document.getElementById('emailSummaryMeta')

  if (!unread || !inquiries || !retreat || !urgent || !meta) return

  unread.textContent = `Unread inbox count (last 24h): ${summary.unread24h ?? 'pending connection'}`
  inquiries.textContent = `New inquiry emails needing reply: ${summary.inquiryRepliesNeeded ?? 'pending connection'}`
  retreat.textContent = `Retreat/payment-related messages: ${summary.retreatOrPayment ?? 'pending connection'}`
  urgent.textContent = `Flagged urgent follow-ups: ${summary.urgentFollowups ?? 'pending connection'}`

  meta.textContent = summary.lastSync
    ? `Last email sync: ${summary.lastSync}`
    : 'Email integration not connected yet (credentials pending).'
}

renderEmailSummary()
