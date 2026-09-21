// Cal.com tab switching
document.querySelectorAll('.cal-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cal-tab-btn').forEach(b => b.classList.remove('active'))
    document.querySelectorAll('.cal-tab-panel').forEach(p => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById('tab-' + btn.dataset.tab)?.classList.add('active')
  })
})
