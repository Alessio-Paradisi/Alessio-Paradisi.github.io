/* Alessio Paradisi — site script
   1. Hero: field lines of a slowly precessing magnetic dipole (a pulsar nod)
   2. Card thumbnails: small live simulations (Ising, scalar field, paths on a circle, …)
   3. Project drawer with hash routing (#p/<id>)
   4. NSmatter charts and the Fermi-sea toy
*/
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const hexToRgb = (hex) => {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  let palette = {};
  const readPalette = () => {
    palette = {
      bg: css("--bg"), surface: css("--surface"), ink: css("--ink"), ink2: css("--ink-2"), ink3: css("--ink-3"),
      rule: css("--rule"), accent: css("--accent"), up: css("--accent-2"), down: css("--accent-3"),
      field: css("--field"),
    };
  };
  readPalette();
  const themeListeners = [];
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    readPalette();
    themeListeners.forEach((f) => f());
  });

  // Gaussian random number (Box–Muller)
  const gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const wrapAngle = (a) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

  /* ------------------------------------------------------------------ */
  /* 2. Thumbnail simulations                                            */
  /* ------------------------------------------------------------------ */
  const sims = {
    // Two Fermi seas whose radii follow k_F(1 ± Δ)^{1/3} as Δ breathes 0 → 1
    fermi() {
      let t = 0;
      return {
        step() { t += 0.012; },
        draw(ctx, w, h) {
          const D = 0.5 - 0.5 * Math.cos(t);
          const r0 = Math.min(h * 0.3, w * 0.13);
          const cyy = h * 0.5;
          const xs = [w * 0.36, w * 0.64];
          const rs = [r0 * Math.cbrt(1 + D), r0 * Math.cbrt(Math.max(0, 1 - D))];
          const cols = [palette.up, palette.down];
          ctx.lineWidth = 1;
          xs.forEach((x, i) => {
            ctx.setLineDash([3, 4]); ctx.strokeStyle = palette.ink3;
            ctx.beginPath(); ctx.arc(x, cyy, r0, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = cols[i]; ctx.globalAlpha = 0.18;
            ctx.beginPath(); ctx.arc(x, cyy, rs[i], 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1; ctx.strokeStyle = cols[i]; ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(x, cyy, rs[i], 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = cols[i];
            ctx.font = `500 ${Math.round(h * 0.11)}px "IBM Plex Mono", monospace`;
            ctx.textAlign = "center";
            ctx.fillText(i ? "↓" : "↑", x, cyy + h * 0.04);
          });
          ctx.fillStyle = palette.ink2;
          ctx.font = `400 ${Math.max(11, Math.round(h * 0.075))}px "IBM Plex Mono", monospace`;
          ctx.textAlign = "left";
          ctx.fillText(`Δ = ${D.toFixed(2)}`, w * 0.04, h * 0.14);
        },
      };
    },

    // 14 neutrons with spins wandering in a periodic box (illustration of VMC walkers)
    walkers() {
      const N = 14, pts = [];
      for (let i = 0; i < N; i++) pts.push({ x: Math.random(), y: Math.random(), s: i < 7 ? 1 : -1, a: Math.random() * 6.28 });
      const d0 = 0.12;
      return {
        step() {
          for (const p of pts) {
            const nx = (p.x + (Math.random() - 0.5) * 0.02 + 1) % 1;
            const ny = (p.y + (Math.random() - 0.5) * 0.02 + 1) % 1;
            let ok = true;
            for (const q of pts) {
              if (q === p) continue;
              let dx = Math.abs(nx - q.x); dx = Math.min(dx, 1 - dx);
              let dy = Math.abs(ny - q.y); dy = Math.min(dy, 1 - dy);
              if (dx * dx + dy * dy < d0 * d0) { ok = false; break; }
            }
            if (ok) { p.x = nx; p.y = ny; }
            p.a += (Math.random() - 0.5) * 0.08;
          }
        },
        draw(ctx, w, h) {
          const L = h * 0.78, ox = (w - L) / 2, oy = (h - L) / 2;
          // periodic images
          ctx.strokeStyle = palette.rule; ctx.lineWidth = 1;
          for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) {
            if (!i && !j) continue;
            ctx.strokeRect(ox + i * L, oy + j * L, L, L);
          }
          ctx.strokeStyle = palette.ink3; ctx.strokeRect(ox, oy, L, L);
          for (let i = -2; i <= 2; i++) for (let j = -1; j <= 1; j++) {
            const img = i || j;
            for (const p of pts) {
              const x = ox + (p.x + i) * L, y = oy + (p.y + j) * L;
              if (x < -10 || x > w + 10 || y < -10 || y > h + 10) continue;
              const col = p.s > 0 ? palette.up : palette.down;
              ctx.globalAlpha = img ? 0.18 : 1;
              ctx.fillStyle = col;
              ctx.beginPath(); ctx.arc(x, y, L * 0.03, 0, Math.PI * 2); ctx.fill();
              // spin arrow, slightly wobbling (continuous spinors)
              const len = L * 0.07, ang = (p.s > 0 ? -Math.PI / 2 : Math.PI / 2) + 0.35 * Math.sin(p.a);
              ctx.strokeStyle = col; ctx.lineWidth = 1.4;
              ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke();
            }
          }
          ctx.globalAlpha = 1;
        },
      };
    },

    // Free massive scalar field on a 1D chain, heat-bath updates; time slices stacked
    scalar() {
      const N = 96, m2 = 0.04, rows = 22;
      const phi = new Float64Array(N);
      const hist = [];
      const sd = 1 / Math.sqrt(2 + m2);
      let tick = 0;
      return {
        step() {
          for (let i = 0; i < N; i++) {
            const mean = (phi[(i + N - 1) % N] + phi[(i + 1) % N]) / (2 + m2);
            phi[i] = mean + sd * gauss();
          }
          if (++tick % 3 === 0) {
            let mu = 0; for (let i = 0; i < N; i++) mu += phi[i]; mu /= N;
            hist.push(Array.from(phi, (v) => v - mu));
            if (hist.length > rows) hist.shift();
          }
        },
        draw(ctx, w, h) {
          const pad = w * 0.05, dx = (w - 2 * pad) / (N - 1);
          const gap = (h * 0.8) / rows, amp = gap * 0.55;
          hist.forEach((row, k) => {
            const y0 = h * 0.12 + k * gap;
            const age = (k + 1) / hist.length;
            ctx.strokeStyle = k === hist.length - 1 ? palette.up : palette.accent;
            ctx.globalAlpha = k === hist.length - 1 ? 1 : 0.15 + 0.5 * age;
            ctx.lineWidth = k === hist.length - 1 ? 1.6 : 1;
            ctx.beginPath();
            for (let i = 0; i < N; i++) {
              const y = y0 + Math.max(-3, Math.min(3, row[i])) * amp * 0.35;
              i ? ctx.lineTo(pad + i * dx, y) : ctx.moveTo(pad, y);
            }
            ctx.stroke();
          });
          ctx.globalAlpha = 1;
        },
      };
    },

    // Euclidean path θ(τ) on a circle with winding number 1, local Metropolis
    circle() {
      const N = 64, K = 3.0; // K = I/a, stiffness of the discretised kinetic term
      const th = new Float64Array(N);
      for (let i = 0; i < N; i++) th[i] = (2 * Math.PI * i) / N;
      let cursor = 0;
      const local = (i, v) => {
        const a = wrapAngle(v - th[(i + N - 1) % N]), b = wrapAngle(th[(i + 1) % N] - v);
        return 0.5 * K * (a * a + b * b);
      };
      return {
        step() {
          for (let s = 0; s < N; s++) {
            const i = (Math.random() * N) | 0;
            const nv = th[i] + (Math.random() - 0.5) * 0.9;
            const dS = local(i, nv) - local(i, th[i]);
            if (dS < 0 || Math.random() < Math.exp(-dS)) th[i] = wrapAngle(nv);
          }
          cursor = (cursor + 0.25) % N;
        },
        draw(ctx, w, h) {
          // left: the circle with the particle at the current Euclidean time slice
          const r = h * 0.3, x0 = w * 0.2, y0 = h * 0.5;
          ctx.strokeStyle = palette.ink3; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(x0, y0, r, 0, Math.PI * 2); ctx.stroke();
          const ci = Math.floor(cursor);
          ctx.fillStyle = palette.up;
          ctx.beginPath(); ctx.arc(x0 + r * Math.cos(th[ci]), y0 + r * Math.sin(th[ci]), h * 0.035, 0, Math.PI * 2); ctx.fill();
          // right: unrolled θ(τ) ∈ [−π, π)
          const L = w * 0.4, R0 = w * 0.92, top = h * 0.15, H = h * 0.7;
          const X = (i) => R0 - L + (i / (N - 1)) * L;
          const Y = (v) => top + ((v + Math.PI) / (2 * Math.PI)) * H;
          ctx.strokeStyle = palette.rule; ctx.strokeRect(R0 - L, top, L, H);
          ctx.strokeStyle = palette.accent; ctx.lineWidth = 1.4;
          ctx.beginPath();
          for (let i = 0; i < N; i++) {
            if (i && Math.abs(th[i] - th[i - 1]) > Math.PI) { ctx.stroke(); ctx.beginPath(); ctx.moveTo(X(i), Y(th[i])); continue; }
            i ? ctx.lineTo(X(i), Y(th[i])) : ctx.moveTo(X(i), Y(th[i]));
          }
          ctx.stroke();
          ctx.fillStyle = palette.up;
          ctx.beginPath(); ctx.arc(X(ci), Y(th[ci]), 3, 0, Math.PI * 2); ctx.fill();
          let q = 0; for (let i = 0; i < N; i++) q += wrapAngle(th[(i + 1) % N] - th[i]);
          ctx.fillStyle = palette.ink2;
          ctx.font = `400 ${Math.max(11, Math.round(h * 0.075))}px "IBM Plex Mono", monospace`;
          ctx.textAlign = "left";
          ctx.fillText(`Q = ${Math.round(q / (2 * Math.PI))}`, w * 0.04, h * 0.14);
          ctx.fillStyle = palette.ink3;
          ctx.fillText("θ(τ)", R0 - L, h * 0.95);
        },
      };
    },

    // 2D Ising model at the critical temperature, Metropolis sweeps
    ising() {
      let Lx = 64, Ly = 36, s, off, octx, img;
      const beta = 1 / 2.269185;
      const p4 = Math.exp(-4 * beta), p8 = Math.exp(-8 * beta);
      const setup = (w, h) => {
        if (!(w > 0 && h > 0)) return;
        Ly = Math.max(20, Math.min(80, Math.round((Lx * h) / w)));
        s = new Int8Array(Lx * Ly).map(() => (Math.random() < 0.5 ? 1 : -1));
        off = document.createElement("canvas"); off.width = Lx; off.height = Ly;
        octx = off.getContext("2d"); img = octx.createImageData(Lx, Ly);
      };
      return {
        resize: setup,
        step() {
          if (!s) return;
          for (let n = 0; n < Lx * Ly; n++) {
            const x = (Math.random() * Lx) | 0, y = (Math.random() * Ly) | 0;
            const i = y * Lx + x;
            const nb = s[y * Lx + ((x + 1) % Lx)] + s[y * Lx + ((x + Lx - 1) % Lx)] + s[((y + 1) % Ly) * Lx + x] + s[((y + Ly - 1) % Ly) * Lx + x];
            const dE = 2 * s[i] * nb;
            if (dE <= 0 || (dE === 4 && Math.random() < p4) || (dE === 8 && Math.random() < p8)) s[i] = -s[i];
          }
        },
        draw(ctx, w, h) {
          if (!s) return;
          const dn = hexToRgb(palette.surface);
          const up = hexToRgb(palette.up).map((c, j) => Math.round(c * 0.6 + dn[j] * 0.4));
          for (let i = 0; i < s.length; i++) {
            const c = s[i] > 0 ? up : dn, k = i * 4;
            img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
          }
          octx.putImageData(img, 0, 0);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(off, 0, 0, w, h);
        },
      };
    },

    // Schematic running couplings (static)
    running() {
      return {
        static: true,
        draw(ctx, w, h) {
          const l = w * 0.1, r = w * 0.94, top = h * 0.14, bot = h * 0.8;
          ctx.strokeStyle = palette.ink3; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(l, top); ctx.lineTo(l, bot); ctx.lineTo(r, bot); ctx.stroke();
          const n = 120;
          // QCD: one-loop α_s(Q) ∝ 1 / ln(Q²/Λ²), schematic units
          ctx.strokeStyle = palette.up; ctx.lineWidth = 2; ctx.beginPath();
          for (let i = 0; i <= n; i++) {
            const u = i / n, lnQ = 0.35 + u * 4.2;
            const a = 1 / (2 * lnQ);
            const x = l + u * (r - l), y = bot - Math.min(1, a / 1.45) * (bot - top);
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
          // QED: slowly increasing coupling
          ctx.strokeStyle = palette.accent; ctx.beginPath();
          for (let i = 0; i <= n; i++) {
            const u = i / n;
            const a = 0.12 / (1 - 0.18 * u);
            const x = l + u * (r - l), y = bot - (a / 1.45) * (bot - top) * 3.2;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
          }
          ctx.stroke();
          ctx.font = `400 ${Math.max(11, Math.round(h * 0.075))}px "IBM Plex Mono", monospace`;
          ctx.fillStyle = palette.up; ctx.textAlign = "left";
          ctx.fillText("αs(Q)  QCD", l + (r - l) * 0.2, top + (bot - top) * 0.12);
          ctx.fillStyle = palette.accent; ctx.textAlign = "right";
          ctx.fillText("α(Q)  QED", r, bot - (bot - top) * 0.42);
          ctx.fillStyle = palette.ink3;
          ctx.fillText("log Q →", r, h * 0.94);
        },
      };
    },
  };

  function thumbnails() {
    document.querySelectorAll("canvas.thumb[data-sim]").forEach((canvas) => {
      try { initThumb(canvas); } catch (err) { console.error(err); }
    });
  }
  function initThumb(canvas) {
    {
      const make = sims[canvas.dataset.sim];
      if (!make) return;
      const sim = make();
      const ctx = canvas.getContext("2d");
      let w = 0, h = 0, raf = 0, visible = false, running = false, frame = 0;

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        w = rect.width; h = rect.height;
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (sim.resize) sim.resize(w, h);
      };
      const paint = () => { ctx.clearRect(0, 0, w, h); sim.draw(ctx, w, h); };
      const loop = () => {
        // ~30 fps is plenty for these
        if (frame++ % 2 === 0) { sim.step(); paint(); }
        raf = requestAnimationFrame(loop);
      };
      const start = () => { if (!running && visible && !document.hidden && !sim.static && !reduceMotion) { running = true; raf = requestAnimationFrame(loop); } };
      const stop = () => { running = false; cancelAnimationFrame(raf); };

      resize();
      if (sim.static || reduceMotion) {
        if (sim.step) for (let i = 0; i < 120; i++) sim.step();
        paint();
      }
      let rt;
      window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { resize(); paint(); }, 150); });
      themeListeners.push(paint);
      new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }, { rootMargin: "60px" }).observe(canvas);
      document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
    }
  }

  /* ------------------------------------------------------------------ */
  /* 3. Drawer                                                           */
  /* ------------------------------------------------------------------ */
  function drawer() {
    const el = document.getElementById("drawer");
    const body = document.getElementById("drawer-body");
    const scrim = document.querySelector(".scrim");
    const closeBtn = el.querySelector(".close");
    let current = null, opener = null, pushed = false, hideTimer = 0;

    const open = (id) => {
      const tpl = document.getElementById("d-" + id);
      if (!tpl) return false;
      clearTimeout(hideTimer);
      body.replaceChildren(tpl.content.cloneNode(true));
      body.scrollTop = 0;
      el.hidden = false; scrim.hidden = false;
      requestAnimationFrame(() => { el.classList.add("open"); scrim.classList.add("open"); });
      document.body.classList.add("locked");
      current = id;
      enhance(body);
      setTimeout(() => closeBtn.focus({ preventScroll: true }), 60);
      return true;
    };
    const hide = () => {
      if (!current) return;
      el.classList.remove("open"); scrim.classList.remove("open");
      document.body.classList.remove("locked");
      hideTimer = setTimeout(() => { el.hidden = true; scrim.hidden = true; body.replaceChildren(); }, reduceMotion ? 0 : 380);
      current = null;
      if (opener) opener.focus({ preventScroll: true });
    };
    const requestClose = () => {
      if (pushed) { pushed = false; history.back(); }
      else { history.replaceState(null, "", location.pathname + location.search); hide(); }
    };
    const route = () => {
      const m = location.hash.match(/^#p\/([\w-]+)$/);
      if (m) { if (m[1] !== current) open(m[1]); }
      else hide();
    };

    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#p/"]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      opener = a.closest(".card") || a;
      const id = a.getAttribute("href").slice(3);
      if (current === id) return;
      history.pushState(null, "", "#p/" + id);
      pushed = true;
      open(id);
    });
    window.addEventListener("popstate", () => { pushed = false; route(); });
    window.addEventListener("hashchange", route);
    closeBtn.addEventListener("click", requestClose);
    scrim.addEventListener("click", requestClose);
    document.addEventListener("keydown", (e) => {
      if (!current) return;
      if (e.key === "Escape") { e.preventDefault(); requestClose(); }
      if (e.key === "Tab") {
        const f = el.querySelectorAll('button, a[href], input, summary, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    route();
  }

  /* ------------------------------------------------------------------ */
  /* 4. Charts and toys inside the drawer                                */
  /* ------------------------------------------------------------------ */
  // Data figures live in figures.js / charts.js; here only the Fermi-sea toy needs SVG helpers.
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };

  function toyFermi(box) {
    const input = box.querySelector("input");
    const out = box.querySelector("output");
    const fud = box.querySelector('[data-out="fud"]');
    const svg = box.querySelector("svg");
    const r0 = 46, centers = [100, 220], cy = 70;
    const parts = centers.map((cx, i) => {
      const ref = svgEl("circle", { cx, cy, r: r0, fill: "none", stroke: "var(--ink-3)", "stroke-dasharray": "3 4" });
      const sea = svgEl("circle", { cx, cy, r: r0, style: `fill: var(${i ? "--accent-3" : "--accent-2"}); fill-opacity: .18; stroke: var(${i ? "--accent-3" : "--accent-2"}); stroke-width: 1.8` });
      const sym = svgEl("text", { x: cx, y: cy + 7, "text-anchor": "middle", "font-size": 22, style: `fill: var(${i ? "--accent-3" : "--accent-2"}); font-family: var(--mono)` }, i ? "↓" : "↑");
      const lab = svgEl("text", { x: cx, y: 142, "text-anchor": "middle", "font-size": 11, style: "fill: var(--ink-2); font-family: var(--mono)" });
      svg.append(ref, sea, sym, lab);
      return { sea, lab };
    });
    const update = () => {
      const D = parseFloat(input.value);
      const k = [Math.cbrt(1 + D), Math.cbrt(Math.max(0, 1 - D))];
      parts.forEach((p, i) => {
        p.sea.setAttribute("r", (r0 * k[i]).toFixed(2));
        p.lab.textContent = `k${i ? "↓" : "↑"}/kF = ${k[i].toFixed(3)}`;
      });
      out.textContent = D.toFixed(2);
      fud.textContent = ((1 - D * D) / 2).toFixed(2);
    };
    input.addEventListener("input", update);
    update();
  }

  // Live 2D Ising model, paced for the eye: a fixed number of update steps per second,
  // Wolff clusters highlighted as they flip, and a running trace of |m| against Onsager's exact value.
  function toyIsing(box) {
    const cv = box.querySelector(".ising-grid"), ctx = cv.getContext("2d");
    const tr = box.querySelector(".ising-trace"), tctx = tr.getContext("2d");
    const L = cv.width, N = L * L, TC = 2 / Math.log(1 + Math.SQRT2);
    const s = new Int8Array(N), mark = new Float32Array(N);          // mark: highlight strength of recently flipped cluster
    const stack = new Int32Array(N), img = ctx.createImageData(L, L);
    const input = box.querySelector("input[type=range]"), out = box.querySelector("output");
    const mOut = box.querySelector('[data-out="m"]'), tOut = box.querySelector('[data-out="t"]'), phOut = box.querySelector('[data-out="phase"]');
    const playBtn = box.querySelector(".ising-play");
    // ticks per second; a Metropolis tick is 1/4 sweep, a Wolff tick is one cluster
    const RATE = { metropolis: { slow: 4, normal: 12, fast: 40 }, wolff: { slow: 2, normal: 6, fast: 24 } };
    let T = +input.value, alg = "metropolis", speed = "slow", running = !reduceMotion, sweeps = 0, acc = 0, last = 0;
    const hist = [];
    const randomize = () => { for (let i = 0; i < N; i++) s[i] = Math.random() < 0.5 ? 1 : -1; mark.fill(0); hist.length = 0; sweeps = 0; };
    const xL = (i) => i % L, yL = (i) => (i / L) | 0;
    const nb = (i, k) => { const x = xL(i), y = yL(i); return k === 0 ? y * L + (x + 1) % L : k === 1 ? y * L + (x + L - 1) % L : k === 2 ? ((y + 1) % L) * L + x : ((y + L - 1) % L) * L + x; };

    const metropolisQuarter = () => {
      const p4 = Math.exp(-4 / T), p8 = Math.exp(-8 / T);
      for (let n = 0; n < N / 4; n++) {
        const i = (Math.random() * N) | 0;
        const dE = 2 * s[i] * (s[nb(i, 0)] + s[nb(i, 1)] + s[nb(i, 2)] + s[nb(i, 3)]);
        if (dE <= 0 || (dE === 4 && Math.random() < p4) || (dE === 8 && Math.random() < p8)) s[i] = -s[i];
      }
      sweeps += 0.25;
    };
    const wolffCluster = () => {
      const pAdd = 1 - Math.exp(-2 / T);
      for (let i = 0; i < N; i++) mark[i] *= 0.35;                   // older clusters fade out
      const seed = (Math.random() * N) | 0, sp = s[seed];
      let top = 0, size = 1; stack[top++] = seed; s[seed] = -sp; mark[seed] = 1;
      while (top) {
        const i = stack[--top];
        for (let k = 0; k < 4; k++) {
          const j = nb(i, k);
          if (s[j] === sp && Math.random() < pAdd) { s[j] = -sp; mark[j] = 1; stack[top++] = j; size++; }
        }
      }
      sweeps += size / N;
    };

    const UP = [194, 65, 12], DN = [248, 245, 238], CL = [47, 111, 168];
    const magnet = () => { let m = 0; for (let i = 0; i < N; i++) m += s[i]; return Math.abs(m) / N; };
    const onsager = (t) => (t < TC ? Math.pow(1 - Math.pow(Math.sinh(2 / t), -4), 1 / 8) : 0);

    function drawGrid() {
      for (let i = 0; i < N; i++) {
        const base = s[i] > 0 ? UP : DN, a = alg === "wolff" ? mark[i] * 0.85 : 0, k = i * 4;
        img.data[k] = base[0] + (CL[0] - base[0]) * a;
        img.data[k + 1] = base[1] + (CL[1] - base[1]) * a;
        img.data[k + 2] = base[2] + (CL[2] - base[2]) * a;
        img.data[k + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
    function drawTrace() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = tr.clientWidth, h = tr.clientHeight;
      if (tr.width !== Math.round(w * dpr)) { tr.width = Math.round(w * dpr); tr.height = Math.round(h * dpr); }
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tctx.clearRect(0, 0, w, h);
      const pad = 22, Y = (v) => h - 6 - v * (h - 14);
      tctx.font = "10px 'IBM Plex Mono', monospace"; tctx.fillStyle = "#7b8592";
      tctx.strokeStyle = "rgba(22,32,44,.12)"; tctx.lineWidth = 1;
      for (const v of [0, 0.5, 1]) { tctx.beginPath(); tctx.moveTo(pad, Y(v)); tctx.lineTo(w, Y(v)); tctx.stroke(); tctx.fillText(String(v), 2, Y(v) + 3); }
      const ex = onsager(T);
      tctx.setLineDash([5, 4]); tctx.strokeStyle = "#0d2b4e"; tctx.beginPath(); tctx.moveTo(pad, Y(ex)); tctx.lineTo(w, Y(ex)); tctx.stroke(); tctx.setLineDash([]);
      const n = hist.length, MAX = 240, dx = (w - pad) / (MAX - 1);
      tctx.strokeStyle = "#c2410c"; tctx.lineWidth = 1.6; tctx.beginPath();
      hist.forEach((v, i) => { const x = pad + (MAX - n + i) * dx; i ? tctx.lineTo(x, Y(v)) : tctx.moveTo(x, Y(v)); });
      tctx.stroke();
    }
    function readouts() {
      const m = magnet();
      mOut.textContent = m.toFixed(3);
      tOut.textContent = `${sweeps < 10 ? sweeps.toFixed(1) : Math.round(sweeps)} sweeps`;
      return m;
    }
    function phase() {
      phOut.textContent = T < 2.15 ? "ordered · ferromagnet" : T <= 2.40 ? "near the critical point" : "disordered · paramagnet";
      phOut.dataset.phase = T < 2.15 ? "cold" : T <= 2.40 ? "crit" : "hot";
    }
    function tick() {
      alg === "wolff" ? wolffCluster() : metropolisQuarter();
      hist.push(magnet()); if (hist.length > 240) hist.shift();
    }
    function loop(now) {
      if (!box.isConnected) return;                                   // drawer closed
      const dt = Math.min(0.25, (now - (last || now)) / 1000); last = now;
      if (running) {
        acc += dt * RATE[alg][speed];
        let steps = Math.min(8, Math.floor(acc));
        acc -= Math.floor(acc);
        if (steps > 0) { while (steps-- > 0) tick(); drawGrid(); readouts(); drawTrace(); }
      }
      requestAnimationFrame(loop);
    }

    // controls
    const setT = (v) => { T = +v; input.value = T; out.textContent = T.toFixed(2); phase(); drawTrace(); };
    input.addEventListener("input", () => setT(input.value));
    box.querySelectorAll("[data-temp]").forEach((b) => b.addEventListener("click", () => setT(b.dataset.temp)));
    const segOn = (sel, el) => box.querySelectorAll(sel).forEach((x) => x.classList.toggle("on", x === el));
    box.querySelectorAll("[data-alg]").forEach((b) => b.addEventListener("click", () => {
      alg = b.dataset.alg; mark.fill(0); segOn("[data-alg]", b);
      box.classList.toggle("is-wolff", alg === "wolff"); drawGrid();
    }));
    box.querySelectorAll("[data-speed]").forEach((b) => b.addEventListener("click", () => { speed = b.dataset.speed; segOn("[data-speed]", b); }));
    const setPlay = (on) => { running = on; playBtn.textContent = on ? "Pause" : "Play"; playBtn.setAttribute("aria-pressed", String(on)); };
    playBtn.addEventListener("click", () => setPlay(!running));
    box.querySelector(".ising-reset").addEventListener("click", () => { randomize(); drawGrid(); readouts(); drawTrace(); });

    randomize(); setT(T); setPlay(running); drawGrid(); readouts(); drawTrace();
    requestAnimationFrame(loop);
  }

  // Typeset \( … \) and \[ … \] with KaTeX (loaded from cdnjs). If it failed to load, the raw TeX stays readable.
  function typeset(root) {
    if (typeof window.renderMathInElement !== "function") return;
    window.renderMathInElement(root, {
      delimiters: [
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false },
      ],
      throwOnError: false,
    });
  }

  function enhance(root) {
    typeset(root);
    if (window.mountFigures) window.mountFigures(root);
    root.querySelectorAll('[data-toy="fermi"]').forEach(toyFermi);
    root.querySelectorAll('[data-toy="ising"]').forEach(toyIsing);
  }

  /* ------------------------------------------------------------------ */
  // Frosted top bar: visible once the name in the header has scrolled out of view
  function topbar() {
    const bar = document.querySelector(".topbar"), name = document.querySelector(".hero h1");
    if (!bar || !name) return;
    const set = (on) => { bar.classList.toggle("show", on); bar.toggleAttribute("inert", !on); };
    set(false);
    new IntersectionObserver(([e]) => set(!e.isIntersecting && e.boundingClientRect.top < 0)).observe(name);
    // the name link returns to the top without leaving a hash in the URL
    bar.querySelector(".topbar-name").addEventListener("click", (ev) => {
      ev.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  // Email links are assembled here so the address never appears in the HTML source (spam bots)
  function emails() {
    document.querySelectorAll("[data-email]").forEach((a) => {
      const [user, domain] = a.dataset.email.split("|");
      const addr = `${user}@${domain}`;
      a.href = `mailto:${addr}`;
      const t = a.querySelector("[data-email-text]");
      if (t) t.textContent = addr;
    });
  }

  emails();
  thumbnails();
  drawer();
  topbar();
})();
