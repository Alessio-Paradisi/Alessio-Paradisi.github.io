/* The site's figures, rebuilt from data (assets/js/data.js) with SiteCharts.
   Each <figure data-figure="name"> inside a drawer is mounted by window.mountFigures(root). */
(() => {
  "use strict";
  const { Chart, seq } = window.SiteCharts;
  const D = window.SITE_DATA;
  const C = { navy: "#0d2b4e", orange: "#c2410c", blue: "#2f6fa8", teal: "#2287a3", green: "#5f8f3a", amber: "#d08a12", gray: "#7b8592", ink: "#16202c", rose: "#e58a5b" };
  const zip = (xs, ys, es) => xs.map((x, i) => [x, ys[i], es ? es[i] : undefined]);
  const H2M = 20.7355; // hbar^2/2m [MeV fm^2]
  const kF = (rho) => Math.cbrt(3 * Math.PI * Math.PI * rho);

  // ---- small UI helpers --------------------------------------------------
  function controls(fig) {
    const c = document.createElement("div");
    c.className = "fig-controls";
    fig.prepend(c);
    return c;
  }
  function seg(parent, items, value, onChange, label) {
    const g = document.createElement("div");
    g.className = "seg"; g.setAttribute("role", "tablist");
    if (label) g.setAttribute("aria-label", label);
    const set = (v) => g.querySelectorAll("button").forEach((b) => { const on = b.dataset.v === v; b.classList.toggle("on", on); b.setAttribute("aria-selected", on); });
    for (const [v, text] of items) {
      const b = document.createElement("button");
      b.type = "button"; b.dataset.v = v; b.innerHTML = text; b.setAttribute("role", "tab");
      b.addEventListener("click", () => { set(v); onChange(v); });
      g.append(b);
    }
    set(value);
    parent.append(g);
    return { el: g, set };
  }
  function slider(parent, label, { min, max, step, value, fmt }, onInput) {
    const w = document.createElement("label");
    w.className = "fig-slider";
    w.innerHTML = `<span>${label} = <output>${fmt(value)}</output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}">`;
    const inp = w.querySelector("input"), out = w.querySelector("output");
    inp.addEventListener("input", () => { out.textContent = fmt(+inp.value); onInput(+inp.value); });
    parent.append(w);
    return w;
  }
  const chartBox = (fig) => {
    const d = document.createElement("div");
    const c = fig.querySelector(".fig-controls");
    if (c) c.after(d); else fig.prepend(d);
    return d;
  };

  const FIGS = {};

  // ---- thesis ------------------------------------------------------------
  FIGS["thesis-eos"] = (fig) => {
    const T = D.thesis, ctl = controls(fig), box = chartBox(fig);
    let mode = "E", sel = 0.5;
    const labels = { E: "E/A [MeV]", T: "T/A [MeV]", V: "V/A [MeV]" };
    const build = () => {
      if (mode === "bench") {
        const B = T.bench;
        return {
          x: { label: "ρ  [fm⁻³]", name: "ρ", min: 0.08, max: 0.4 }, y: { label: "E/A [MeV]", name: "E/A", min: 0, max: 50 },
          refs: [{ axis: "x", value: 0.17, label: "ρ₀" }],
          series: [
            { name: "This work (BHF)", color: C.orange, data: zip(T.rho, T.E[0]), line: false, markers: true, r: 3.6 },
            { name: "Logoteta et al. [BHF]", color: C.navy, data: B["Logoteta et al. [BHF]"], width: 1.6 },
            { name: "Piarulli et al. [BHF]", color: C.teal, data: B["Piarulli et al. [BHF]"], markers: true, r: 2.6 },
            { name: "Lovato et al. [BHF + 3N]", color: C.amber, data: B["Lovato et al. [BHF + 3N]"], dash: "5 4", markers: true, r: 2.6 },
          ],
        };
      }
      const arr = T[mode];
      return {
        x: { label: "ρ  [fm⁻³]", name: "ρ", min: 0.09, max: 0.38 }, y: { label: labels[mode], name: mode + "/A" },
        refs: [{ axis: "x", value: 0.17, label: "ρ₀" }].concat(mode === "V" ? [{ axis: "y", value: 0, dash: false }] : []),
        legend: false,
        series: T.delta.map((d, i) => {
          const on = Math.abs(d - sel) < 1e-6;
          return { id: "d" + i, name: `Δ = ${d.toFixed(1)}`, color: seq(d), data: zip(T.rho, arr[i]), width: on ? 2.8 : 1.3, opacity: on ? 1 : 0.4, markers: on, r: 2.6 };
        }).sort((a, b) => a.width - b.width),
      };
    };
    const chart = Chart(box, { height: 360, aria: "Energy per particle of spin-polarized neutron matter", file: "thesis-energy-per-particle", ...build() });
    const sl = slider(ctl, "Δ", { min: 0, max: 1, step: 0.1, value: sel, fmt: (v) => v.toFixed(1) }, (v) => { sel = v; chart.update(build()); });
    seg(ctl, [["E", "E/A"], ["T", "T/A"], ["V", "V/A"], ["bench", "Δ = 0 vs literature"]], mode, (v) => {
      mode = v; sl.style.display = v === "bench" ? "none" : ""; chart.update(build());
    }, "Quantity");
    ctl.prepend(ctl.lastChild);
  };

  FIGS["thesis-chi"] = (fig) => {
    const T = D.thesis, R = T.chiRefs;
    Chart(chartBox(fig), {
      height: 340, aria: "Magnetic susceptibility ratio versus density", file: "thesis-susceptibility",
      x: { label: "ρ  [fm⁻³]", name: "ρ", min: 0.09, max: 0.4 }, y: { label: "χ / χ_F", name: "χ/χ_F", min: 0.3, max: 0.5 },
      refs: [{ axis: "x", value: 0.17, label: "ρ₀" }],
      series: [
        { name: "This work [NV2-Ib]", color: C.orange, data: zip(T.rho, T.chi), markers: true, r: 3, width: 2.2 },
        { name: "This work, E_F/3S", color: C.orange, data: zip(T.rho, T.chiEF3S), dash: "5 4", width: 1.4 },
        { name: "Bombaci et al. [AV18]", color: C.ink, data: R["Bombaci et al. [AV18]"], width: 1.5 },
        { name: "Vidaña et al. [Nijmegen II]", color: C.blue, data: R["Vidaña et al. [Nijmegen II]"], width: 1.5 },
        { name: "Vidaña et al. [Reid93]", color: C.green, data: R["Vidaña et al. [Reid93]"], dash: "5 4", width: 1.5 },
      ],
    });
  };

  FIGS["thesis-waves"] = (fig) => {
    const W = D.thesis.waves, ctl = controls(fig), box = chartBox(fig);
    const col = { "3P1": C.navy, "1S0": C.orange, "3P2": C.blue, "1D2": C.rose, "3P0": C.gray, "3F3": C.gray };
    const lab = (k) => k.replace(/^(\d)([A-Z])(\d)$/, (_, s, l, j) => `${s === "1" ? "¹" : "³"}${l}${"₀₁₂₃₄"[+j]}`);
    let rho = "0.170";
    const build = () => ({
      x: { label: "spin polarization Δ", name: "Δ", min: 0, max: 1 }, y: { label: "V/A contribution [MeV]", name: "V/A" },
      refs: [{ axis: "y", value: 0, dash: false }],
      series: Object.entries(W[rho]).map(([k, v]) => ({ id: k, name: lab(k), color: col[k], data: zip(D.thesis.delta, v), markers: true, r: 3, dash: k.startsWith("1") ? null : null })),
    });
    const chart = Chart(box, { height: 340, aria: "Partial-wave contributions versus polarization", file: "thesis-partial-waves", ...build() });
    seg(ctl, [["0.170", "ρ = 0.170 fm⁻³ (ρ₀)"], ["0.352", "ρ = 0.352 fm⁻³ (≈ 2ρ₀)"]], rho, (v) => { rho = v; chart.update(build()); }, "Density");
  };

  // ---- NSmatter ----------------------------------------------------------
  FIGS["nsm-eos"] = (fig) => {
    const N = D.nsmatter, T = D.thesis;
    const fg = []; for (let r = 0.01; r <= 0.5001; r += 0.005) fg.push([+r.toFixed(3), 0.6 * H2M * kF(r) ** 2]);
    Chart(chartBox(fig), {
      height: 370, aria: "VMC energy per neutron versus density for the Norfolk models", file: "nsmatter-eos",
      x: { label: "ρ  [fm⁻³]", name: "ρ", min: 0, max: 0.5 }, y: { label: "E/N [MeV]", name: "E/N", min: 0, max: 112 },
      refs: [{ axis: "x", value: 0.16, label: "ρ₀" }],
      series: [
        { name: "NV2+3-Ia*", color: C.blue, data: N.eosIa, markers: true, r: 3.4, width: 1.3 },
        { name: "NV2+3-Ib*", color: C.orange, data: N.eos3N, markers: true, r: 3.4, width: 1.3 },
        { name: "NV2+3-IIb*", color: C.green, data: N.eosIIb, markers: true, r: 3.4, width: 1.3 },
        { name: "NV2-Ib (two-body only)", color: C.navy, data: N.eos2N, markers: true, r: 3, width: 1.1, dash: "4 3" },
        { name: "NV2+3-Ib*, spin-orbit corr.", color: C.amber, data: N.eosLS, line: false, markers: true, shape: "diamond", r: 4.2 },
        { name: "BHF, NV2-Ib (thesis)", color: C.teal, data: zip(T.rho, T.E[0]).filter((p) => p[0] <= 0.5), width: 1.6 },
        { name: "free Fermi gas", color: C.gray, data: fg, dash: "2 4", width: 1.4, hover: false, csv: false },
      ],
    });
  };

  FIGS["nsm-decomp"] = (fig) => {
    const G = D.nsmatter.groups, rhos = ["0.04", "0.08", "0.12", "0.16", "0.20", "0.24"];
    const keys = [["kinetic", C.navy], ["potential", C.orange], ["central", C.blue], ["quadratic", C.amber], ["tensor", C.teal], ["spin-orbit", C.green], ["charge-dependent", C.gray]];
    Chart(chartBox(fig), {
      height: 350, aria: "Energy decomposition versus density", file: "nsmatter-energy-decomposition",
      x: { label: "ρ  [fm⁻³]", name: "ρ", min: 0.02, max: 0.26 }, y: { label: "energy per neutron [MeV]", name: "E/N" },
      refs: [{ axis: "y", value: 0, dash: false }],
      series: keys.map(([k, c]) => ({ name: k, color: c, data: rhos.map((r) => [+r, G[r][k][0], G[r][k][1]]), markers: true, r: 3 })),
    });
  };

  FIGS["nsm-structure"] = (fig) => {
    const S = D.nsmatter.structure, ctl = controls(fig), box = chartBox(fig);
    const rhos = Object.keys(S);
    let q = "g", scale = "r";
    const fgG = []; for (let x = 0.05; x <= 6; x += 0.05) { const j1 = (Math.sin(x) - x * Math.cos(x)) / (x * x); fgG.push([x, 1 - 0.5 * (3 * j1 / x) ** 2]); }
    const build = () => {
      const series = rhos.map((r, i) => {
        // in k_F r units, g is normalised by N/(N-1) (N = 14) as in the report, to compare with the free gas
        const s = S[r], k = scale === "kf" ? kF(+r) : 1, nn = scale === "kf" && q === "g" ? 14 / 13 : 1;
        const ys = q === "g" ? s.g.map((v) => +(v * nn).toFixed(3)) : s.cs, es = q === "g" ? s.ge : null;
        return { id: r, name: `ρ = ${r}`, color: seq(i / (rhos.length - 1)), data: zip(s.r.map((x) => +(x * k).toFixed(3)), ys, es).filter((p) => p[1] != null), width: 1.7, errors: false };
      });
      if (q === "g" && scale === "kf") series.push({ id: "fg", name: "free Fermi gas", color: C.gray, data: fgG, dash: "4 4", width: 1.4, hover: false, csv: false });
      return {
        x: scale === "kf" ? { label: "k_F r", name: "k_F r", min: 0, max: 4 } : { label: "r  [fm]", name: "r", min: 0, max: 3.5 },
        y: q === "g" ? { label: scale === "kf" ? "g_{nn} · N/(N−1)" : "g_{nn}(r)", name: "g", min: 0, max: 1.15 } : { label: "⟨σᵢ · σⱼ⟩(r)", name: "⟨σ·σ⟩", min: -3.5, max: 0.2 },
        refs: q === "g" ? [{ axis: "y", value: 1, label: "uncorrelated" }] : [{ axis: "y", value: -3, label: "spin singlet" }, { axis: "y", value: 0, dash: false }],
        series,
      };
    };
    const chart = Chart(box, { height: 350, aria: "Pair distribution and spin correlation of neutron matter", file: "nsmatter-structure", ...build() });
    seg(ctl, [["g", "pair distribution g(r)"], ["cs", "spin correlation"]], q, (v) => { q = v; chart.update(build()); }, "Quantity");
    seg(ctl, [["r", "r [fm]"], ["kf", "k<sub>F</sub> r"]], scale, (v) => { scale = v; chart.update(build()); }, "Scale");
  };

  // ---- labs --------------------------------------------------------------
  FIGS["ising"] = (fig) => {
    const I = D.ising, ctl = controls(fig), box = chartBox(fig);
    const Ls = Object.keys(I.chiPrime).map(Number);
    const bc = 0.440687, nu = 1, gn = 1.75;
    let q = "chi", fss = false;
    const build = () => {
      const src = q === "chi" ? I.chiPrime : I.binder;
      const series = Ls.map((L, i) => ({
        id: "L" + L, name: `L = ${L}`, color: seq(i / (Ls.length - 1)), markers: true, r: 2.3, width: 0.9,
        data: src[L].map(([b, y, e]) => fss
          ? [(b - bc) * Math.pow(L, 1 / nu), q === "chi" ? y / Math.pow(L, gn) : y, q === "chi" ? e / Math.pow(L, gn) : e]
          : [b, y, e]),
      }));
      const x = fss ? { label: "(β − β_c) L^{1/ν}", name: "x", min: -1.2, max: 1.2 } : { label: "β", name: "β", min: 0.42, max: 0.46 };
      const y = q === "chi"
        ? (fss ? { label: "χ′ / L^{γ/ν}", name: "χ′/L^{γ/ν}", min: 0, max: 0.12 } : { label: "χ′ = L²(⟨m²⟩ − ⟨|m|⟩²)", name: "χ′", min: 0 })
        : { label: "U = ⟨m⁴⟩ / ⟨m²⟩²", name: "U", min: 1, max: 2.5 };
      const refs = fss ? [{ axis: "x", value: 0, label: "β = β_c" }] : [{ axis: "x", value: bc, label: "β_c (Onsager)" }];
      return { x, y, refs, series };
    };
    const chart = Chart(box, { height: 360, aria: "2D Ising model observables", file: "ising-2d", ...build() });
    seg(ctl, [["chi", "susceptibility χ′"], ["U", "Binder cumulant"]], q, (v) => { q = v; chart.update(build()); }, "Observable");
    seg(ctl, [["raw", "raw data"], ["fss", "finite-size scaling"]], "raw", (v) => { fss = v === "fss"; chart.update(build()); }, "View");
  };

  FIGS["circle"] = (fig) => {
    const P = D.circle, ctl = controls(fig), box = chartBox(fig);
    let q = "high";
    const pred = []; for (let b = 0.15; b <= 0.5; b += 0.005) pred.push([+b.toFixed(3), 2 * Math.exp(-1 / (2 * b))]);
    const build = () => {
      if (q === "high") return {
        x: { label: "β′ = βħ² / 4π²mR²", name: "β′", min: 0.1, max: 2.05 }, y: { label: "⟨Q²⟩", name: "⟨Q²⟩", min: 0, max: 1.3 },
        series: [
          { name: "⟨Q²⟩, N_t = 20", color: C.orange, data: P.highT, line: false, markers: true, r: 3.2 },
          { name: "high-T limit 2e^{−1/2β′}", color: C.navy, data: pred, dash: "5 4", width: 1.5, hover: false, csv: false },
        ],
      };
      if (q === "low") return {
        x: { label: "η² (squared lattice spacing)", name: "η²", min: 0, max: 0.0068, dec: 3 }, y: { label: "⟨Q²⟩", name: "⟨Q²⟩", min: 1.3, max: 2.1 },
        refs: [{ axis: "y", value: 2, label: "continuum: ⟨Q²⟩ = 2" }],
        series: [{ name: "⟨Q²⟩, β′ = 2", color: C.orange, data: P.lowT, line: false, markers: true, r: 3.4 }],
      };
      return {
        x: { label: "N_t (Euclidean time slices)", name: "N_t", min: 0, max: 340, tipFmt: (v) => Math.round(v) }, y: { label: "statistical error of ⟨Q²⟩", name: "σ", log: true, min: 5e-5, max: 2e-2 },
        series: [{ name: "error, β′ = 2", color: C.navy, data: P.lowTerr, markers: true, r: 3.4, width: 1 }],
      };
    };
    const chart = Chart(box, { height: 340, aria: "Winding number of a quantum particle on a circle", file: "particle-on-circle", ...build() });
    seg(ctl, [["high", "high-T scan"], ["low", "continuum limit"], ["err", "topological freezing"]], q, (v) => { q = v; chart.update(build()); }, "Panel");
  };

  FIGS["scalar"] = (fig) => {
    const S = D.scalar, ctl = controls(fig), box = chartBox(fig);
    const cols = { 4: C.navy, 6: C.teal, 8: C.orange };
    let q = "eps";
    const build = () => ({
      x: { label: "T / m", name: "T/m", min: 0, max: 2.6 },
      y: q === "eps" ? { label: "ε / T²", name: "ε/T²", min: 0, max: 0.56 } : { label: "(ε − P) / T²", name: "(ε−P)/T²", min: 0, max: 0.21 },
      refs: q === "eps" ? [{ axis: "y", value: Math.PI / 6, label: "π/6 (massless limit)" }] : [],
      series: Object.entries(S[q === "eps" ? "eps" : "trace"]).map(([nt, d]) => ({ id: nt, name: `N_t = ${nt}`, color: cols[nt], data: d, markers: true, r: 2.8, width: 1.2 })),
    });
    const chart = Chart(box, { height: 340, aria: "Thermodynamics of the free scalar field", file: "free-scalar-field", ...build() });
    seg(ctl, [["eps", "energy density"], ["trace", "trace anomaly"]], q, (v) => { q = v; chart.update(build()); }, "Observable");
  };

  window.mountFigures = (root) => {
    root.querySelectorAll("[data-figure]").forEach((f) => {
      const fn = FIGS[f.dataset.figure];
      if (fn && !f.dataset.mounted) { f.dataset.mounted = "1"; try { fn(f); } catch (e) { console.error(e); } }
    });
  };
})();
