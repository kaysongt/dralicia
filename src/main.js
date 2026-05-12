import './style.css'
import { BookingCalendar } from './calendar.js'

new BookingCalendar('bookingCalendar')

const announcements = [
  '🌿 Retreat coming soon',
  '✨ New wellness offerings coming soon',
  '🛍️ Product updates on the way',
]
const announcementText = document.getElementById('announcementText')
if (announcementText) {
  let index = 0
  setInterval(() => {
    index = (index + 1) % announcements.length
    announcementText.textContent = announcements[index]
  }, 3500)
}
