(function () {
  var statPools = {
    basketball: [
      'NET RTG +8.4', '112.6 ORTG', '103.2 DRTG', 'BPM +6.2',
      'eFG% 58.4', 'TS% 62.1', 'OREB% 28.4', '3PA RATE .412',
      'PACE 98.6', 'AST% 64.2', 'TOV% 12.8', 'REB% 52.4',
      'ELO 1724', 'SRS +7.8', 'MOV +6.1', 'SOS .524',
      '+1400', '-220', '+650', '-180', '+340', '-450',
      '52.4%', '78.2%', '14.6%', '3.8%', '92.1%',
      'W58-L24', 'W47-L35', 'W62-L20',
    ],
    odds: [
      '+1400', '+240', '-350', '+650', '-180', '+1100',
      '-420', '+310', '-160', '+2200', '-550', '+480',
      '52.4%', '78.2%', '14.6%', '33.1%', '91.8%', '6.2%',
    ],
    roman: ['XIV', 'XLVIII', 'IX', 'MMXXVI', 'XCIX', 'IV', 'LXIII', 'LVII', 'XXXII', 'XVI', 'XLII', 'LI', 'VII'],
    greek: ['Σ', 'Δ', 'μ', 'σ', 'π', 'Ω', 'β', 'λ', 'φ', 'θ'],
    latin: [
      'ALEA IACTA EST', 'PROBABILITAS', 'FORTES FORTUNA',
      'FATA VIAM INVENIENT', 'RATIO', 'VINCULUM', 'FORTUNA AUDACES IUVAT',
    ],
  };

  function mulberry32(seed) {
    return function () {
      var t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function debounce(fn, delay) {
    var timeoutId = null;

    return function () {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(fn, delay);
    };
  }

  function setupCanvas(canvas) {
    if (!canvas) {
      return null;
    }

    var width = window.innerWidth;
    var height = window.innerHeight;
    var ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    var context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    return {
      ctx: context,
      width: width,
      height: height,
    };
  }

  function overlaps(box, boxes) {
    for (var index = 0; index < boxes.length; index += 1) {
      var existing = boxes[index];
      if (
        box.x < existing.x + existing.width &&
        box.x + box.width > existing.x &&
        box.y < existing.y + existing.height &&
        box.y + box.height > existing.y
      ) {
        return true;
      }
    }

    return false;
  }

  function paintWords(contextInfo, random, reducedMotion, type) {
    if (!contextInfo) {
      return;
    }

    var ctx = contextInfo.ctx;
    var width = contextInfo.width;
    var height = contextInfo.height;
    var boxes = [];
    var count = reducedMotion ? 30 : type === 'text' ? 36 : 92;
    var source =
      type === 'text'
        ? statPools.greek.concat(statPools.roman).concat(statPools.latin)
        : statPools.basketball.concat(statPools.odds);

    for (var index = 0; index < count; index += 1) {
      var value = source[Math.floor(random() * source.length)];
      var isSymbol = statPools.greek.indexOf(value) >= 0;
      var fontSize =
        type === 'text'
          ? isSymbol
            ? 28 + Math.floor(random() * 9)
            : 16 + Math.floor(random() * 10)
          : 13 + Math.floor(random() * 6);
      var fontFamily =
        type === 'text'
          ? 'Instrument Serif, serif'
          : 'Space Grotesk, sans-serif';

      ctx.font = fontSize + 'px ' + fontFamily;

      var textWidth = ctx.measureText(value).width;
      var textHeight = fontSize * 1.2;
      var attempts = 0;
      var placed = false;

      while (!placed && attempts < 100) {
        attempts += 1;
        var x = random() * (width - textWidth - 20) + 10;
        var y = random() * (height - textHeight - 20) + textHeight;
        var box = {
          x: x,
          y: y - textHeight,
          width: textWidth + 12,
          height: textHeight + 8,
        };

        if (x < 320 && y < 130) {
          continue;
        }

        if (overlaps(box, boxes)) {
          continue;
        }

        boxes.push(box);
        ctx.save();
        ctx.fillStyle = '#f0e6d0';
        ctx.globalAlpha = type === 'text' ? 0.012 + random() * 0.01 : 0.01 + random() * 0.015;
        ctx.fillText(value, x, y);
        ctx.restore();
        placed = true;
      }
    }
  }

  function genBolt(random, x1, y1, x2, y2, segments, jitter) {
    var points = [];

    for (var index = 0; index <= segments; index += 1) {
      var t = index / segments;
      var x = x1 + (x2 - x1) * t;
      var y = y1 + (y2 - y1) * t;

      if (index > 0 && index < segments) {
        x += (random() - 0.5) * jitter * 2;
        y += (random() - 0.5) * jitter * 2;
      }

      points.push([x, y]);
    }

    return points;
  }

  function drawBolt(ctx, points, color, lineWidth) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);

    for (var index = 1; index < points.length; index += 1) {
      ctx.lineTo(points[index][0], points[index][1]);
    }

    ctx.stroke();
  }

  function paintLightning(contextInfo, random, reducedMotion) {
    if (!contextInfo || reducedMotion) {
      return;
    }

    var ctx = contextInfo.ctx;
    var width = contextInfo.width;
    var height = contextInfo.height;
    var mainBolt = genBolt(random, width * 0.78, 20, width * 0.52, height * 0.82, 58, 5);
    var branchStart = mainBolt[Math.floor(mainBolt.length * 0.35)];
    var branch = genBolt(random, branchStart[0], branchStart[1], width * 0.68, height * 0.58, 18, 4);
    var passes = [
      ['rgba(184,125,24,0.020)', 20],
      ['rgba(184,125,24,0.036)', 12],
      ['rgba(184,125,24,0.055)', 6],
      ['rgba(184,125,24,0.044)', 3],
      ['rgba(240,230,208,0.070)', 1],
    ];

    ctx.save();
    ctx.globalAlpha = 0.18;

    for (var index = 0; index < passes.length; index += 1) {
      drawBolt(ctx, mainBolt, passes[index][0], passes[index][1]);
    }

    drawBolt(ctx, branch, 'rgba(184,125,24,0.055)', 5);
    drawBolt(ctx, branch, 'rgba(240,230,208,0.070)', 2);
    ctx.restore();
  }

  function paintAll() {
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var statsCanvas = setupCanvas(document.getElementById('bg-stats'));
    var lightningCanvas = setupCanvas(document.getElementById('bg-lightning'));
    var textCanvas = setupCanvas(document.getElementById('bg-text'));
    var statsRandom = mulberry32(0x0dd51001);
    var textRandom = mulberry32(0x0dd51002);
    var lightningRandom = mulberry32(0x0dd51003);

    paintWords(statsCanvas, statsRandom, reducedMotion, 'stats');
    paintWords(textCanvas, textRandom, reducedMotion, 'text');
    paintLightning(lightningCanvas, lightningRandom, reducedMotion);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paintAll, { once: true });
  } else {
    paintAll();
  }

  window.addEventListener('resize', debounce(paintAll, 500));
})();
