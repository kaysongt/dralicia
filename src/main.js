import './style.css'

document.getElementById('fakeSubmit')?.addEventListener('click', () => {
  alert('Great — next step is connecting this form to your CRM or calendar webhook.')
})

const announcements = [
  '🌿 Retreat coming soon',
  '✨ Placeholder announcement — new wellness offerings soon',
  '🛍️ Placeholder announcement — product updates on the way',
]

const announcementText = document.getElementById('announcementText')
if (announcementText) {
  let index = 0
  setInterval(() => {
    index = (index + 1) % announcements.length
    announcementText.textContent = announcements[index]
  }, 3500)
}
