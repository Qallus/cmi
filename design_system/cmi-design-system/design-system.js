/* ========================================================================
   Constructed Matter — Design System driver
   - Injects the logo SVG template into every .cmi-logo-mark and similar
   - Renders swatch scales, spacing scale, icon grid, charts
   - Sticky-nav active state, theme toggle
   - Three.js renders of the 3D favicon variants
   ======================================================================== */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ----- Inject logo mark everywhere ----- */
  const markTpl = $('#logo-mark-svg');
  const injectMark = (el, color) => {
    if (!markTpl) return;
    const svg = markTpl.content.firstElementChild.cloneNode(true);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.display = 'block';
    if (color) svg.style.color = color;
    el.innerHTML = '';
    el.appendChild(svg);
  };
  $$('.cmi-logo-mark').forEach(el => injectMark(el));
  if ($('#heroMark')) injectMark($('#heroMark'));

  /* ----- Color swatches ----- */
  // Stone neutral ramp (anchored on our --background/--foreground tokens)
  const stone = [
    { name: 'Stone 0',   light: 'oklch(0.992 0.003 75)',  token: '--background' },
    { name: 'Stone 50',  light: 'oklch(0.97 0.005 75)',   token: '--muted' },
    { name: 'Stone 100', light: 'oklch(0.94 0.006 75)',   token: '--surface' },
    { name: 'Stone 200', light: 'oklch(0.91 0.006 70)',   token: '--border' },
    { name: 'Stone 300', light: 'oklch(0.85 0.007 65)',   token: '--border-strong' },
    { name: 'Stone 400', light: 'oklch(0.72 0.01 62)',    token: '' },
    { name: 'Stone 500', light: 'oklch(0.55 0.012 62)',   token: '--muted-fg' },
    { name: 'Stone 600', light: 'oklch(0.42 0.012 60)',   token: '' },
    { name: 'Stone 700', light: 'oklch(0.32 0.012 60)',   token: '' },
    { name: 'Stone 800', light: 'oklch(0.22 0.012 60)',   token: '' },
    { name: 'Stone 900', light: 'oklch(0.135 0.012 60)',  token: '--primary' },
  ];
  const copper = [
    { name: 'Copper 50',  light: 'oklch(0.97 0.025 60)' },
    { name: 'Copper 100', light: 'oklch(0.93 0.04 58)' },
    { name: 'Copper 200', light: 'oklch(0.88 0.06 55)' },
    { name: 'Copper 300', light: 'oklch(0.81 0.09 52)' },
    { name: 'Copper 400', light: 'oklch(0.74 0.115 52)' },
    { name: 'Copper 500', light: 'oklch(0.66 0.135 52)', token: '--accent' },
    { name: 'Copper 600', light: 'oklch(0.58 0.13 48)' },
    { name: 'Copper 700', light: 'oklch(0.5 0.12 45)' },
    { name: 'Copper 800', light: 'oklch(0.4 0.1 42)' },
    { name: 'Copper 900', light: 'oklch(0.3 0.075 40)' },
    { name: 'Copper 950', light: 'oklch(0.22 0.05 40)' },
  ];
  const renderRow = (id, scale) => {
    const root = $('#' + id);
    if (!root) return;
    root.innerHTML = scale.map((s, i) => `
      <div class="step" style="background: ${s.light}; color: ${i < 5 ? 'oklch(0.2 0.012 60)' : 'oklch(0.98 0.003 75)'};">
        ${(i === 0 ? '0' : (i * 100))}
      </div>`).join('');
  };
  renderRow('stoneRow', stone);
  renderRow('copperRow', copper);

  // Semantic tokens grid
  const tokens = [
    { name: 'Background',        css: '--background',          fg: '--foreground' },
    { name: 'Card',              css: '--card',                fg: '--card-foreground' },
    { name: 'Muted',             css: '--muted',               fg: '--muted-foreground' },
    { name: 'Primary',           css: '--primary',             fg: '--primary-foreground' },
    { name: 'Accent · Copper',   css: '--accent',              fg: '--accent-foreground' },
    { name: 'Accent · Soft',     css: '--accent-soft',         fg: '--accent-soft-foreground' },
    { name: 'Border',            css: '--border' },
    { name: 'Ring',              css: '--ring' },
    { name: 'Concrete',          css: '--surface-concrete',    fg: '--foreground' },
    { name: 'Blueprint',         css: '--surface-blueprint',   fg: '#fff' },
    { name: 'Destructive',       css: '--destructive',         fg: '--destructive-foreground' },
    { name: 'Info',              css: '--info',                fg: '--info-foreground' },
  ];
  const semGrid = $('#semanticGrid');
  if (semGrid) {
    semGrid.innerHTML = tokens.map(t => `
      <div class="swatch-card">
        <div class="chip" style="background: var(${t.css});"></div>
        <div class="info">
          <div class="name">${t.name}</div>
          <div class="token">var(${t.css})</div>
        </div>
      </div>`).join('');
  }

  /* ----- Spacing scale ----- */
  const scale = [
    ['1', '4px'], ['2', '8px'], ['3', '12px'], ['4', '16px'],
    ['5', '20px'], ['6', '24px'], ['8', '32px'], ['10', '40px'],
    ['12', '48px'], ['16', '64px']
  ];
  const sp = $('#spacingScale');
  if (sp) {
    sp.innerHTML = scale.map(([k, v]) => `
      <div class="spacing-row">
        <div class="name">space-${k}</div>
        <div><div class="bar" style="width: ${v};"></div></div>
        <div class="val">${v}</div>
      </div>`).join('');
  }

  /* ----- Iconography ----- */
  const icons = {
    home:     'M3 12 12 3l9 9M5 10v10h14V10',
    building: 'M3 21h18M5 21V7l8-4v18M19 21V11l-6-2',
    blueprint:'M3 7h18v12H3zM3 11h18M9 7v12M15 7v12',
    hammer:   'M14.5 4 19 8.5l-3 3-4.5-4.5zM12.5 6.5 4 15l3 3 8.5-8.5',
    ruler:    'm21 3-3-3-15 15 3 3zM6 12 3 9M9 9 6 6M12 6 9 3',
    hardhat:  'M4 18a8 8 0 0 1 16 0M2 18h20v3H2zM10 6h4v6',
    cog:      'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
    file:     'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
    calendar: 'M3 7h18v14H3zM3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2M8 3v4M16 3v4M3 11h18',
    chart:    'M3 21h18M6 17v-7M11 17v-12M16 17v-9M21 17V9',
    bell:     'M6 8a6 6 0 0 1 12 0v6l2 2H4l2-2zM10 20a2 2 0 0 0 4 0',
    search:   'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    user:     'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a8 8 0 0 1 16 0v1',
    users:    'M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM1 21v-1a8 8 0 0 1 16 0v1M17 5a4 4 0 0 1 0 8M21 21v-1a6 6 0 0 0-4-5.7',
    mail:     'M3 5h18v14H3zm0 0 9 8 9-8',
    phone:    'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
    map:      'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
    truck:    'M3 7h11v9H3zM14 11h4l3 3v2h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    image:    'M3 5h18v14H3zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 0 3 4 4-5 6 7',
    upload:   'M12 3v14M5 10l7-7 7 7M3 21h18',
    download: 'M12 3v14M5 12l7 7 7-7M3 21h18',
    settings: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm9.4 4-1.6 1.4.6 2.2-2.1.7-1.4 1.6-2.2-.6L13 19l-1.4-1.6-2.2.6-1.4-1.6-2.1-.7.6-2.2L4.6 12l1.6-1.4-.6-2.2 2.1-.7L9.1 6.1l2.2.6L13 5l1.4 1.6 2.2-.6 1.4 1.6 2.1.7-.6 2.2z',
    plus:     'M12 5v14M5 12h14',
    arrow:    'M5 12h14M13 5l7 7-7 7',
    check:    'M5 12 10 17 20 7'
  };
  const iconNames = Object.keys(icons);
  const iconGrid = $('#iconGrid');
  if (iconGrid) {
    iconGrid.innerHTML = iconNames.map(name => `
      <div class="icon-tile" title="${name}">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <path d="${icons[name]}"/>
        </svg>
        ${name}
      </div>`).join('');
  }

  /* ----- Charts ----- */
  // Bar chart: Revenue by service (in $K)
  const drawBars = () => {
    const svg = $('#barChart');
    if (!svg) return;
    const data = [
      { label: 'Residential', val: 920 },
      { label: 'Commercial', val: 620 },
      { label: 'ADU', val: 380 },
      { label: 'Renov.', val: 280 },
      { label: 'Design', val: 160 }
    ];
    const W = 360, H = 180, pad = { l: 32, r: 12, t: 18, b: 30 };
    const max = 1000;
    const bw = (W - pad.l - pad.r) / data.length;
    let s = '';
    // gridlines
    for (let i = 0; i < 5; i++) {
      const y = pad.t + (H - pad.t - pad.b) * (i / 4);
      s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
      const v = Math.round(max * (1 - i / 4));
      s += `<text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" font-size="9" font-family="var(--font-mono)" fill="var(--muted-foreground)">${v}</text>`;
    }
    data.forEach((d, i) => {
      const h = (d.val / max) * (H - pad.t - pad.b);
      const x = pad.l + bw * i + 8;
      const y = H - pad.b - h;
      const fill = i === 0 ? 'var(--accent)' : 'var(--chart-2)';
      s += `<rect x="${x}" y="${y}" width="${bw - 16}" height="${h}" rx="3" fill="${fill}"/>`;
      s += `<text x="${x + (bw - 16) / 2}" y="${H - pad.b + 14}" text-anchor="middle" font-size="9.5" font-family="var(--font-sans)" fill="var(--muted-foreground)">${d.label}</text>`;
      s += `<text x="${x + (bw - 16) / 2}" y="${y - 5}" text-anchor="middle" font-size="10" font-weight="600" font-family="var(--font-mono)" fill="var(--foreground)">${d.val}</text>`;
    });
    svg.innerHTML = s;
  };
  drawBars();

  // Line chart: pipeline conversion over 12 months
  const drawLines = () => {
    const svg = $('#lineChart');
    if (!svg) return;
    const months = ['J','F','M','A','M','J','J','A','S','O','N','D'];
    const leads  = [42, 38, 55, 60, 72, 80, 88, 95, 84, 76, 68, 90];
    const quotes = [12, 16, 22, 28, 31, 35, 42, 48, 44, 36, 32, 40];
    const booked = [ 4,  6,  9, 12, 14, 17, 20, 24, 22, 18, 14, 22];
    const W = 360, H = 180, pad = { l: 32, r: 12, t: 18, b: 30 };
    const max = 100;
    const xAt = i => pad.l + (W - pad.l - pad.r) * (i / (months.length - 1));
    const yAt = v => pad.t + (H - pad.t - pad.b) * (1 - v / max);
    const path = arr => arr.map((v, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`).join(' ');
    let s = '';
    for (let i = 0; i < 5; i++) {
      const y = pad.t + (H - pad.t - pad.b) * (i / 4);
      s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`;
      s += `<text x="${pad.l - 6}" y="${y + 3}" text-anchor="end" font-size="9" font-family="var(--font-mono)" fill="var(--muted-foreground)">${Math.round(max * (1 - i / 4))}</text>`;
    }
    // area under leads
    const areaLeads = path(leads) + ` L${xAt(months.length-1)} ${H - pad.b} L${xAt(0)} ${H - pad.b} Z`;
    s += `<path d="${areaLeads}" fill="var(--accent)" fill-opacity="0.08"/>`;
    s += `<path d="${path(leads)}"  stroke="var(--accent)"  stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="${path(quotes)}" stroke="var(--chart-2)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    s += `<path d="${path(booked)}" stroke="var(--chart-4)" stroke-width="1.5" fill="none" stroke-dasharray="4 3" stroke-linecap="round" stroke-linejoin="round"/>`;
    months.forEach((m, i) => {
      s += `<text x="${xAt(i)}" y="${H - pad.b + 14}" text-anchor="middle" font-size="9.5" font-family="var(--font-mono)" fill="var(--muted-foreground)">${m}</text>`;
    });
    // legend
    s += `<g transform="translate(${pad.l},${pad.t - 8})">
      <circle cx="3" cy="0" r="3" fill="var(--accent)"/><text x="10" y="3" font-size="9.5" fill="var(--foreground)">Leads</text>
      <circle cx="55" cy="0" r="3" fill="var(--chart-2)"/><text x="62" y="3" font-size="9.5" fill="var(--foreground)">Quotes</text>
      <circle cx="110" cy="0" r="3" fill="var(--chart-4)"/><text x="117" y="3" font-size="9.5" fill="var(--foreground)">Booked</text>
    </g>`;
    svg.innerHTML = s;
  };
  drawLines();

  /* ----- Theme toggle ----- */
  const root = document.documentElement;
  const themeKey = 'cmi-theme';
  const setTheme = (t) => {
    root.classList.toggle('dark', t === 'dark');
    localStorage.setItem(themeKey, t);
    // also pipe into iframes if same origin
    $$('iframe').forEach(f => {
      try { f.contentDocument && f.contentDocument.documentElement.classList.toggle('dark', t === 'dark'); }
      catch (e) {}
    });
  };
  // Initialize from storage; default light
  setTheme(localStorage.getItem(themeKey) === 'dark' ? 'dark' : 'light');
  $('#themeToggle')?.addEventListener('click', () => {
    setTheme(root.classList.contains('dark') ? 'light' : 'dark');
    // re-draw chart fills (CSS vars update, but labels live inside SVG... will pick up vars naturally)
    drawBars(); drawLines();
  });
  // When iframes load, sync theme
  $$('iframe').forEach(f => {
    f.addEventListener('load', () => {
      try { f.contentDocument.documentElement.classList.toggle('dark', root.classList.contains('dark')); }
      catch (e) {}
    });
  });

  /* ----- Sidebar nav active state + crumb ----- */
  const sections = $$('.ds-section');
  const navItems = $$('.ds-side a.item');
  const byId = Object.fromEntries(navItems.map(a => [a.getAttribute('href').slice(1), a]));
  const crumb = $('#crumbActive');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navItems.forEach(a => a.classList.remove('active'));
        const id = e.target.id;
        if (byId[id]) {
          byId[id].classList.add('active');
          if (crumb) crumb.textContent = byId[id].textContent.trim();
        }
      }
    });
  }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });
  sections.forEach(s => observer.observe(s));

  /* ===================================================================
     Three.js — 3D Mark Studio
     Build an extruded hexagonal token with the molecular cut-out,
     six per gallery card with distinct materials.
     =================================================================== */
  if (!window.THREE) return;
  const THREE = window.THREE;

  // Outer pointy-top hexagon shape (radius 1)
  const hexShape = () => {
    const sh = new THREE.Shape();
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i * Math.PI / 3);
      pts.push([Math.cos(a), Math.sin(a)]);
    }
    sh.moveTo(...pts[0]);
    for (let i = 1; i < 6; i++) sh.lineTo(...pts[i]);
    sh.lineTo(...pts[0]);
    return sh;
  };
  const buildHexPuckGeometry = () => {
    const shape = hexShape();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.32,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 8,
      curveSegments: 24,
    });
    geo.translate(0, 0, -0.16);
    return geo;
  };
  /* === Canonical-mark geometry =========================================
     Instead of recreating the molecule with primitives, we sample the actual
     SVG path from CMI_Logos_Black.svg via the browser and use the resulting
     polyline as a Three.js Shape outline. This guarantees that BOTH the
     embossed relief and the cut-through hole match the favicon exactly.
     ====================================================================== */

  // The canonical SVG's single complex path. First subpath = molecule outline
  // (single closed curve made of cubic beziers covering all 6 atoms + 6 bars
  // merged together), second subpath = outer hex polygon. We only need
  // the molecule subpath; the outer hex is rebuilt parametrically below.
  const CANONICAL_PATH_D =
    "M0,-22.981C-1.305,-21.196 -3.409,-20.034 -5.778,-20.034C-8.38,-20.036 -10.655,-21.431 -11.912,-23.518C-12.798,-23.1 -13.629,-22.583 -14.391,-21.98C-14.301,-21.527 -14.252,-21.058 -14.252,-20.576C-14.256,-17.375 -16.317,-14.666 -19.177,-13.713C-19.271,-13.086 -19.323,-12.447 -19.325,-11.8C-19.323,-11.286 -19.285,-10.777 -19.22,-10.267C-16.336,-9.329 -14.256,-6.605 -14.254,-3.388C-14.253,-2.796 -14.327,-2.224 -14.461,-1.678C-13.592,-0.981 -12.632,-0.395 -11.6,0.059C-10.299,-1.76 -8.175,-2.947 -5.778,-2.947C-3.604,-2.947 -1.65,-1.969 -0.335,-0.426C0.798,-1.053 1.829,-1.852 2.725,-2.786C2.707,-2.981 2.696,-3.181 2.696,-3.388C2.696,-7.384 5.908,-10.62 9.871,-10.622C13.833,-10.62 17.045,-7.384 17.045,-3.388C17.045,0.607 13.833,3.846 9.871,3.846C7.857,3.846 6.039,3.006 4.739,1.661C3.715,2.528 2.588,3.279 1.384,3.893C1.392,4.022 1.396,4.153 1.396,4.288C1.395,8.282 -1.815,11.519 -5.778,11.52C-9.664,11.519 -12.828,8.407 -12.949,4.519C-14.384,3.941 -15.73,3.184 -16.951,2.262C-18.177,3.251 -19.736,3.846 -21.429,3.846C-25.392,3.846 -28.602,0.607 -28.604,-3.388C-28.602,-6.53 -26.614,-9.202 -23.835,-10.199C-23.888,-10.719 -23.92,-11.252 -23.92,-11.798C-23.92,-12.466 -23.875,-13.115 -23.799,-13.749C-26.598,-14.737 -28.602,-17.42 -28.604,-20.576C-28.602,-24.572 -25.392,-27.811 -21.429,-27.811C-19.626,-27.811 -17.977,-27.134 -16.72,-26.026C-15.546,-26.885 -14.262,-27.594 -12.896,-28.14C-12.468,-31.723 -9.449,-34.502 -5.778,-34.503C-1.889,-34.502 1.275,-31.384 1.393,-27.49C2.52,-26.914 3.576,-26.219 4.545,-25.42C5.856,-26.887 7.757,-27.811 9.871,-27.811C13.833,-27.811 17.045,-24.572 17.045,-20.576C17.045,-16.581 13.833,-13.344 9.871,-13.343C5.908,-13.344 2.696,-16.581 2.696,-20.576C2.696,-20.668 2.698,-20.76 2.701,-20.852C1.901,-21.676 0.993,-22.394 0,-22.981Z";

  // SVG path coords are in unitless design-units. Hex center & vertex distance:
  //   center  ≈ (-5.78, -11.5)   (midpoint of the outer hex vertices)
  //   R       ≈ 32.65            (center to a hex vertex)
  // Normalize so the outer hex has circumradius = 1, centered at origin.
  // Also flip Y (SVG Y-down → Three.js Y-up).
  const SVG_CX = -5.78, SVG_CY = -11.5;
  const SVG_R  = Math.hypot(-33.998 - SVG_CX, -27.915 - SVG_CY);
  const fromSvg = (x, y) => [(x - SVG_CX) / SVG_R, -(y - SVG_CY) / SVG_R];

  // Sample any SVG path string to a polyline by appending it off-screen and
  // walking it with getPointAtLength — DOM is required, this is fine inside
  // an IIFE that runs after <body> is parsed.
  const sampleSvgPath = (d, samples) => {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.position = 'absolute'; svg.style.visibility = 'hidden';
    document.body.appendChild(svg);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    const len = path.getTotalLength();
    const pts = [];
    for (let i = 0; i < samples; i++) {
      const p = path.getPointAtLength(len * i / samples);
      pts.push(fromSvg(p.x, p.y));
    }
    document.body.removeChild(svg);
    return pts;
  };

  const signedArea = (pts) => {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      a += x0 * y1 - x1 * y0;
    }
    return a / 2;
  };

  let canonicalMoleculePts = sampleSvgPath(CANONICAL_PATH_D, 120);
  // Make sure these are CCW (positive area in math coords) so they form a
  // valid outer Shape outline. They'll be reversed when used as a hole.
  if (signedArea(canonicalMoleculePts) < 0) canonicalMoleculePts.reverse();

  const pointsToShape = (pts) => {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
    return s;
  };
  const pointsToPath = (pts) => {
    const p = new THREE.Path();
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    return p;
  };

  // EMBOSSED: a relief mesh of the canonical molecule sits on top of the puck.
  const moleculeReliefGeo = new THREE.ExtrudeGeometry(
    pointsToShape(canonicalMoleculePts),
    {
      depth: 0.10,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.035,
      bevelSegments: 4,
      curveSegments: 4,
    }
  );

  const buildWireframeGroup = (color) => {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.4 });
    const mesh = new THREE.Mesh(moleculeReliefGeo, mat);
    // Place the relief so its BACK face sits flush with the puck's FRONT face
    // (puck has depth 0.32 centered on z=0 → front face is z = 0.16).
    mesh.position.z = 0.16;
    group.add(mesh);
    return group;
  };

  /* Cut-out geometry — outer hex extruded with the canonical molecule outline
     cut through as a single hole. Matches the favicon exactly. */
  const buildCutoutGeometry = () => {
    const shape = hexShape();
    // Reverse the molecule points so winding is opposite the outer hex
    // (Three.js expects holes to wind opposite to the outer outline).
    const holePts = canonicalMoleculePts.slice().reverse();
    shape.holes.push(pointsToPath(holePts));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.32,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.015,
      bevelSegments: 2,
      curveSegments: 4,
    });
    geo.translate(0, 0, -0.16);
    return geo;
  };

  const variants = {
    copper:    { body: 0x2a221b, wire: 0xc87a3a, rough: 0.35, metal: 0.7, env: '#2a221b', accent: 0xffd2a8 },
    graphite:  { body: 0x141312, wire: 0x9c9893, rough: 0.4,  metal: 0.6, env: '#0e0d0c', accent: 0x6c6864 },
    concrete:  { body: 0xe9e3d6, wire: 0x4b463f, rough: 0.85, metal: 0.05, env: '#e9e3d6', accent: 0x8c857a },
    blueprint: { body: 0x0e2657, wire: 0xeaf1ff, rough: 0.4,  metal: 0.45, env: '#0b1730', accent: 0xa6c5ff },
    oxide:     { body: 0x1c1311, wire: 0xb13b25, rough: 0.5,  metal: 0.55, env: '#2b1410', accent: 0xff9b88 },
    alabaster: { body: 0xf6f1e6, wire: 0xb8835a, rough: 0.55, metal: 0.15, env: '#f7f3eb', accent: 0xb6ab97 },
  };

  // Shared geometry across all canvases
  const puckGeo = buildHexPuckGeometry();
  const cutoutGeo = buildCutoutGeometry();

  $$('.three-card').forEach(card => {
    const canvas = card.querySelector('canvas');
    const variant = variants[card.dataset.variant] || variants.copper;
    const mode = card.dataset.mode || 'embossed';
    try { initThreeScene(canvas, variant, card, mode); }
    catch (e) { console.error('[3D init]', card.dataset.variant, mode, e); }
  });

  function initThreeScene(canvas, variant, card, mode) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    scene.add(new THREE.HemisphereLight(0xffffff, new THREE.Color(variant.env).getHex(), 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2.5, 3.0, 2.8);
    scene.add(key);
    const fill = new THREE.DirectionalLight(new THREE.Color(variant.accent).getHex(), 0.5);
    fill.position.set(-3.0, -1.2, 2.0);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.45);
    rim.position.set(0, -2.5, -2.5);
    scene.add(rim);
    // Cut-outs benefit from a back light so the molecule silhouette pops
    if (mode === 'cutout') {
      const back = new THREE.DirectionalLight(new THREE.Color(variant.accent).getHex(), 0.7);
      back.position.set(0.5, 1.0, -3.5);
      scene.add(back);
    }

    const root = new THREE.Group();

    if (mode === 'cutout') {
      const bodyMat = new THREE.MeshStandardMaterial({
        color: variant.body,
        roughness: variant.rough,
        metalness: variant.metal,
        side: THREE.DoubleSide,
      });
      root.add(new THREE.Mesh(cutoutGeo, bodyMat));
    } else {
      const bodyMat = new THREE.MeshStandardMaterial({
        color: variant.body,
        roughness: variant.rough,
        metalness: variant.metal,
      });
      root.add(new THREE.Mesh(puckGeo, bodyMat));
      root.add(buildWireframeGroup(variant.wire));
    }
    scene.add(root);

    renderer.setClearColor(new THREE.Color(variant.env), 1);

    // Interaction
    let dragging = false, lastX = 0, lastY = 0;
    let targetRotY = 0.55, targetRotX = -0.18;
    let curRotY = targetRotY, curRotX = targetRotX;
    let autoSpin = true;
    canvas.addEventListener('pointerdown', e => { dragging = true; autoSpin = false; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointerup',   e => { dragging = false; try { canvas.releasePointerCapture(e.pointerId); } catch(_) {} });
    canvas.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = (e.clientX - lastX) / 100;
      const dy = (e.clientY - lastY) / 100;
      targetRotY += dx;
      targetRotX = Math.max(-1, Math.min(1, targetRotX + dy));
      lastX = e.clientX; lastY = e.clientY;
    });
    card.addEventListener('mouseenter', () => { autoSpin = false; });
    card.addEventListener('mouseleave', () => { autoSpin = true; });

    let t0 = performance.now();
    function step() {
      const t = performance.now();
      const dt = Math.min(50, t - t0) / 1000;
      t0 = t;
      if (autoSpin) targetRotY += dt * 0.45;
      curRotY += (targetRotY - curRotY) * 0.12;
      curRotX += (targetRotX - curRotX) * 0.12;
      root.rotation.y = curRotY;
      root.rotation.x = curRotX;
      try { renderer.render(scene, camera); } catch (e) { console.error('[3D render]', e); }
    }
    resize();
    setInterval(step, 33);
    step();
    new ResizeObserver(resize).observe(canvas);
  }
})();
