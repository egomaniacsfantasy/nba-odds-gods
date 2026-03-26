(function () {
  "use strict";

  // === PRNG (Mulberry32) for deterministic layout ===
  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function sizeCanvas(canvas) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
  }

  // === FLOATING STATS ===
  function paintStats() {
    const canvas = document.getElementById("bg-stats");
    if (!canvas) return;
    const { ctx, w, h } = sizeCanvas(canvas);
    const rng = mulberry32(42);

    const stats = [
      // NBA stats
      "NET RTG +8.4", "112.6 ORTG", "103.2 DRTG", "BPM +6.2",
      "eFG% 58.4", "TS% 62.1", "OREB% 28.4", "3PA .412",
      "PACE 98.6", "AST% 64.2", "TOV% 12.8", "REB% 52.4",
      "ELO 1724", "SRS +7.8", "MOV +6.1", "SOS .524",
      "W58-L24", "W47-L35", "W62-L20", "W51-L31",
      // Odds
      "+1400", "+240", "-350", "+650", "-180", "+1100",
      "-420", "+310", "-160", "+2200", "-550", "+480",
      "52.4%", "78.2%", "14.6%", "33.1%", "91.8%", "6.2%",
      // Roman numerals
      "XIV", "XLVIII", "IX", "MMXXVI", "XCIX", "IV", "LXIII",
      "LVII", "XXXII", "XVI", "XLII", "LI", "VII",
      // Greek
      "Σ", "Δ", "μ", "σ", "π", "Ω", "β", "λ", "φ", "θ",
      // Latin
      "ALEA IACTA EST", "PROBABILITAS", "FORTES FORTUNA",
      "FATA VIAM INVENIENT", "RATIO", "FORTUNA AUDACES IUVAT",
    ];

    const placed = [];
    const count = prefersReducedMotion ? 30 : Math.floor(80 + rng() * 40);
    // Exclude top-left corner (nav area)
    const exclusion = [{ x: 0, y: 0, x2: 350, y2: 70 }];

    let attempts = 0;
    let painted = 0;

    while (painted < count && attempts < count * 8) {
      attempts++;
      const txt = stats[Math.floor(rng() * stats.length)];
      const isGreek = /^[Σ-ω]$/u.test(txt) || "ΣΔμσπΩβλφθ".includes(txt);
      const isRoman = /^[IVXLCDM]+$/.test(txt);
      const isLatin = txt.length > 8 && /^[A-Z\s]+$/.test(txt);

      const serif = isGreek || isRoman || isLatin;
      const size = isGreek ? 28 + Math.floor(rng() * 10) : 13 + Math.floor(rng() * 6);
      const alpha = isGreek ? 0.012 + rng() * 0.015 : 0.01 + rng() * 0.015;

      ctx.font = serif
        ? `400 ${size}px "Instrument Serif", serif`
        : `400 ${size}px "Space Grotesk", sans-serif`;

      const tw = ctx.measureText(txt).width;
      const th = size * 1.3;
      const x = rng() * (w - tw - 20) + 10;
      const y = rng() * (h - th - 20) + 10;
      const box = { x: x - 6, y: y - 4, x2: x + tw + 6, y2: y + th + 4 };

      // Check exclusion zones
      const blocked = exclusion.some(
        (z) => box.x < z.x2 && box.x2 > z.x && box.y < z.y2 && box.y2 > z.y
      );
      if (blocked) continue;

      // Check overlap with placed items
      const overlaps = placed.some(
        (p) => box.x < p.x2 && box.x2 > p.x && box.y < p.y2 && box.y2 > p.y
      );
      if (overlaps) continue;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#f0e6d0";
      ctx.textAlign = "left";
      ctx.fillText(txt, x, y + th * 0.8);
      placed.push(box);
      painted++;
    }

    ctx.globalAlpha = 1;
  }

  // === LIGHTNING BOLT ===
  function paintLightning() {
    if (prefersReducedMotion) return;
    const canvas = document.getElementById("bg-lightning");
    if (!canvas) return;
    const { ctx, w, h } = sizeCanvas(canvas);
    const rng = mulberry32(777);

    function genBolt(x1, y1, x2, y2, segments, jitter) {
      const points = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const jx = i > 0 && i < segments ? (rng() - 0.5) * jitter * 2 : 0;
        const jy = i > 0 && i < segments ? (rng() - 0.5) * jitter * 2 : 0;
        points.push([x1 + (x2 - x1) * t + jx, y1 + (y2 - y1) * t + jy]);
      }
      return points;
    }

    function drawBolt(points, color, lineWidth) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i][0], points[i][1]);
      }
      ctx.stroke();
    }

    // Main bolt — top-right area to center-right
    const bolt = genBolt(w * 0.82, h * 0.03, w * 0.56, h * 0.72, 58, 5);

    // Branch off main bolt at ~35%
    const mid = bolt[Math.floor(bolt.length * 0.35)];
    const branch = genBolt(
      mid[0], mid[1],
      mid[0] + 80 + rng() * 55, mid[1] + 60 + rng() * 45,
      28, 3
    );

    // Draw main bolt — 5 passes from outer glow to bright core
    drawBolt(bolt, "rgba(184,125,24,0.020)", 20);
    drawBolt(bolt, "rgba(184,125,24,0.036)", 12);
    drawBolt(bolt, "rgba(184,125,24,0.055)", 6);
    drawBolt(bolt, "rgba(184,125,24,0.044)", 3);
    drawBolt(bolt, "rgba(240,230,208,0.070)", 1);

    // Draw branch — 2 passes
    drawBolt(branch, "rgba(184,125,24,0.026)", 5);
    drawBolt(branch, "rgba(184,125,24,0.040)", 2);
  }

  // === PAINT ALL ===
  function paintAll() {
    paintStats();
    paintLightning();
  }

  // === INIT ===
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", paintAll);
  } else {
    paintAll();
  }

  // Repaint on resize (debounced)
  let resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(paintAll, 500);
  });
})();
