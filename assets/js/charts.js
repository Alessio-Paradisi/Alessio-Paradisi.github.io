/* Minimal interactive SVG charts in the site's style.
   Chart(el, opts) renders into `el` and returns { update(partialOpts) }.
   opts = {
     x: { label, name, min, max, log, ticks, fmt },  y: { … },
     series: [{ id, name, color, data: [[x, y, err?], …], line = true, markers = false,
                dash, width = 1.8, r = 3.2, opacity = 1, legend = true, hover = true }],
     refs:   [{ axis: "x" | "y", value, label, dash = true }],
     legend: true, height: 360
   } */
(() => {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };
  const INK = "#16202c", INK3 = "#7b8592", RULE = "rgba(22,32,44,.09)";

  // tiny TeX-like markup for labels: x_F, x_{nn}, L^{γ/ν}
  const TOK = /([_^])(\{[^}]*\}|[^\s{}()/,=])/g;
  const parts = (s) => {
    const out = []; let last = 0, m;
    TOK.lastIndex = 0;
    while ((m = TOK.exec(s))) {
      if (m.index > last) out.push([s.slice(last, m.index), ""]);
      out.push([m[2].replace(/^\{|\}$/g, ""), m[1] === "_" ? "sub" : "sup"]);
      last = TOK.lastIndex;
    }
    if (last < s.length) out.push([s.slice(last), ""]);
    return out;
  };
  const richHTML = (s) => parts(String(s)).map(([t, k]) => {
    const e = t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    return k ? `<${k}>${e}</${k}>` : e;
  }).join("");
  const richSVG = (textEl, s) => {
    for (const [t, k] of parts(String(s))) {
      const ts = document.createElementNS(NS, "tspan");
      ts.textContent = t;
      if (k) { ts.setAttribute("baseline-shift", k === "sub" ? "sub" : "super"); ts.setAttribute("font-size", "72%"); }
      textEl.append(ts);
    }
    return textEl;
  };

  function niceTicks(min, max, n = 5) {
    const span = max - min || 1;
    const raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    const step = (f >= 7.5 ? 10 : f >= 3.5 ? 5 : f >= 1.5 ? 2 : 1) * mag;
    const out = [];
    for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(+v.toPrecision(12));
    return { ticks: out, step };
  }
  const decimals = (step) => Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  const sup = (n) => String(n).replace(/-/g, "−").replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]);

  function extent(series, k, log) {
    let lo = Infinity, hi = -Infinity;
    for (const s of series) for (const p of s.data) {
      const v = p[k], e = k === 1 && p[2] ? p[2] : 0;
      if (v == null || !isFinite(v) || (log && v <= 0)) continue;
      lo = Math.min(lo, v - e); hi = Math.max(hi, v + e);
    }
    return [lo, hi];
  }

  function Chart(root, opts) {
    root.classList.add("chart-wrap");
    root.innerHTML = "";
    const svgBox = document.createElement("div");
    svgBox.className = "chart-svgbox";
    const tip = document.createElement("div");
    tip.className = "chart-tip";
    const legend = document.createElement("div");
    legend.className = "chart-legend";
    svgBox.append(tip);
    root.append(svgBox, legend);
    const hidden = new Set();
    let o = opts, svg = null, geom = null;

    function render() {
      // draw at the real on-screen width (capped) so text keeps its size on phones
      const cw = root.clientWidth || 640;
      const W = Math.round(Math.max(300, Math.min(640, cw)));
      const H = Math.round((o.height || 360) * Math.max(0.8, W / 640));
      const narrow = W < 480;
      const m = { l: narrow ? 48 : 58, r: narrow ? 10 : 18, t: 16, b: 50, ...(o.margin || {}) };
      const vis = o.series.filter((s) => !hidden.has(s.id ?? s.name));
      // domains
      const ax = (a, k, len) => {
        let [lo, hi] = a.min != null && a.max != null ? [a.min, a.max] : extent(vis.length ? vis : o.series, k, a.log);
        if (a.min != null) lo = a.min; if (a.max != null) hi = a.max;
        if (!a.log && (a.min == null || a.max == null)) { const pad = (hi - lo || 1) * 0.06; if (a.min == null) lo -= pad; if (a.max == null) hi += pad; }
        if (a.log) { lo = a.min ?? Math.pow(10, Math.floor(Math.log10(lo))); hi = a.max ?? Math.pow(10, Math.ceil(Math.log10(hi))); }
        const f = a.log
          ? (v) => (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) * len
          : (v) => (v - lo) / (hi - lo) * len;
        return { lo, hi, f };
      };
      const xa = ax(o.x, 0, W - m.l - m.r), ya = ax(o.y, 1, H - m.t - m.b);
      const X = (v) => m.l + xa.f(v), Y = (v) => H - m.b - ya.f(v);
      geom = { X, Y, m, W, H, xa, ya };

      const s = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart-svg", role: "img", "aria-label": o.aria || "" });
      const defs = el("defs");
      const clipId = "c" + Math.random().toString(36).slice(2, 8);
      const cp = el("clipPath", { id: clipId });
      cp.append(el("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b }));
      defs.append(cp); s.append(defs);

      // grid + ticks
      const g = el("g", { class: "axes" });
      const mkTicks = (a, axis) => {
        if (a.log) {
          const out = []; for (let e = Math.ceil(Math.log10(axis.lo)); e <= Math.floor(Math.log10(axis.hi)); e++) out.push(Math.pow(10, e));
          return { ticks: out, fmt: (v) => "10" + sup(Math.round(Math.log10(v))) };
        }
        const t = a.ticks ? { ticks: a.ticks, step: a.ticks[1] - a.ticks[0] } : niceTicks(axis.lo, axis.hi, a.n || (narrow ? 4 : 5));
        const d = a.dec ?? decimals(t.step);
        return { ticks: t.ticks.filter((v) => v >= axis.lo - 1e-9 && v <= axis.hi + 1e-9), fmt: a.fmt || ((v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(d)) };
      };
      const xt = mkTicks(o.x, xa), yt = mkTicks(o.y, ya);
      for (const v of yt.ticks) {
        g.append(el("line", { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: RULE }));
        g.append(el("text", { x: m.l - 8, y: Y(v) + 4, "text-anchor": "end", class: "tick" }, yt.fmt(v)));
      }
      for (const v of xt.ticks) {
        g.append(el("line", { x1: X(v), x2: X(v), y1: H - m.b, y2: H - m.b + 5, stroke: INK3 }));
        g.append(el("text", { x: X(v), y: H - m.b + 19, "text-anchor": "middle", class: "tick" }, xt.fmt(v)));
      }
      g.append(el("line", { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, stroke: INK, "stroke-width": 1 }));
      g.append(richSVG(el("text", { x: (m.l + W - m.r) / 2, y: H - 8, "text-anchor": "middle", class: "axis-title" }), o.x.label));
      g.append(richSVG(el("text", { x: 16, y: (m.t + H - m.b) / 2, "text-anchor": "middle", class: "axis-title", transform: `rotate(-90 16 ${(m.t + H - m.b) / 2})` }), o.y.label));
      s.append(g);

      // reference lines
      const plot = el("g", { "clip-path": `url(#${clipId})` });
      for (const r of o.refs || []) {
        const isX = r.axis === "x";
        const p = isX ? { x1: X(r.value), x2: X(r.value), y1: m.t, y2: H - m.b } : { x1: m.l, x2: W - m.r, y1: Y(r.value), y2: Y(r.value) };
        plot.append(el("line", { ...p, stroke: r.color || INK3, "stroke-dasharray": r.dash === false ? null : "4 4", "stroke-width": 1 }));
        if (r.label) plot.append(richSVG(el("text", { x: isX ? X(r.value) + 5 : W - m.r - 6, y: isX ? m.t + 12 : Y(r.value) - 6, "text-anchor": isX ? "start" : "end", class: "ref-label" }), r.label));
      }

      // series
      for (const se of vis) {
        const gs = el("g", { class: "series", opacity: se.opacity ?? 1 });
        const pts = se.data.filter((p) => p[1] != null && isFinite(p[1]) && (!o.y.log || p[1] > 0));
        if (se.band) {
          const up = pts.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1] + (p[2] || 0)).toFixed(1)}`);
          const dn = pts.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1] - (p[2] || 0)).toFixed(1)}`).reverse();
          gs.append(el("polygon", { points: up.concat(dn).join(" "), fill: se.color, opacity: 0.16 }));
        }
        if (se.line !== false && pts.length > 1) {
          gs.append(el("polyline", {
            points: pts.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" "),
            fill: "none", stroke: se.color, "stroke-width": se.width || 1.8, "stroke-dasharray": se.dash || null,
            "stroke-linejoin": "round", "stroke-linecap": "round",
          }));
        }
        if (se.errors !== false && !se.band) for (const p of pts) if (p[2]) {
          gs.append(el("line", { x1: X(p[0]), x2: X(p[0]), y1: Y(p[1] - p[2]), y2: Y(p[1] + p[2]), stroke: se.color, "stroke-width": 1.2, opacity: 0.8 }));
        }
        if (se.markers) for (const p of pts) {
          if (se.shape === "diamond") {
            const x = X(p[0]), y = Y(p[1]), r = (se.r || 3.2) + 1.4;
            gs.append(el("path", { d: `M${x},${y - r}L${x + r},${y}L${x},${y + r}L${x - r},${y}Z`, fill: se.color }));
          } else {
            gs.append(el("circle", { cx: X(p[0]), cy: Y(p[1]), r: se.r || 3.2, fill: se.hollow ? "#fff" : se.color, stroke: se.color, "stroke-width": se.hollow ? 1.4 : 0 }));
          }
        }
        plot.append(gs);
      }
      s.append(plot);

      // hover layer
      const cross = el("line", { y1: m.t, y2: H - m.b, stroke: INK3, "stroke-width": 0.8, opacity: 0, "stroke-dasharray": "2 3" });
      const dot = el("circle", { r: 5, fill: "none", stroke: INK, "stroke-width": 1.5, opacity: 0 });
      const hit = el("rect", { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: "transparent" });
      s.append(cross, dot, hit);
      const fx = o.x.tipFmt || ((v) => +v.toPrecision(4)), fy = o.y.tipFmt || ((v) => +v.toPrecision(4));
      const move = (ev) => {
        const r = s.getBoundingClientRect(), sx = W / r.width;
        const px = (ev.clientX - r.left) * sx, py = (ev.clientY - r.top) * sx;
        let best = null, bd = Infinity;
        for (const se of vis) {
          if (se.hover === false) continue;
          for (const p of se.data) {
            if (p[1] == null || !isFinite(p[1]) || (o.y.log && p[1] <= 0)) continue;
            const dx = X(p[0]) - px, dy = Y(p[1]) - py, d = dx * dx + dy * dy * 0.6;
            if (d < bd) { bd = d; best = { se, p }; }
          }
        }
        if (!best || bd > 4200) { leave(); return; }
        const { se, p } = best, cx = X(p[0]), cy = Y(p[1]);
        cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("opacity", 1);
        dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("stroke", se.color); dot.setAttribute("opacity", 1);
        tip.innerHTML = `<span class="tip-dot" style="background:${se.color}"></span><strong>${richHTML(se.name)}</strong><br>` +
          `${richHTML(o.x.name || "x")} = ${fx(p[0])}<br>${richHTML(o.y.name || "y")} = ${fy(p[1])}${p[2] ? " ± " + fy(p[2]) : ""}`;
        tip.style.opacity = 1;
        const left = cx / sx, top = cy / sx;
        tip.style.left = Math.min(Math.max(left, 70), r.width - 70) + "px";
        tip.style.top = top + "px";
        tip.classList.toggle("below", top < 70);
      };
      const leave = () => { cross.setAttribute("opacity", 0); dot.setAttribute("opacity", 0); tip.style.opacity = 0; };
      hit.addEventListener("pointermove", move);
      hit.addEventListener("pointerdown", move);
      hit.addEventListener("pointerleave", leave);

      if (svg) svg.replaceWith(s); else svgBox.prepend(s);
      svg = s;
      renderLegend();
    }

    function renderLegend() {
      legend.innerHTML = "";
      if (o.legend === false) { appendCsv(); return; }
      for (const se of o.series) {
        if (se.legend === false) continue;
        const id = se.id ?? se.name;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (hidden.has(id) ? " off" : "");
        b.setAttribute("aria-pressed", String(!hidden.has(id)));
        b.innerHTML = `<span class="sw" style="background:${se.color}${se.dash ? ";background:repeating-linear-gradient(90deg," + se.color + " 0 4px,transparent 4px 7px)" : ""}"></span>${richHTML(se.name)}`;
        b.addEventListener("click", () => { hidden.has(id) ? hidden.delete(id) : hidden.add(id); render(); });
        legend.append(b);
      }
      appendCsv();
    }

    // "CSV" button: exports the visible series (computed reference curves excluded via csv:false)
    function appendCsv() {
      if (o.csv === false) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = "csv-btn";
      b.title = "Download the plotted data as CSV";
      b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14"/></svg>CSV`;
      b.addEventListener("click", () => {
        const plain = (s) => String(s).replace(/[_^]\{([^}]*)\}/g, "$1").replace(/[_^]/g, "").replace(/"/g, "'");
        const rows = [["series", plain(o.x.label), plain(o.y.label), "error"]];
        for (const se of o.series) {
          if (hidden.has(se.id ?? se.name) || se.csv === false) continue;
          for (const p of se.data) if (p[1] != null) rows.push([plain(se.name), p[0], p[1], p[2] ?? ""]);
        }
        const csv = rows.map((r) => r.map((v) => (typeof v === "string" ? `"${v}"` : v)).join(",")).join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
        a.download = (o.file || "data") + ".csv";
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
      legend.append(b);
    }

    render();
    // redraw when the available width changes (rotation, drawer resize)
    let lastW = root.clientWidth, rt = 0;
    if ("ResizeObserver" in window) new ResizeObserver(() => {
      const w = root.clientWidth;
      if (Math.abs(w - lastW) < 8) return;
      lastW = w; clearTimeout(rt); rt = setTimeout(render, 80);
    }).observe(root);
    return { update(p) { o = { ...o, ...p }; render(); }, get opts() { return o; } };
  }

  // colour helpers shared by the figures
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => "#" + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, "0")).join("");
  // sequential palette navy -> teal -> amber -> orange (same family as the thesis figures)
  const SEQ = ["#0b2a4a", "#1359a8", "#2287a3", "#7b9d5a", "#eb8b0b", "#c2410c"];
  const seq = (t) => {
    const k = Math.min(SEQ.length - 2, Math.floor(t * (SEQ.length - 1)));
    return mix(SEQ[k], SEQ[k + 1], t * (SEQ.length - 1) - k);
  };

  window.SiteCharts = { Chart, seq, mix };
})();
