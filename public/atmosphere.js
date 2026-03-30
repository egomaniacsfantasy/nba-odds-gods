(function () {
  "use strict";

  if (window.__OG_ORACLE_ATMOS_INIT__) {
    return;
  }
  window.__OG_ORACLE_ATMOS_INIT__ = true;

  function setupLightningBackground() {
    const ambientCanvas = document.getElementById("lightning-ambient");
    const textCanvas = document.getElementById("lightning-text");
    const boltCanvas = document.getElementById("lightning-bolts");
    if (
      !(ambientCanvas instanceof HTMLCanvasElement) ||
      !(textCanvas instanceof HTMLCanvasElement) ||
      !(boltCanvas instanceof HTMLCanvasElement)
    ) {
      return;
    }

    const ambientCtx = ambientCanvas.getContext("2d");
    const textCtx = textCanvas.getContext("2d");
    const boltCtx = boltCanvas.getContext("2d");
    if (!ambientCtx || !textCtx || !boltCtx) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = reducedMotionQuery.matches;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let noiseTime = 0;
    let lastTs = 0;
    let running = false;
    let ambientRafId = 0;
    let textRafId = 0;
    let boltRafId = 0;
    let boltTimeoutId = 0;
    let resizeTimeoutId = 0;
    let relayoutTimeoutId = 0;
    const FIXED_SEED = 31337;

    let activeBolt = null;
    let fragments = [];
    let safeZones = [];
    let textNeedsRender = true;
    let illuminationActive = false;

    const categoryPools = {
      odds: [
        "-110", "+3300", "-450", "+220", "-175", "+550", "EVEN", "-3040", "+1400",
        "-800", "+290", "-115", "+6500", "-2200", "+380", "-330", "+4500", "-650",
        "+105", "-190", "+180", "-240", "+3300", "-1800",
      ],
      lines: [
        "BOS ML -350", "OKC -6.5", "CLE +220", "DEN O/U 228.5",
        "NYK -2.5", "LAL ML +145", "MIN +4.0", "PHX O/U 231.5",
        "GSW ML -110", "MIL +170", "DAL +6.5", "ORL ML +210",
        "HOU -4.5", "SAS +280", "DET ML +120", "LAC O/U 224.5",
        "ATL +3.5", "MIA ML -125", "PHI +155", "TOR O/U 219.5",
      ],
      implied: [
        "45.3 WIN%", "61.2% IMP", "28.6% TITLE", "73.4% PLAYOFFS", "19.2% CHAMP",
        "50.0% ML", "88.1% TOP 6", "33.3% CONF", "12.8% FINALS", "67.9% PLAY-IN",
        "7.4% IMP", "94.2% MAKE IT", "22.4% TITLE", "15.1% SEED 1", "8.3% CHAMP",
      ],
      stats: [
        "NET RTG +8.4", "112.6 ORTG", "103.2 DRTG", "BPM +6.2", "eFG% 58.4",
        "TS% 62.1", "OREB% 28.4", "PACE 98.6", "ELO 1724", "SRS +7.8",
        "W58-L24", "W62-L20", "W47-L35", "AST% 64.2", "3PA .412",
        "TOV% 12.8", "REB% 52.4", "MOV +6.1", "SOS .524", "OFF EFF 118.2",
        "DEF EFF 109.1", "22-6 ATS", "14.6% TITLE", "34.1 3P%", "AdjEM +21.8",
      ],
      roman: [
        "XIV", "XLVIII", "IX", "MMXXVI", "XCIX", "IV", "LXIII",
        "LVII", "XXXII", "XVI", "XLII", "LI", "VII", "XCVIII",
        "MMXXIV", "LXVI", "XLIV", "LXXXVIII",
      ],
      greek: ["Σ", "Δ", "μ", "σ", "π", "Ω", "β", "λ", "φ", "θ"],
      latin: [
        "ALEA IACTA EST", "SORS", "EVENTUS", "PROBABILITAS", "CALCULUS", "FATA",
        "FORTES FORTUNA", "FATA VIAM INVENIENT", "SORS IMMANIS", "RATIO", "NUMERUS",
        "VINCULUM", "CASUS", "FORTUNA AUDACES IUVAT",
      ],
    };

    const categoryStyle = {
      greek: { font: "serif", min: 30, max: 38, base: 0.055, maxOpacity: 0.095 },
      odds: { font: "mono", min: 10, max: 16, base: 0.048, maxOpacity: 0.09 },
      roman: { font: "serif", min: 14, max: 34, base: 0.044, maxOpacity: 0.082 },
      implied: { font: "mono", min: 10, max: 14, base: 0.045, maxOpacity: 0.078 },
      lines: { font: "mono", min: 10, max: 14, base: 0.043, maxOpacity: 0.078 },
      stats: { font: "mono", min: 10, max: 13, base: 0.04, maxOpacity: 0.072 },
      latin: { font: "serif", min: 9, max: 15, base: 0.036, maxOpacity: 0.063 },
    };

    function seededRng(seed) {
      let s = seed % 2147483647;
      if (s <= 0) s += 2147483646;
      return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    }

    function hash2d(x, y) {
      const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
      return n - Math.floor(n);
    }

    function smoothstep(v) {
      return v * v * (3 - 2 * v);
    }

    function valueNoise2d(x, y) {
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const xf = x - x0;
      const yf = y - y0;

      const v00 = hash2d(x0, y0);
      const v10 = hash2d(x0 + 1, y0);
      const v01 = hash2d(x0, y0 + 1);
      const v11 = hash2d(x0 + 1, y0 + 1);

      const u = smoothstep(xf);
      const v = smoothstep(yf);
      const xa = v00 * (1 - u) + v10 * u;
      const xb = v01 * (1 - u) + v11 * u;
      return xa * (1 - v) + xb * v;
    }

    function noise2d(x, y) {
      return valueNoise2d(x, y) * 2 - 1;
    }

    function resizeCanvases() {
      dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      width = window.innerWidth;
      height = window.innerHeight;

      [ambientCanvas, textCanvas, boltCanvas].forEach((canvas) => {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      });

      ambientCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      textCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      boltCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      safeZones = buildSafeZones();
      fragments = createFragments();
      textNeedsRender = true;
    }

    function clearBoltLayer() {
      boltCtx.clearRect(0, 0, width, height);
    }

    function clearTextLayer() {
      textCtx.clearRect(0, 0, width, height);
    }

    function buildSafeZones() {
      const selector = [
        ".og-nav",
        ".oracle-hero",
        ".tab-header",
        ".sim-controls",
        ".progress-container",
        ".progress-panel",
        ".bottom-tab-bar",
        ".modal-card",
        ".oracle-reveal-card",
        ".playoff-section__header",
      ].join(", ");
      const zones = [];

      document.querySelectorAll(selector).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        zones.push({
          x: r.left - 16,
          y: r.top - 12,
          w: r.width + 32,
          h: r.height + 24,
        });
      });

      zones.push({ x: -20, y: -20, w: Math.min(width, 250), h: 92 });
      return zones;
    }

    function overlapsAny(rect, occupied) {
      return occupied.some(
        (o) => !(rect.x + rect.w < o.x || o.x + o.w < rect.x || rect.y + rect.h < o.y || o.y + o.h < rect.y),
      );
    }

    function inSafeZone(rect) {
      return safeZones.some(
        (zone) => !(rect.x + rect.w < zone.x || zone.x + zone.w < rect.x || rect.y + rect.h < zone.y || zone.y + zone.h < rect.y),
      );
    }

    function pickBucket(rand) {
      if (rand < 0.24) return "left";
      if (rand < 0.48) return "right";
      if (rand < 0.63) return "top";
      if (rand < 0.78) return "bottom";
      return "middle";
    }

    function pickPointInBucket(bucket, rng) {
      if (bucket === "left") return { x: width * (0 + rng() * 0.13), y: height * rng() };
      if (bucket === "right") return { x: width * (0.87 + rng() * 0.13), y: height * rng() };
      if (bucket === "top") return { x: width * rng(), y: height * (0 + rng() * 0.15) };
      if (bucket === "bottom") return { x: width * rng(), y: height * (0.85 + rng() * 0.15) };
      return { x: width * (0.12 + rng() * 0.76), y: height * (0.12 + rng() * 0.76) };
    }

    function measureFragmentRect(fragment) {
      const fontFamily =
        fragment.fontType === "mono"
          ? '"IBM Plex Mono", "SFMono-Regular", Menlo, monospace'
          : '"Instrument Serif", Georgia, serif';
      textCtx.save();
      textCtx.font = `${fragment.size}px ${fontFamily}`;
      const metrics = textCtx.measureText(fragment.text);
      textCtx.restore();
      const serifSpacing = fragment.fontType === "serif" ? fragment.text.length * fragment.size * 0.18 : 0;
      const widthPx = metrics.width + serifSpacing + 6;
      const heightPx = fragment.size + 4;
      return {
        x: fragment.x - 3,
        y: fragment.y - heightPx + 2,
        w: widthPx + 6,
        h: heightPx + 4,
      };
    }

    function buildCategorySequence(count, rng) {
      const weighted = [
        "odds", "odds", "lines", "lines", "implied", "implied",
        "stats", "stats", "stats", "roman", "greek", "latin",
      ];
      const out = [];
      for (let i = 0; i < count; i += 1) {
        out.push(weighted[Math.floor(rng() * weighted.length)]);
      }
      return out;
    }

    function fragmentCountForViewport() {
      if (width < 768) return 34 + Math.floor((width + height) % 7);
      if (width < 1200) return 64 + Math.floor((width + height) % 12);
      return 92 + Math.floor((width + height) % 17);
    }

    function createFragments() {
      const rng = seededRng(FIXED_SEED + width * 31 + height * 17);
      const count = fragmentCountForViewport();
      const sequence = buildCategorySequence(count, rng);
      const occupied = [];
      const out = [];

      let greekCount = 0;
      let romanLargeCount = 0;
      let latinPhraseCount = 0;

      for (let i = 0; i < sequence.length; i += 1) {
        const category = sequence[i];
        const style = categoryStyle[category];
        if (!style) continue;

        if (category === "greek" && greekCount >= 4) continue;
        if (category === "latin" && latinPhraseCount >= 5) continue;

        for (let attempt = 0; attempt < 220; attempt += 1) {
          const bucket = pickBucket(rng());
          const point = pickPointInBucket(bucket, rng);
          const text = categoryPools[category][Math.floor(rng() * categoryPools[category].length)];
          const size = style.min + rng() * (style.max - style.min);
          const baseOpacity = Math.min(style.maxOpacity, style.base + rng() * 0.028);
          const rotation = -4 + rng() * 8;
          const fragment = {
            category,
            text,
            x: point.x,
            y: point.y,
            size,
            baseOpacity,
            currentOpacity: baseOpacity,
            maxOpacity: style.maxOpacity,
            fontType: style.font,
            rotation,
            litUntil: 0,
          };

          const rect = measureFragmentRect(fragment);
          if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > width || rect.y + rect.h > height) continue;
          if (inSafeZone(rect) || overlapsAny(rect, occupied)) continue;

          occupied.push(rect);
          out.push(fragment);

          if (category === "greek") greekCount += 1;
          if (category === "latin" && /\s/.test(text)) latinPhraseCount += 1;
          if (category === "roman" && size >= 30) romanLargeCount += 1;
          if (category === "roman" && romanLargeCount > 4) {
            out.pop();
            occupied.pop();
            romanLargeCount -= 1;
            continue;
          }
          break;
        }
      }

      return out;
    }

    function renderTextLayer() {
      clearTextLayer();
      if (!fragments.length) return;

      fragments.forEach((fragment) => {
        const fontFamily =
          fragment.fontType === "mono"
            ? '"IBM Plex Mono", "SFMono-Regular", Menlo, monospace'
            : '"Instrument Serif", Georgia, serif';
        textCtx.save();
        textCtx.translate(fragment.x, fragment.y);
        textCtx.rotate((fragment.rotation * Math.PI) / 180);
        textCtx.globalAlpha = fragment.currentOpacity;
        textCtx.fillStyle = "#f0e6d0";
        textCtx.font = `${fragment.size}px ${fontFamily}`;
        textCtx.textBaseline = "alphabetic";

        if (fragment.fontType === "serif") {
          const chars = fragment.text.split("");
          let cursor = 0;
          const spacing = fragment.size * 0.18;
          for (let i = 0; i < chars.length; i += 1) {
            const ch = chars[i];
            textCtx.fillText(ch, cursor, 0);
            cursor += textCtx.measureText(ch).width + spacing;
          }
        } else {
          textCtx.fillText(fragment.text, 0, 0);
        }
        textCtx.restore();
      });
      textNeedsRender = false;
    }

    function drawAmbientFrame(time) {
      ambientCtx.clearRect(0, 0, width, height);
      const layers = reducedMotion ? 4 : 5;

      for (let i = 0; i < layers; i += 1) {
        const nx = (noise2d(i * 10.3, time * 0.00028) + 1) / 2;
        const ny = (noise2d(i * 10.3 + 100, time * 0.0002) + 1) / 2;
        const nr = noise2d(i * 10.3 + 200, time * 0.00034);
        const x = width * (0.16 + nx * 0.68);
        const y = height * (0.12 + ny * 0.72);
        const radius = 320 + 180 * nr;
        const gradient = ambientCtx.createRadialGradient(x, y, 0, x, y, radius);
        const warmBase = reducedMotion ? 0.024 : 0.05;
        const warmMid = reducedMotion ? 0.012 : 0.026;
        gradient.addColorStop(0, `rgba(184, 136, 44, ${warmBase})`);
        gradient.addColorStop(0.42, `rgba(155, 108, 24, ${warmMid})`);
        gradient.addColorStop(1, "rgba(0,0,0,0)");

        ambientCtx.fillStyle = gradient;
        ambientCtx.beginPath();
        ambientCtx.ellipse(x, y, radius, radius * 0.6, 0, 0, Math.PI * 2);
        ambientCtx.fill();
      }
    }

    function drawAmbient(ts) {
      if (!running || reducedMotion) return;
      if (lastTs === 0) lastTs = ts;
      const delta = Math.min(64, ts - lastTs);
      lastTs = ts;
      noiseTime += delta;
      drawAmbientFrame(noiseTime);
      ambientRafId = window.requestAnimationFrame(drawAmbient);
    }

    function stepTextIllumination() {
      if (!running || !illuminationActive) return;
      const now = performance.now();
      let stillActive = false;
      for (let i = 0; i < fragments.length; i += 1) {
        const fragment = fragments[i];
        if (fragment.currentOpacity > fragment.baseOpacity) {
          if (now > fragment.litUntil) {
            fragment.currentOpacity *= 0.92;
            if (fragment.currentOpacity < fragment.baseOpacity) {
              fragment.currentOpacity = fragment.baseOpacity;
            } else {
              stillActive = true;
            }
          } else {
            stillActive = true;
          }
        }
      }
      textNeedsRender = true;
      renderTextLayer();
      illuminationActive = stillActive;
      if (illuminationActive) {
        textRafId = window.requestAnimationFrame(stepTextIllumination);
      } else {
        textRafId = 0;
      }
    }

    function generateBolt(startX, startY, endX, endY, roughness = 2.4) {
      const dist = Math.hypot(endX - startX, endY - startY);
      if (dist < 4) return [[startX, startY], [endX, endY]];

      const midX = (startX + endX) / 2 + (Math.random() - 0.5) * roughness * dist * 0.4;
      const midY = (startY + endY) / 2 + (Math.random() - 0.5) * roughness * dist * 0.2;
      const left = generateBolt(startX, startY, midX, midY, roughness * 0.6);
      const right = generateBolt(midX, midY, endX, endY, roughness * 0.6);
      left.pop();
      return left.concat(right);
    }

    function traceBolt(points) {
      if (!points.length) return;
      boltCtx.beginPath();
      boltCtx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i += 1) {
        boltCtx.lineTo(points[i][0], points[i][1]);
      }
    }

    function drawBolt(points, alpha, widthPx) {
      if (!points.length) return;
      traceBolt(points);
      boltCtx.strokeStyle = `rgba(184, 125, 24, ${alpha * 0.12})`;
      boltCtx.lineWidth = widthPx * 10;
      boltCtx.lineCap = "round";
      boltCtx.lineJoin = "round";
      boltCtx.shadowBlur = 34;
      boltCtx.shadowColor = "rgba(184, 125, 24, 0.32)";
      boltCtx.stroke();

      traceBolt(points);
      boltCtx.strokeStyle = `rgba(184, 125, 24, ${alpha * 0.3})`;
      boltCtx.lineWidth = widthPx * 5;
      boltCtx.shadowBlur = 18;
      boltCtx.stroke();

      traceBolt(points);
      boltCtx.strokeStyle = `rgba(240, 220, 140, ${alpha * 0.72})`;
      boltCtx.lineWidth = widthPx * 1.5;
      boltCtx.shadowBlur = 10;
      boltCtx.stroke();

      traceBolt(points);
      boltCtx.strokeStyle = `rgba(255, 245, 220, ${alpha * 0.42})`;
      boltCtx.lineWidth = widthPx * 0.65;
      boltCtx.shadowBlur = 0;
      boltCtx.stroke();
    }

    function screenFlash() {
      const flash = document.createElement("div");
      flash.className = "lightning-flash";
      document.body.appendChild(flash);
      window.setTimeout(() => {
        flash.remove();
      }, 160);
    }

    function illuminateNearbyText(points) {
      if (!fragments.length || !points.length || reducedMotion) return;
      const sampleStep = Math.max(1, Math.floor(points.length / 36));
      let touched = false;

      fragments.forEach((fragment) => {
        let nearBolt = false;
        for (let i = 0; i < points.length; i += sampleStep) {
          const point = points[i];
          if (!point) continue;
          if (Math.hypot(fragment.x - point[0], fragment.y - point[1]) < 220) {
            nearBolt = true;
            break;
          }
        }

        if (nearBolt) {
          const boosted = Math.min(fragment.maxOpacity, fragment.baseOpacity * 3.4);
          fragment.currentOpacity = Math.max(fragment.currentOpacity, boosted);
          fragment.litUntil = performance.now() + 70;
          touched = true;
        }
      });

      if (touched) {
        illuminationActive = true;
        textNeedsRender = true;
        renderTextLayer();
        if (!textRafId) {
          textRafId = window.requestAnimationFrame(stepTextIllumination);
        }
      }
    }

    function renderBoltFrame() {
      if (!running || !activeBolt) return;
      clearBoltLayer();
      drawBolt(activeBolt.main, activeBolt.alpha, 1.25);
      activeBolt.branches.forEach((branch) => {
        drawBolt(branch.points, activeBolt.alpha * 0.62, branch.width);
      });

      activeBolt.alpha -= 0.055;
      if (activeBolt.alpha > 0) {
        boltRafId = window.requestAnimationFrame(renderBoltFrame);
      } else {
        activeBolt = null;
        clearBoltLayer();
      }
    }

    function scheduleNextBolt() {
      if (!running || reducedMotion) return;
      const nextDelay = 3600 + Math.random() * 5200;
      boltTimeoutId = window.setTimeout(triggerLightningEvent, nextDelay);
    }

    function triggerLightningEvent() {
      if (!running || reducedMotion || document.hidden) return;

      const startFromTop = Math.random() > 0.28;
      const startX = startFromTop
        ? width * (0.08 + Math.random() * 0.84)
        : Math.random() > 0.5
          ? 0
          : width;
      const startY = startFromTop ? 0 : height * (0.08 + Math.random() * 0.42);
      const endX = startX + (Math.random() - 0.5) * width * 0.34;
      const endY = height * (0.28 + Math.random() * 0.52);

      const mainBolt = generateBolt(startX, startY, endX, endY);
      const branches = [];
      const branchCount = 2 + Math.floor(Math.random() * 3);

      for (let b = 0; b < branchCount; b += 1) {
        const branchStartIdx = Math.floor(mainBolt.length * (0.28 + Math.random() * 0.44));
        const point = mainBolt[Math.max(0, Math.min(mainBolt.length - 1, branchStartIdx))];
        if (!point) continue;
        const branchEndX = point[0] + (Math.random() - 0.5) * 220;
        const branchEndY = point[1] + Math.random() * 170;
        branches.push({
          points: generateBolt(point[0], point[1], branchEndX, branchEndY, 1.8),
          width: 0.55 + Math.random() * 0.45,
        });
      }

      activeBolt = { main: mainBolt, branches, alpha: 1 };
      const allBoltPoints = mainBolt.concat(...branches.map((branch) => branch.points));
      illuminateNearbyText(allBoltPoints);
      screenFlash();
      if (boltRafId) window.cancelAnimationFrame(boltRafId);
      boltRafId = window.requestAnimationFrame(renderBoltFrame);
      scheduleNextBolt();
    }

    function stopAnimations() {
      running = false;
      if (ambientRafId) window.cancelAnimationFrame(ambientRafId);
      if (textRafId) window.cancelAnimationFrame(textRafId);
      if (boltRafId) window.cancelAnimationFrame(boltRafId);
      if (boltTimeoutId) window.clearTimeout(boltTimeoutId);
      ambientRafId = 0;
      textRafId = 0;
      boltRafId = 0;
      boltTimeoutId = 0;
      lastTs = 0;
      activeBolt = null;
      illuminationActive = false;
      clearBoltLayer();
    }

    function startAnimations() {
      if (running) return;
      running = true;
      ambientCanvas.style.opacity = reducedMotion ? "0.92" : "1";
      textCanvas.style.opacity = "1";
      boltCanvas.style.opacity = reducedMotion ? "0" : "1";
      if (textNeedsRender) renderTextLayer();

      if (reducedMotion) {
        drawAmbientFrame(noiseTime || 2400);
        clearBoltLayer();
        return;
      }

      ambientRafId = window.requestAnimationFrame(drawAmbient);
      const firstDelay = 900 + Math.random() * 1600;
      boltTimeoutId = window.setTimeout(triggerLightningEvent, firstDelay);
    }

    function relayoutFragments() {
      safeZones = buildSafeZones();
      fragments = createFragments();
      textNeedsRender = true;
      renderTextLayer();
      if (reducedMotion) {
        drawAmbientFrame(noiseTime || 2400);
      }
    }

    function scheduleRelayout() {
      if (relayoutTimeoutId) window.clearTimeout(relayoutTimeoutId);
      relayoutTimeoutId = window.setTimeout(relayoutFragments, 140);
    }

    function onResize() {
      if (resizeTimeoutId) window.clearTimeout(resizeTimeoutId);
      resizeTimeoutId = window.setTimeout(() => {
        resizeCanvases();
        if (reducedMotion) {
          drawAmbientFrame(noiseTime || 2400);
        }
        renderTextLayer();
      }, 140);
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stopAnimations();
      } else {
        startAnimations();
      }
    }

    function onReducedMotionChange(event) {
      reducedMotion = event.matches;
      stopAnimations();
      startAnimations();
    }

    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fontsReady.then(() => {
      resizeCanvases();
      if (reducedMotion) {
        drawAmbientFrame(noiseTime || 2400);
      }
      renderTextLayer();
    });

    resizeCanvases();
    if (reducedMotion) {
      drawAmbientFrame(noiseTime || 2400);
    }
    renderTextLayer();

    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("load", scheduleRelayout, { once: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".og-nav-tab") || event.target.closest(".bottom-tab-bar button")) {
        window.setTimeout(scheduleRelayout, 60);
        window.setTimeout(scheduleRelayout, 260);
      }
    }, true);

    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", onReducedMotionChange);
    } else if (typeof reducedMotionQuery.addListener === "function") {
      reducedMotionQuery.addListener(onReducedMotionChange);
    }

    window.setTimeout(scheduleRelayout, 120);
    window.setTimeout(scheduleRelayout, 650);
    startAnimations();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupLightningBackground, { once: true });
  } else {
    setupLightningBackground();
  }
})();
