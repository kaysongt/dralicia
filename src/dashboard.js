

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

// Week tab switching
document.querySelectorAll('.sched-week-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.sched-week-tab').forEach(t => t.classList.remove('active'))
    document.querySelectorAll('.sched-week-panel').forEach(p => p.classList.remove('active'))
    tab.classList.add('active')
    document.getElementById('sched-week-' + tab.dataset.week)?.classList.add('active')
  })
})

// Status toggle — cycles todo → doing → done → todo, persists via localStorage
document.querySelectorAll('.sc-status-btn').forEach(btn => {
  const id = btn.closest('.sched-card').dataset.id
  const saved = localStorage.getItem('sc-' + id)
  if (saved) { btn.dataset.status = saved; btn.textContent = saved }
  btn.addEventListener('click', () => {
    const next = { todo: 'doing', doing: 'done', done: 'todo' }[btn.dataset.status] || 'todo'
    btn.dataset.status = next
    btn.textContent = next
    localStorage.setItem('sc-' + id, next)
  })
})
