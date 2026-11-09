/* Alessio Paradisi — site script
   2. Card thumbnails: plots for the two main projects (mass–radius from a TOV solve, E/A(ρ, Δ)),
      small live simulations for the others (Ising, scalar field, paths on a circle, …)
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

  // ---- plot-style thumbnails: shared axes and labels ----
  const monoFont = (h) => `400 ${Math.max(11, Math.round(h * 0.075))}px "IBM Plex Mono", monospace`;
  function label(ctx, text, x, y, color, h, align = "left") {
    ctx.font = monoFont(h); ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(text, x, y);
  }
  function axes(ctx, l, r, top, bot, xl, yl, w, h) {
    ctx.strokeStyle = palette.ink3; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(l, top); ctx.lineTo(l, bot); ctx.lineTo(r, bot); ctx.stroke();
    label(ctx, xl + " →", r, h * 0.96, palette.ink3, h, "right");
    label(ctx, yl, l - w * 0.02, top + h * 0.06, palette.ink3, h, "right");
  }

  // ---- mass–radius sequence from VMC energies (data: [[rho, E/N, err], ...]) ----
  // Fit E/N = a u^α + b u^β (u = ρ/0.16) by weighted least squares on an (α, β) grid,
  // build P(ε) with c_s² ≤ 1, and integrate the TOV equations (G = c = 1, km).
  function tovCurve(data) {
    const r0 = 0.16, mn = 939.565, MeVfm3 = 1.3234e-6, Msun = 1.4766;
    let best = null;
    for (let al = 0.2; al <= 1.2; al += 0.02) for (let be = al + 0.3; be <= 4; be += 0.02) {
      let s11 = 0, s12 = 0, s22 = 0, y1 = 0, y2 = 0;
      for (const [rho, E, e] of data) {
        const wgt = 1 / (e * e), f1 = (rho / r0) ** al, f2 = (rho / r0) ** be;
        s11 += wgt * f1 * f1; s12 += wgt * f1 * f2; s22 += wgt * f2 * f2; y1 += wgt * f1 * E; y2 += wgt * f2 * E;
      }
      const det = s11 * s22 - s12 * s12, a = (y1 * s22 - y2 * s12) / det, b = (s11 * y2 - s12 * y1) / det;
      let chi = 0;
      for (const [rho, E, e] of data) chi += ((a * (rho / r0) ** al + b * (rho / r0) ** be - E) / e) ** 2;
      if (!best || chi < best.chi) best = { chi, a, b, al, be };
    }
    const { a, b, al, be } = best;
    const n = 500, rhos = [], P = [], eps = [];
    for (let i = 0; i < n; i++) {
      const rho = 0.004 * Math.pow(3 / 0.004, i / (n - 1)), u = rho / r0;
      rhos.push(rho);
      eps.push(rho * (mn + a * u ** al + b * u ** be));
      P.push((rho * rho * (a * al * u ** (al - 1) + b * be * u ** (be - 1))) / r0);
    }
    for (let i = 1; i < n; i++) {
      // causal continuation: once dP/dε would exceed 1, continue with c_s² = 1
      if (P[i] - P[i - 1] > eps[i] - eps[i - 1]) P[i] = P[i - 1] + (eps[i] - eps[i - 1]);
    }
    const lP = P.map(Math.log), lE = eps.map(Math.log), Pmin = P[0];
    const epsOf = (p) => {
      if (p <= Pmin) return 0;
      const x = Math.log(p);
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; lP[mid] > x ? (hi = mid) : (lo = mid); }
      const f = (x - lP[lo]) / (lP[hi] - lP[lo]);
      return Math.exp(lE[lo] + f * (lE[hi] - lE[lo]));
    };
    const rhs = (r, m, p) => {
      const e = epsOf(p) * MeVfm3, pp = p * MeVfm3;
      return [4 * Math.PI * r * r * e, -((e + pp) * (m + 4 * Math.PI * r * r * r * pp)) / (r * (r - 2 * m)) / MeVfm3];
    };
    const out = [];
    let mMax = 0;
    for (let k = 0; k < 60; k++) {
      const rc = 0.12 * Math.pow(2.6 / 0.12, k / 59);
      const ic = rhos.findIndex((x) => x >= rc);
      let r = 1e-3, p = P[ic], m = (4 / 3) * Math.PI * r ** 3 * eps[ic] * MeVfm3;
      const dr = 0.01;
      while (p > Pmin && r < 40) {
        const k1 = rhs(r, m, p), k2 = rhs(r + dr / 2, m + (dr / 2) * k1[0], p + (dr / 2) * k1[1]);
        const k3 = rhs(r + dr / 2, m + (dr / 2) * k2[0], p + (dr / 2) * k2[1]), k4 = rhs(r + dr, m + dr * k3[0], p + dr * k3[1]);
        m += (dr / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
        p += (dr / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
        r += dr;
      }
      const M = m / Msun;
      out.push([r, M]);
      if (M > mMax) mMax = M; else if (M < 0.985 * mMax) break;
    }
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* 2. Thumbnail simulations                                            */
  /* ------------------------------------------------------------------ */
  const sims = {
    // Thesis: BHF energy per particle vs density, one curve per spin polarization Δ (thesis data);
    // the highlighted curve sweeps slowly from Δ = 0 to Δ = 1 and back.
    eos() {
      const T = window.SITE_DATA && window.SITE_DATA.thesis;
      const seq = window.SiteCharts ? window.SiteCharts.seq : () => palette.accent;
      let t = 0;
      return {
        step() { t += 0.006; },
        draw(ctx, w, h) {
          if (!T) return;
          const xmin = 0.09, xmax = 0.37, ymin = 0, ymax = 150;
          const l = w * 0.09, r = w * 0.96, top = h * 0.1, bot = h * 0.84;
          const X = (v) => l + ((v - xmin) / (xmax - xmin)) * (r - l), Y = (v) => bot - ((v - ymin) / (ymax - ymin)) * (bot - top);
          axes(ctx, l, r, top, bot, "ρ", "E/A", w, h);
          const n = T.delta.length, sel = (0.5 - 0.5 * Math.cos(t)) * (n - 1);
          T.delta.forEach((d, i) => {
            const on = Math.max(0, 1 - Math.abs(i - sel));
            ctx.strokeStyle = seq(d); ctx.globalAlpha = 0.3 + 0.7 * on; ctx.lineWidth = 1.1 + 1.5 * on;
            ctx.beginPath();
            T.rho.forEach((x, k) => { if (x > xmax) return; const px = X(x), py = Y(T.E[i][k]); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
            ctx.stroke();
          });
          ctx.globalAlpha = 1;
          label(ctx, `Δ = ${(sel / (n - 1)).toFixed(1)}`, l + w * 0.03, top + h * 0.08, palette.ink2, h);
          label(ctx, "Δ = 1", X(0.37) - w * 0.06, Y(141.5) + h * 0.01, palette.ink3, h, "right");
          label(ctx, "Δ = 0", X(0.37) - w * 0.01, Y(39.7) + h * 0.1, palette.ink3, h, "right");
        },
      };
    },

    // NSmatter: mass–radius curves of pure-neutron-matter stars for the three NV2+3 models.
    // E/N = a u^α + b u^β fitted to the VMC energies, P = ρ² d(E/N)/dρ, c_s² capped at 1, TOV solved here.
    massradius() {
      const N = window.SITE_DATA && window.SITE_DATA.nsmatter;
      const curves = N ? [[N.eosIa, palette.down], [N.eosIIb, palette.accent], [N.eos3N, palette.up]].map(([d, c]) => ({ pts: tovCurve(d), color: c })) : [];
      let t = 0;
      return {
        step() { t += 0.004; },
        draw(ctx, w, h) {
          // no crust here, so the low-mass ends hook back; show M ≥ 0.6 M_sun, where the sequences are recognizable
          const xmin = 7.8, xmax = 14, ymin = 0.6, ymax = 2.55;
          const l = w * 0.09, r = w * 0.96, top = h * 0.1, bot = h * 0.84;
          const X = (v) => l + ((v - xmin) / (xmax - xmin)) * (r - l), Y = (v) => bot - ((v - ymin) / (ymax - ymin)) * (bot - top);
          axes(ctx, l, r, top, bot, "R", "M", w, h);
          // 2 M_sun reference line
          ctx.setLineDash([2, 4]); ctx.strokeStyle = palette.ink3; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(l, Y(2)); ctx.lineTo(r, Y(2)); ctx.stroke(); ctx.setLineDash([]);
          label(ctx, "2 M⊙", l + w * 0.015, Y(2) - h * 0.03, palette.ink3, h);
          ctx.save(); ctx.beginPath(); ctx.rect(l, top - 4, r - l, bot - top + 4); ctx.clip();
          const u = 0.5 - 0.5 * Math.cos(t);
          for (const c of curves) {
            ctx.strokeStyle = c.color; ctx.lineWidth = 1.8; ctx.beginPath();
            c.pts.forEach(([R, M], k) => (k ? ctx.lineTo(X(R), Y(M)) : ctx.moveTo(X(R), Y(M))));
            ctx.stroke();
            // a star sliding along its sequence as the central density changes
            const vis = c.pts.filter((q) => q[1] >= ymin + 0.05);
            const p = vis[Math.round(u * (vis.length - 1))];
            if (p) { ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), Math.max(2.5, h * 0.022), 0, Math.PI * 2); ctx.fill(); }
          }
          ctx.restore();
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
