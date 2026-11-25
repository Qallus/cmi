// The hero animations, written as ONE self-contained function with no outer
// references. The React component calls it directly; the HTML export (and the
// GIF recorder) inline it with `cmiHero.toString()`, so the animation is the
// same everywhere. Keep it plain ES2017 and dependency-free.

export function cmiHero(canvas: HTMLCanvasElement, kind: string, colors: string[]): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx || kind === "none") return () => {};
  const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let w = 0, h = 0, dpr = 1, raf = 0, stopped = false, last = 0, t = 0;
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const pick = () => colors[Math.floor(Math.random() * colors.length)] || "#ffffff";

  type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; c: string; rot: number; vr: number; life: number; kind: number };
  let ps: P[] = [];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, rect.width); h = Math.max(1, rect.height);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    ps = [];
    const area = (w * h) / 10000;
    if (kind === "snow") {
      const n = Math.min(160, Math.round(area * 1.4));
      for (let i = 0; i < n; i++) ps.push({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-0.15, 0.15), vy: rnd(0.25, 0.9), r: rnd(0.8, 2.6), a: rnd(0.25, 0.85), c: "#ffffff", rot: rnd(0, 6.28), vr: rnd(0.005, 0.02), life: 0, kind: Math.random() < 0.08 ? 1 : 0 });
    } else if (kind === "confetti") {
      const n = Math.min(120, Math.round(area * 1.1));
      for (let i = 0; i < n; i++) ps.push({ x: rnd(0, w), y: rnd(-h, h), vx: rnd(-0.3, 0.3), vy: rnd(0.6, 1.6), r: rnd(3, 6), a: rnd(0.6, 1), c: pick(), rot: rnd(0, 6.28), vr: rnd(-0.08, 0.08), life: 0, kind: Math.random() < 0.5 ? 1 : 0 });
    } else if (kind === "bokeh") {
      const n = Math.min(40, Math.round(area * 0.35) + 8);
      for (let i = 0; i < n; i++) ps.push({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-0.12, 0.12), vy: rnd(-0.35, -0.08), r: rnd(8, 34), a: rnd(0.08, 0.3), c: pick(), rot: 0, vr: 0, life: 0, kind: 0 });
    }
  }

  function burst() {
    const x = rnd(w * 0.15, w * 0.85), y = rnd(h * 0.15, h * 0.55), c = pick(), n = 46;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2, sp = rnd(0.8, 2.6);
      ps.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: rnd(1, 2), a: 1, c, rot: 0, vr: 0, life: rnd(60, 95), kind: 0 });
    }
  }

  function flake(p: P) {
    ctx!.save();
    ctx!.translate(p.x, p.y); ctx!.rotate(p.rot);
    ctx!.strokeStyle = "rgba(255,255,255," + p.a + ")"; ctx!.lineWidth = 1;
    const s = p.r * 3.2;
    for (let k = 0; k < 3; k++) { ctx!.rotate(Math.PI / 3); ctx!.beginPath(); ctx!.moveTo(-s, 0); ctx!.lineTo(s, 0); ctx!.stroke(); }
    ctx!.restore();
  }

  function draw(step: number) {
    ctx!.clearRect(0, 0, w, h);
    if (kind === "blueprint") {
      const g = 28, off = (t * 0.25) % g;
      ctx!.lineWidth = 1;
      for (let x = -g + off; x < w + g; x += g) { ctx!.strokeStyle = "rgba(169,195,218," + (Math.round((x - off) / g) % 5 === 0 ? 0.16 : 0.07) + ")"; ctx!.beginPath(); ctx!.moveTo(x, 0); ctx!.lineTo(x, h); ctx!.stroke(); }
      for (let y = -g + off * 0.6; y < h + g; y += g) { ctx!.strokeStyle = "rgba(169,195,218," + (Math.round((y - off * 0.6) / g) % 5 === 0 ? 0.16 : 0.07) + ")"; ctx!.beginPath(); ctx!.moveTo(0, y); ctx!.lineTo(w, y); ctx!.stroke(); }
      // A dimension line that draws itself across, then fades.
      const cyc = (t % 420) / 420, yy = h * 0.78, len = w * 0.5 * Math.min(1, cyc * 2), al = cyc < 0.75 ? 0.5 : 0.5 * (1 - (cyc - 0.75) / 0.25);
      ctx!.strokeStyle = colors[0] || "#c9a46e"; ctx!.globalAlpha = al;
      ctx!.beginPath(); ctx!.moveTo(w * 0.45, yy); ctx!.lineTo(w * 0.45 + len, yy); ctx!.stroke();
      ctx!.beginPath(); ctx!.moveTo(w * 0.45, yy - 6); ctx!.lineTo(w * 0.45, yy + 6); ctx!.stroke();
      ctx!.globalAlpha = 1;
      return;
    }
    if (kind === "fireworks" && step > 0 && Math.random() < 0.018 * step) burst();
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      if (kind === "snow") {
        p.x += (p.vx + Math.sin((t + i * 37) * 0.01) * 0.25) * step; p.y += p.vy * step; p.rot += p.vr * step;
        if (p.y > h + 6) { p.y = -6; p.x = rnd(0, w); }
        if (p.x > w + 6) p.x = -6; else if (p.x < -6) p.x = w + 6;
        if (p.kind === 1) flake(p);
        else { ctx!.fillStyle = "rgba(255,255,255," + p.a + ")"; ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, 6.283); ctx!.fill(); }
      } else if (kind === "confetti") {
        p.x += (p.vx + Math.sin((t + i * 23) * 0.02) * 0.4) * step; p.y += p.vy * step; p.rot += p.vr * step;
        if (p.y > h + 10) { p.y = -10; p.x = rnd(0, w); }
        ctx!.save(); ctx!.translate(p.x, p.y); ctx!.rotate(p.rot); ctx!.globalAlpha = p.a; ctx!.fillStyle = p.c;
        if (p.kind === 1) ctx!.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8); else { ctx!.beginPath(); ctx!.arc(0, 0, p.r * 0.5, 0, 6.283); ctx!.fill(); }
        ctx!.restore(); ctx!.globalAlpha = 1;
      } else if (kind === "bokeh") {
        p.x += p.vx * step; p.y += p.vy * step;
        if (p.y < -p.r * 2) { p.y = h + p.r * 2; p.x = rnd(0, w); }
        const gr = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        gr.addColorStop(0, p.c); gr.addColorStop(1, "rgba(0,0,0,0)");
        ctx!.globalAlpha = p.a * (0.75 + 0.25 * Math.sin((t + i * 50) * 0.02)); ctx!.fillStyle = gr;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, 6.283); ctx!.fill(); ctx!.globalAlpha = 1;
      } else if (kind === "fireworks") {
        p.x += p.vx * step; p.y += p.vy * step; p.vy += 0.025 * step; p.vx *= 0.985; p.vy *= 0.985; p.life -= step;
        if (p.life <= 0) { ps.splice(i, 1); continue; }
        ctx!.globalAlpha = Math.max(0, Math.min(1, p.life / 60)); ctx!.fillStyle = p.c;
        ctx!.beginPath(); ctx!.arc(p.x, p.y, p.r, 0, 6.283); ctx!.fill(); ctx!.globalAlpha = 1;
      }
    }
  }

  function frame(now: number) {
    if (stopped) return;
    const step = last ? Math.min(3, (now - last) / 16.67) : 1;
    last = now; t += step;
    if (!document.hidden) draw(step);
    raf = requestAnimationFrame(frame);
  }

  resize(); seed();
  if (kind === "fireworks") { burst(); }
  const onResize = () => { resize(); seed(); if (reduce) draw(0); };
  window.addEventListener("resize", onResize);
  if (reduce) {
    if (kind === "fireworks") for (let k = 0; k < 40; k++) draw(1);
    else draw(0);
  } else {
    raf = requestAnimationFrame(frame);
  }
  return () => { stopped = true; cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
}
