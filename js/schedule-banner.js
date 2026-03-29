/**
 * FlowState — schedule-banner.js
 * Dashboard schedule summary: current activity, next up, day strip
 */
document.addEventListener('DOMContentLoaded', () => {
  renderScheduleBanner();
  // Refresh every minute
  setInterval(renderScheduleBanner, 60000);
});

function renderScheduleBanner() {
  const events = Store.get('schedule', []);
  const banner = document.getElementById('schedule-banner');
  if (!banner) return;

  const now     = new Date();
  const todayDow= now.getDay();
  const nowMin  = now.getHours() * 60 + now.getMinutes();

  function toMin(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  // Today's events sorted by start
  const todayEvs = events
    .filter(e => e.days && e.days.includes(todayDow))
    .map(e => {
      let s = toMin(e.start), en = toMin(e.end);
      if (en <= s) en += 1440; // overnight
      return { ...e, startMin: s, endMin: en };
    })
    .sort((a, b) => a.startMin - b.startMin);

  // Current activity
  const current = todayEvs.find(e => nowMin >= e.startMin && nowMin < e.endMin);

  // Next activity (first one that starts after now)
  const next    = todayEvs.find(e => e.startMin > nowMin);

  // Render now
  const nowText = document.getElementById('sched-now-text');
  if (nowText) {
    if (current) {
      const remaining = current.endMin - nowMin;
      const rh = Math.floor(remaining / 60), rm = remaining % 60;
      const timeLeft = rh > 0 ? `${rh}h ${rm}m restantes` : `${rm}min restantes`;
      nowText.innerHTML = `<span style="color:${current.color}; font-weight:700">${escBanner(current.title)}</span> <span style="color:var(--text-3); font-size:12px">(${timeLeft})</span>`;
    } else {
      nowText.textContent = 'Tempo livre';
      nowText.style.color = 'var(--text-2)';
    }
  }

  // Render next
  const nextText = document.getElementById('sched-next-text');
  const nextTime = document.getElementById('sched-next-time');
  if (nextText) {
    if (next) {
      const inMin   = next.startMin - nowMin;
      const inLabel = inMin < 60 ? `em ${inMin}min` : `em ${Math.floor(inMin/60)}h${inMin%60>0?' '+inMin%60+'min':''}`;
      nextText.innerHTML = `<span style="color:${next.color}; font-weight:700">${escBanner(next.title)}</span>`;
      if (nextTime) nextTime.textContent = `${next.start} · ${inLabel}`;
    } else {
      nextText.textContent = 'Nada mais hoje';
      if (nextTime) nextTime.textContent = '';
    }
  }

  // Day strip — mini 24h bar with colored blocks
  const strip = document.getElementById('sched-day-strip');
  if (strip) {
    if (!todayEvs.length) {
      strip.innerHTML = `<span style="font-size:12px; color:var(--text-3)"><a href="pages/schedule.html" style="color:var(--primary)">Adicionar ao cronograma →</a></span>`;
    } else {
      const STRIP_W = 100; // percentage
      const blocks  = todayEvs.map(e => {
        const left  = (e.startMin / 1440) * 100;
        const width = Math.max(0.5, ((e.endMin - e.startMin) / 1440) * 100);
        return `<div class="strip-block" title="${escBanner(e.title)} ${e.start}–${e.end}"
          style="left:${left.toFixed(2)}%; width:${width.toFixed(2)}%; background:${e.color}; opacity:0.85"></div>`;
      }).join('');

      // Now indicator
      const nowPct = (nowMin / 1440) * 100;
      const nowMarker = `<div class="strip-now" style="left:${nowPct.toFixed(2)}%"></div>`;

      strip.innerHTML = `
        <div class="day-strip-wrap">
          <div class="day-strip-bar">
            ${blocks}
            ${nowMarker}
          </div>
          <div class="day-strip-labels">
            <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>24h</span>
          </div>
        </div>`;
    }
  }
}

function escBanner(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
