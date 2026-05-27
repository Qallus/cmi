/* ========================================================================
   CMI · CRM Dashboard driver
   - Injects logo mark
   - Populates project table, kanban, activity feed, RFIs
   - Renders sparklines and revenue chart
   - Nav clicks, tab switching, theme
   ======================================================================== */
(() => {
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ----- Inject logo mark template ----- */
  const tpl = $('#logo-mark-svg');
  $$('.cmi-logo-mark').forEach(el => {
    const svg = tpl.content.firstElementChild.cloneNode(true);
    svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
    el.appendChild(svg);
  });

  /* ----- Theme: read parent if iframe, else storage ----- */
  const root = document.documentElement;
  try {
    if (window.parent !== window && window.parent.document.documentElement.classList.contains('dark')) {
      root.classList.add('dark');
    }
  } catch (e) {}
  if (localStorage.getItem('cmi-theme') === 'dark') root.classList.add('dark');
  $('#themeToggle')?.addEventListener('click', () => {
    root.classList.toggle('dark');
    localStorage.setItem('cmi-theme', root.classList.contains('dark') ? 'dark' : 'light');
    renderSparks(); renderRevChart(); // refresh chart strokes
  });

  /* ----- Nav clicks (visual only) ----- */
  $$('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      $$('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
  $$('.panel-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      const siblings = btn.parentElement.children;
      Array.from(siblings).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* ====================== Projects table ====================== */
  const projects = [
    { name: 'Ambassador ADU',      svc: 'ADU · Arcadia',         status: 'success', statusLabel: 'On track',  pct: 72, budget: '$284,500', delta: '+2.1%', deltaCls: 'success', next: 'Concrete pour · 5/12', pm: 'BF' },
    { name: 'Conrad Interior',     svc: 'Design · Scottsdale',   status: 'warning', statusLabel: 'At risk',   pct: 48, budget: '$612,000', delta: '−4.8%', deltaCls: 'warning', next: 'RFI response · 5/13', pm: 'JB' },
    { name: 'Garden Plaza',        svc: 'Commercial · Scottsdale', status: 'info',   statusLabel: 'Permitting', pct: 12, budget: '$1.8M',    delta: '—',     deltaCls: 'muted',   next: 'Permit pickup · 5/12', pm: 'BF' },
    { name: 'VW Garage',           svc: 'Residential · Arcadia', status: 'destructive', statusLabel: 'Delayed', pct: 64, budget: '$98,200',  delta: '−11.4%', deltaCls: 'destructive', next: 'Framing inspect · 5/11', pm: 'JB' },
    { name: 'Parco Residence',     svc: 'Residential · Scottsdale', status: 'success', statusLabel: 'On track', pct: 86, budget: '$420,800', delta: '+0.8%', deltaCls: 'success', next: 'Tile selection · 5/14', pm: 'JB' },
    { name: 'Lorsch Kitchen',      svc: 'Renovation · Phoenix',  status: 'success', statusLabel: 'On track',  pct: 92, budget: '$76,400',  delta: '+1.2%', deltaCls: 'success', next: 'Punch list · 5/16', pm: 'BF' },
    { name: 'Trinity Office',      svc: 'Commercial · Scottsdale', status: 'success', statusLabel: 'On track', pct: 38, budget: '$540,000', delta: '+0.4%', deltaCls: 'success', next: 'Steel delivery · 5/17', pm: 'BF' },
  ];
  const statusBadgeClass = {
    success: 'cmi-badge cmi-badge-success',
    warning: 'cmi-badge cmi-badge-warning',
    info: 'cmi-badge cmi-badge-info',
    destructive: 'cmi-badge cmi-badge-destructive',
  };
  const deltaColor = {
    success: 'color: var(--success)',
    warning: 'color: oklch(0.55 0.15 78)',
    destructive: 'color: var(--destructive)',
    muted: 'color: var(--muted-foreground)',
  };
  $('#projTable').innerHTML = projects.map(p => `
    <tr>
      <td>
        <div class="cell-strong">${p.name}</div>
        <div class="cell-mute">${p.svc}</div>
      </td>
      <td><span class="${statusBadgeClass[p.status]}"><span class="dot"></span>${p.statusLabel}</span></td>
      <td><div class="progress-mini"><div class="bar"><div style="width: ${p.pct}%"></div></div>${p.pct}%</div></td>
      <td class="cmi-mono">${p.budget}</td>
      <td class="cmi-mono" style="${deltaColor[p.deltaCls]}">${p.delta}</td>
      <td><div style="font-size: 0.8125rem;">${p.next}</div></td>
      <td><span class="cmi-avatar cmi-avatar-sm" style="background: var(--muted);">${p.pm}</span></td>
    </tr>
  `).join('');

  /* ====================== Pipeline kanban ====================== */
  const stages = [
    { id: 'lead',   name: 'Lead',          color: 'oklch(0.7 0.012 60)' },
    { id: 'qual',   name: 'Qualified',     color: 'oklch(0.55 0.12 235)' },
    { id: 'quote',  name: 'Quote sent',    color: 'oklch(0.74 0.155 78)' },
    { id: 'nego',   name: 'Negotiation',   color: 'oklch(0.66 0.135 52)' },
    { id: 'won',    name: 'Booked',        color: 'oklch(0.55 0.13 155)' },
  ];
  const deals = [
    { stage: 'lead',  name: 'Henderson Casita',       value: '$180K',  meta: 'Scottsdale · ADU',          tags: ['ADU'] },
    { stage: 'lead',  name: 'Camelback Pavilion',     value: '$640K',  meta: 'Phoenix · Commercial',      tags: ['Commercial'] },
    { stage: 'lead',  name: 'Pinnacle Peak Add-on',   value: '$220K',  meta: 'PV · Residential',          tags: ['Reno'] },

    { stage: 'qual',  name: 'Bishop Residence',       value: '$1.4M',  meta: 'Paradise Valley · New',     tags: ['New Const.'] },
    { stage: 'qual',  name: 'McCormick Office',       value: '$880K',  meta: 'Scottsdale · TI',           tags: ['Commercial'] },

    { stage: 'quote', name: 'Sherman Heights',        value: '$520K',  meta: 'Tempe · Residential',       tags: ['Reno'] },
    { stage: 'quote', name: 'Rancho Solano ADU',      value: '$310K',  meta: 'Arcadia · ADU',             tags: ['ADU'] },
    { stage: 'quote', name: 'Verde Studio',           value: '$240K',  meta: 'Phoenix · Commercial',      tags: ['Commercial'] },

    { stage: 'nego',  name: 'Whitfield Family',       value: '$1.8M',  meta: 'PV · New',                  tags: ['New Const.'] },
    { stage: 'nego',  name: 'Cactus Forest Suites',   value: '$2.2M',  meta: 'Scottsdale · Hospitality',  tags: ['Commercial'] },

    { stage: 'won',   name: 'Garden Plaza',           value: '$1.8M',  meta: 'Scottsdale',                tags: ['Commercial'] },
    { stage: 'won',   name: 'Conrad Interior',        value: '$612K',  meta: 'Scottsdale',                tags: ['Design'] },
  ];
  const kanban = $('#kanban');
  kanban.innerHTML = stages.map(s => {
    const stageDeals = deals.filter(d => d.stage === s.id);
    return `
      <div class="kanban-col" data-stage="${s.id}">
        <div class="kanban-col-head">
          <div class="name"><span class="dot" style="background: ${s.color}"></span>${s.name}</div>
          <div class="count">${stageDeals.length}</div>
        </div>
        ${stageDeals.map(d => `
          <div class="deal" draggable="true" data-name="${d.name}">
            <div class="deal-head">
              <div class="deal-name">${d.name}</div>
              <div class="deal-value">${d.value}</div>
            </div>
            <div class="deal-meta">${d.meta}</div>
            <div class="deal-foot">
              <div class="deal-tags">${d.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
              <span class="cmi-avatar cmi-avatar-sm" style="background: var(--muted); width: 18px; height: 18px; font-size: 0.5625rem;">${d.stage === 'won' ? 'BF' : 'JB'}</span>
            </div>
          </div>
        `).join('')}
      </div>`;
  }).join('');

  // Simple drag-drop between columns
  let dragged = null;
  kanban.addEventListener('dragstart', e => {
    if (e.target.classList.contains('deal')) { dragged = e.target; e.dataTransfer.effectAllowed = 'move'; e.target.style.opacity = '0.5'; }
  });
  kanban.addEventListener('dragend', e => { if (dragged) { dragged.style.opacity = ''; dragged = null; } });
  $$('.kanban-col', kanban).forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.style.background = 'color-mix(in oklch, var(--accent) 8%, var(--muted))'; });
    col.addEventListener('dragleave', () => { col.style.background = ''; });
    col.addEventListener('drop', e => {
      e.preventDefault();
      col.style.background = '';
      if (dragged) col.appendChild(dragged);
    });
  });

  /* ====================== Activity feed ====================== */
  const feed = [
    { who: 'M. Doolittle', what: 'opened RFI', detail: 'on Conrad Interior — Ridge beam spec…', when: '2h ago', icn: 'rfi',     kind: 'warning' },
    { who: 'Joe Ballard',  what: 'approved change order CO-12', detail: 'Ambassador ADU · +$8,200', when: '3h ago', icn: 'check',   kind: 'success' },
    { who: 'Brandon F.',   what: 'uploaded 14 photos', detail: 'to VW Garage · Framing log', when: '4h ago', icn: 'photo',   kind: 'default' },
    { who: 'City of Scottsdale', what: 'approved permit SP-2026-1184', detail: 'Conrad Interior', when: 'yesterday', icn: 'check',   kind: 'success' },
    { who: 'K. Wong',      what: 'submitted bid', detail: 'Steel package · Garden Plaza · $187,400', when: 'yesterday', icn: 'doc',     kind: 'accent' },
    { who: 'Joe Ballard',  what: 'updated schedule', detail: 'Ambassador ADU · pour shifted to Tue 5/12', when: '2d ago', icn: 'calendar', kind: 'default' },
    { who: 'Cassie Parco', what: 'left a 5-star review', detail: '"Delivered beyond our expectations."', when: '3d ago', icn: 'star',    kind: 'accent' },
  ];
  const iconSvg = {
    rfi:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    check:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12 10 17 20 7"/></svg>',
    photo:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>',
    doc:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    calendar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
    star:     '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"><path d="M12 2 15 9 22 10 17 15 18 22 12 18 6 22 7 15 2 10 9 9 Z"/></svg>',
  };
  const kindClass = { success: 'success', warning: 'warning', accent: 'accent', default: '' };
  $('#feed').innerHTML = feed.map(f => `
    <div class="feed-item">
      <div class="icn ${kindClass[f.kind] || ''}">${iconSvg[f.icn] || ''}</div>
      <div class="body">
        <div class="who">${f.who} <span>${f.what}</span></div>
        <div class="sub">${f.detail}</div>
      </div>
      <div class="when">${f.when}</div>
    </div>
  `).join('');

  /* ====================== Sparklines ====================== */
  function spark(svg, points, opts = {}) {
    const W = 200, H = 24;
    const min = Math.min(...points), max = Math.max(...points);
    const range = max - min || 1;
    const stepX = W / (points.length - 1);
    const pts = points.map((v, i) => [i * stepX, H - 2 - ((v - min) / range) * (H - 4)]);
    const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    const area = d + ` L${W} ${H} L0 ${H} Z`;
    const color = opts.color || 'var(--accent)';
    svg.innerHTML = `
      <path d="${area}" fill="${color}" fill-opacity="0.12"/>
      <path d="${d}" stroke="${color}" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  }
  function renderSparks() {
    spark($('#spark1'), [8, 9, 11, 10, 12, 12, 13, 14], { color: 'var(--accent)' });
    spark($('#spark2'), [6.4, 6.6, 6.8, 7.0, 7.2, 7.6, 8.0, 8.2], { color: 'var(--accent)' });
    spark($('#spark3'), [32, 36, 30, 38, 34, 35, 34, 34], { color: 'var(--info)' });
    spark($('#spark4'), [20.4, 20.1, 19.8, 19.5, 19.2, 19.0, 18.8, 18.6], { color: 'var(--warning)' });
  }
  renderSparks();

  /* ====================== Revenue chart ====================== */
  function renderRevChart() {
    const svg = $('#revChart');
    if (!svg) return;
    const months = ['Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May'];
    const recognized = [320, 380, 410, 460, 520, 480, 560, 600, 540, 620, 700, 740];
    const projected  = [400, 440, 460, 490, 540, 560, 600, 640, 660, 700, 760, 820];
    const W = 520, H = 200, pad = { l: 38, r: 16, t: 24, b: 30 };
    const max = 900;
    const xAt = i => pad.l + (W - pad.l - pad.r) * (i / (months.length - 1));
    const yAt = v => pad.t + (H - pad.t - pad.b) * (1 - v / max);
    const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(' ');
    let s = '';
    // gridlines
    for (let i = 0; i < 5; i++) {
      const y = pad.t + (H - pad.t - pad.b) * (i / 4);
      s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
      const v = Math.round(max * (1 - i / 4));
      s += `<text x="${pad.l - 8}" y="${y + 3}" text-anchor="end" font-size="10" font-family="var(--font-mono)" fill="var(--muted-foreground)">${v}K</text>`;
    }
    // projected (dashed)
    s += `<path d="${path(projected)}" stroke="var(--chart-2)" stroke-width="1.5" fill="none" stroke-dasharray="4 3" stroke-linecap="round"/>`;
    // recognized (area + line)
    const area = path(recognized) + ` L${xAt(months.length-1)} ${H - pad.b} L${xAt(0)} ${H - pad.b} Z`;
    s += `<path d="${area}" fill="var(--accent)" fill-opacity="0.12"/>`;
    s += `<path d="${path(recognized)}" stroke="var(--accent)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    // points on recognized
    recognized.forEach((v, i) => {
      s += `<circle cx="${xAt(i)}" cy="${yAt(v)}" r="3" fill="var(--card)" stroke="var(--accent)" stroke-width="2"/>`;
    });
    // x labels
    months.forEach((m, i) => {
      s += `<text x="${xAt(i)}" y="${H - pad.b + 16}" text-anchor="middle" font-size="10" font-family="var(--font-mono)" fill="var(--muted-foreground)">${m}</text>`;
    });
    // legend
    s += `<g transform="translate(${pad.l},${pad.t - 12})">
      <circle cx="3" cy="0" r="3" fill="var(--accent)"/>
      <text x="10" y="3" font-size="10.5" font-family="var(--font-sans)" fill="var(--foreground)" font-weight="500">Recognized</text>
      <g transform="translate(95, 0)">
        <line x1="0" y1="0" x2="12" y2="0" stroke="var(--chart-2)" stroke-width="1.5" stroke-dasharray="3 2"/>
        <text x="18" y="3" font-size="10.5" font-family="var(--font-sans)" fill="var(--foreground)" font-weight="500">Projected</text>
      </g>
    </g>`;
    svg.innerHTML = s;
  }
  renderRevChart();
})();
