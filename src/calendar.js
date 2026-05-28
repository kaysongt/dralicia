class BookingCalendar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.today = new Date();
    this.currentMonth = new Date(this.today.getFullYear(), this.today.getMonth(), 1);
    this.selectedDate = null;
    this.selectedTime = null;
    this.times = ['9:00 AM','10:00 AM','11:00 AM','1:00 PM','2:00 PM','3:00 PM','4:00 PM'];
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="booking-cal">
        <div class="cal-panel">
          <div class="cal-header">
            <button class="cal-nav" id="calPrev">&#8249;</button>
            <span class="cal-month-label" id="calMonthLabel"></span>
            <button class="cal-nav" id="calNext">&#8250;</button>
          </div>
          <div class="cal-weekdays">
            ${['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => `<div>${d}</div>`).join('')}
          </div>
          <div class="cal-grid" id="calGrid"></div>
        </div>
        <div class="cal-slots" id="calSlots">
          <div class="cal-hint">
            <div class="cal-hint-icon">&#128197;</div>
            <p>Pick a date to see available times</p>
          </div>
        </div>
      </div>
    `;
    this.renderMonth();
    document.getElementById('calPrev').addEventListener('click', () => this.prevMonth());
    document.getElementById('calNext').addEventListener('click', () => this.nextMonth());
  }

  renderMonth() {
    document.getElementById('calMonthLabel').textContent =
      this.currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    const grid = document.getElementById('calGrid');
    const firstDay = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), 1).getDay();
    const daysInMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 0).getDate();
    const todayStr = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate()).getTime();

    let html = '';
    for (let i = 0; i < firstDay; i++) html += `<div class="cal-cell empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth(), d);
      const isPast = date.getTime() < todayStr;
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isSelected = this.selectedDate && date.toDateString() === this.selectedDate.toDateString();
      const isToday = date.getTime() === todayStr;

      let cls = 'cal-cell';
      if (isPast || isWeekend) cls += ' disabled';
      else cls += ' available';
      if (isSelected) cls += ' selected';
      if (isToday) cls += ' today';

      html += `<div class="${cls}" data-iso="${date.toISOString()}">${d}</div>`;
    }

    grid.innerHTML = html;
    grid.querySelectorAll('.cal-cell.available').forEach(cell => {
      cell.addEventListener('click', () => {
        this.selectedDate = new Date(cell.dataset.iso);
        this.selectedTime = null;
        this.renderMonth();
        this.renderSlots();
      });
    });
  }

  renderSlots() {
    const el = document.getElementById('calSlots');
    const label = this.selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    let html = `<h4 class="slots-date">${label}</h4><div class="slots-grid">`;
    this.times.forEach(t => {
      html += `<button class="slot-btn${this.selectedTime === t ? ' selected' : ''}" data-time="${t}">${t}</button>`;
    });
    html += `</div>`;

    if (this.selectedTime) {
      html += `
        <div class="booking-form-mini">
          <h4>Confirm your booking</h4>
          <input type="text" id="bookName" placeholder="Your full name" />
          <input type="email" id="bookEmail" placeholder="your@email.com" />
          <select id="bookType">
            <option>Coaching Consultation (30 min)</option>
            <option>Therapy Intake</option>
            <option>Operations Audit</option>
            <option>E-commerce / Products</option>
          </select>
          <button class="btn" id="confirmBook">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:middle;margin-right:6px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Confirm &amp; Add to Apple Calendar
          </button>
        </div>
      `;
    }

    el.innerHTML = html;

    el.querySelectorAll('.slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedTime = btn.dataset.time;
        this.renderSlots();
      });
    });

    document.getElementById('confirmBook')?.addEventListener('click', () => this.confirmBooking());
  }

  confirmBooking() {
    const name = document.getElementById('bookName').value.trim();
    const email = document.getElementById('bookEmail').value.trim();
    const type = document.getElementById('bookType').value;

    if (!name || !email) { alert('Please enter your name and email.'); return; }

    const [timePart, meridiem] = this.selectedTime.split(' ');
    let [h, m] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;

    const start = new Date(this.selectedDate);
    start.setHours(h, m, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);

    const fmt = d => d.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
    const uid = `${Date.now()}@dralicia.com`;

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'PRODID:-//Dr. Alicia//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${type} with Dr. Alicia`,
      `DESCRIPTION:Appointment for ${name} — ${type}\\nContact: ${email}`,
      'LOCATION:Online (Zoom link will be sent via email)',
      `ORGANIZER;CN=Dr. Alicia:mailto:hello@dralicia.com`,
      `ATTENDEE;RSVP=TRUE;CN=${name}:mailto:${email}`,
      `DTSTAMP:${fmt(new Date())}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'dralicia-appointment.ics'; a.click();
    URL.revokeObjectURL(url);

    document.getElementById('calSlots').innerHTML = `
      <div class="booking-success">
        <div class="success-check">&#10003;</div>
        <h4>Booking Requested!</h4>
        <p class="success-detail">
          ${this.selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          &nbsp;&#183;&nbsp; ${this.selectedTime}
        </p>
        <p class="success-hint">Your <strong>.ics file</strong> was downloaded — open it to add directly to Apple Calendar.</p>
        <button class="btn btn-ghost" id="bookAnother">Book Another Time</button>
      </div>
    `;
    document.getElementById('bookAnother')?.addEventListener('click', () => {
      this.selectedDate = null; this.selectedTime = null;
      this.renderMonth();
      document.getElementById('calSlots').innerHTML = `
        <div class="cal-hint"><div class="cal-hint-icon">&#128197;</div><p>Pick a date to see available times</p></div>
      `;
    });
  }

  prevMonth() { this.currentMonth.setMonth(this.currentMonth.getMonth() - 1); this.renderMonth(); }
  nextMonth() { this.currentMonth.setMonth(this.currentMonth.getMonth() + 1); this.renderMonth(); }
}

export { BookingCalendar };
