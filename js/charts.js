/**
 * FlowState — charts.js
 * Productivity charts: daily/weekly using Chart.js
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('productivity-chart');
  if (!canvas) return;

  let chart = null;
  let currentPeriod = 'week';

  /* ─── GENERATE HISTORY DATA ─── */
  function getWeekData() {
    const labels = [];
    const focusData   = [];
    const tasksData   = [];
    const cyclesData  = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const stats = Store.get('stats_' + key, { focusSeconds: 0, tasksCompleted: 0, pomoCycles: 0 });

      labels.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }));
      focusData.push(Math.round((stats.focusSeconds || 0) / 60));   // minutes
      tasksData.push(stats.tasksCompleted || 0);
      cyclesData.push(stats.pomoCycles || 0);
    }

    return { labels, focusData, tasksData, cyclesData };
  }

  function getMonthData() {
    const labels = [];
    const focusData  = [];
    const tasksData  = [];
    const cyclesData = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const stats = Store.get('stats_' + key, { focusSeconds: 0, tasksCompleted: 0, pomoCycles: 0 });

      // Show every 5 days for readability
      labels.push(i % 5 === 0 ? d.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }) : '');
      focusData.push(Math.round((stats.focusSeconds || 0) / 60));
      tasksData.push(stats.tasksCompleted || 0);
      cyclesData.push(stats.pomoCycles || 0);
    }

    return { labels, focusData, tasksData, cyclesData };
  }

  /* ─── CHART COLORS ─── */
  function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* ─── BUILD CHART ─── */
  function buildChart(period) {
    const data = period === 'week' ? getWeekData() : getMonthData();

    const primary  = getCSSVar('--primary') || '#6ee7b7';
    const purple   = getCSSVar('--accent-purple') || '#a78bfa';
    const surface2 = getCSSVar('--surface-2') || '#1a1a2e';
    const text2    = getCSSVar('--text-2') || '#9292b0';
    const border   = getCSSVar('--border') || 'rgba(255,255,255,0.07)';

    if (chart) chart.destroy();

    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Foco (min)',
            data: data.focusData,
            backgroundColor: primary + '33',
            borderColor: primary,
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false,
            order: 1
          },
          {
            label: 'Ciclos',
            data: data.cyclesData,
            type: 'line',
            borderColor: purple,
            backgroundColor: purple + '22',
            borderWidth: 2,
            pointRadius: period === 'week' ? 4 : 2,
            pointBackgroundColor: purple,
            fill: true,
            tension: 0.4,
            order: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: text2,
              usePointStyle: true,
              pointStyle: 'circle',
              font: { family: 'DM Sans', size: 11 },
              padding: 16
            }
          },
          tooltip: {
            backgroundColor: surface2,
            titleColor: '#e8e8f0',
            bodyColor: text2,
            borderColor: border,
            borderWidth: 1,
            padding: 10,
            titleFont: { family: 'Syne', size: 12, weight: '700' },
            bodyFont: { family: 'DM Sans', size: 12 },
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset.label === 'Foco (min)') {
                  const v = ctx.parsed.y;
                  return ` ${Math.floor(v/60)}h ${v%60}m focado`;
                }
                return ` ${ctx.parsed.y} ciclos`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { color: border, drawBorder: false },
            ticks: {
              color: text2,
              font: { family: 'DM Sans', size: 11 },
              maxRotation: 0
            }
          },
          y: {
            grid: { color: border, drawBorder: false },
            ticks: {
              color: text2,
              font: { family: 'DM Sans', size: 11 },
              callback: v => v
            },
            beginAtZero: true
          }
        }
      }
    });
  }

  /* ─── PERIOD TABS ─── */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      buildChart(currentPeriod);
    });
  });

  /* ─── INIT ─── */
  buildChart('week');

  // Rebuild when theme changes
  window.addEventListener('themechange', () => {
    setTimeout(() => buildChart(currentPeriod), 100);
  });
});
