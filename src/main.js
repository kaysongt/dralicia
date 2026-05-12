import './style.css'
import { BookingCalendar } from './calendar.js'

new BookingCalendar('bookingCalendar')

// Announcement bar rotation
const announcements = [
  '🌴 Costa Rica Retreat — Dec 17–21, 2026 · Only 20 spots · Early bird discount available',
  '✨ New wellness offerings coming soon',
  '🛍️ Shop Dr. Alicia\'s products below',
]
const announcementText = document.getElementById('announcementText')
if (announcementText) {
  let index = 0
  setInterval(() => {
    index = (index + 1) % announcements.length
    announcementText.innerHTML = announcements[index]
  }, 4000)
}

// Retreat popup — show after 4 seconds, respect dismiss
const popup = document.getElementById('retreatPopup')
const popupClose = document.getElementById('popupClose')
const popupDismiss = document.getElementById('popupDismiss')

if (popup && !sessionStorage.getItem('popupDismissed')) {
  setTimeout(() => popup.classList.add('visible'), 4000)
}

function closePopup() {
  popup?.classList.remove('visible')
  sessionStorage.setItem('popupDismissed', '1')
}

popupClose?.addEventListener('click', closePopup)
popupDismiss?.addEventListener('click', closePopup)
popup?.addEventListener('click', e => { if (e.target === popup) closePopup() })
