// Жидкое стекло (Liquid Glass) — порт React-компонента «Apple Tahoe Liquid
// Glass Button» (MIT, HJHossain Jahed; исходник —
// references/liquid-glass/apple-tahoe-liquid-glass-button.source.txt) на
// чистый JS: IIFE, без модулей, без React, работает по file://.
//
// Как устроено:
//  1. На canvas считаются две карты по контуру элемента (сквиркл):
//     field — карта смещения для feDisplacementMap (R/G = нормаль у края),
//     overlay — блик и тень по ободу.
//  2. В Chromium карта field кладётся в общий SVG <filter> и подключается
//     через backdrop-filter: url(#…) — фон под элементом преломляется.
//     Safari и Firefox не умеют SVG-фильтры в backdrop-filter — там
//     матовое стекло: blur() + saturate() + brightness(). Обод (overlay)
//     рисуется везде.
//  3. ResizeObserver пересчитывает карты при смене размера элемента.
//
// API: любой элемент с атрибутом data-glass становится стеклом.
//   data-glass-appearance="light|dark"   тон стекла (по умолчанию light)
//   data-glass-material="clear|regular"  прозрачное / матовое (clear)
//   data-glass-refraction="18"           сила преломления у края, px
//   data-glass-bezel="32"                ширина изогнутого края, px
//   data-glass-blur="1"                  сглаживание после преломления, px
//   data-glass-dispersion="0"            радужный разброс на крае, 0–1
//   data-glass-tint="#rrggbb"            окраска стекла
//   data-glass-mode="auto|refract|frost" auto: преломление только в Chromium
//   data-glass-fallback-blur="10"        размытие фолбэка, px
//   data-glass-interactive               пружина нажатия + подсветка курсором
// Скругление берётся из CSS (border-radius элемента).
// JS-доступ: window.LiquidGlass.init(el) / .refresh(el) / .destroy(el) /
// .initAll(root). Новые элементы с data-glass подхватываются сами.
(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var HOVER_QUERY = '(hover: hover) and (pointer: fine)';

  /* ---------- Движок браузера ---------- */

  var detectedEngine = null;

  // Chromium рендерит SVG-фильтры в backdrop-filter, остальные — нет.
  // В UA Chrome есть «Safari/», поэтому Safari определяем по отсутствию
  // признаков Chromium, а не по слову Safari.
  function detectEngine() {
    if (detectedEngine) return detectedEngine;
    var ua = navigator.userAgent;
    if (/Firefox\//.test(ua)) return (detectedEngine = 'gecko');
    var brands = navigator.userAgentData && navigator.userAgentData.brands;
    if (brands && brands.length) {
      var chromium = brands.some(function (b) {
        return /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand);
      });
      return (detectedEngine = chromium ? 'chromium' : 'webkit');
    }
    // userAgentData нет на file:// и http — смотрим UA
    return (detectedEngine = /(Chrome|Chromium|Edg|SamsungBrowser)\/\d+/.test(ua) ? 'chromium' : 'webkit');
  }

  function resolveMode(requested) {
    if (requested === 'refract' || requested === 'frost') return requested;
    return detectEngine() === 'chromium' ? 'refract' : 'frost';
  }

  var reducedQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function motionLevel() {
    return reducedQuery && reducedQuery.matches ? 'reduced' : 'full';
  }

  /* ---------- Пружины (core/spring.ts) ---------- */

  var SPRINGS = {
    press: { duration: 0.24, bounce: 0.2 },
    release: { duration: 0.5, bounce: 0.42 },
    glow: { duration: 0.42, bounce: 0 },
    track: { duration: 0.18, bounce: 0 }
  };

  function Spring(value, options) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.configure(options);
  }

  Spring.prototype.configure = function (options) {
    var omega = (2 * Math.PI) / options.duration;
    this.stiffness = omega * omega;
    this.damping = options.bounce >= 0
      ? (4 * Math.PI * (1 - options.bounce)) / options.duration
      : (4 * Math.PI) / (options.duration * (1 + options.bounce));
    return this;
  };

  Spring.prototype.isSettled = function () {
    return this.value === this.target && this.velocity === 0;
  };

  // Аналитическое решение затухающего осциллятора за шаг dt
  Spring.prototype.step = function (dt) {
    if (this.isSettled() || !(dt > 0)) return this;
    var omega = Math.sqrt(this.stiffness);
    var zeta = this.damping / (2 * omega);
    var x0 = this.value - this.target;
    var v0 = this.velocity;
    var x, v;
    if (zeta < 1) {
      var wd = omega * Math.sqrt(1 - zeta * zeta);
      var decay = Math.exp(-zeta * omega * dt);
      var b = (v0 + zeta * omega * x0) / wd;
      var cos = Math.cos(wd * dt);
      var sin = Math.sin(wd * dt);
      x = decay * (x0 * cos + b * sin);
      v = decay * ((b * wd - zeta * omega * x0) * cos - (x0 * wd + zeta * omega * b) * sin);
    } else if (zeta === 1) {
      var d1 = Math.exp(-omega * dt);
      var b1 = v0 + omega * x0;
      x = d1 * (x0 + b1 * dt);
      v = d1 * (b1 - omega * (x0 + b1 * dt));
    } else {
      var root = omega * Math.sqrt(zeta * zeta - 1);
      var r1 = -zeta * omega + root;
      var r2 = -zeta * omega - root;
      var c2 = (v0 - r1 * x0) / (r2 - r1);
      var c1 = x0 - c2;
      var e1 = Math.exp(r1 * dt);
      var e2 = Math.exp(r2 * dt);
      x = c1 * e1 + c2 * e2;
      v = c1 * r1 * e1 + c2 * r2 * e2;
    }
    var scale = Math.max(1, Math.abs(this.target), Math.abs(x0));
    if (Math.abs(x) < 1e-4 * scale && Math.abs(v) < 1e-3 * scale) {
      this.value = this.target;
      this.velocity = 0;
    } else {
      this.value = this.target + x;
      this.velocity = v;
    }
    return this;
  };

  function rubberBand(offset, limit) {
    if (limit <= 0) return 0;
    var coefficient = 0.55;
    return Math.sign(offset) * limit * (1 - 1 / (Math.abs(offset) * coefficient / limit + 1));
  }

  /* ---------- Материалы и тон (core/materials.ts) ---------- */

  var MATERIALS = {
    clear: {
      light: { shadowLift: 0.18, highlightRolloff: 0 },
      dark: { shadowLift: 0.15, highlightRolloff: 0.2 }
    },
    regular: {
      blur: 4.5,
      light: { fillSigma: 15, fillOpacity: 0.34, tone: [0.36, 0.67, -0.1113, 1.1031] },
      dark: { fillSigma: 14, fillOpacity: 0.65, tone: [0.105, 0.83, -0.2091, 1.0648] }
    }
  };

  var toneTableCache = {};

  function toneTable(material, appearance, nested) {
    var key = material + '|' + appearance + '|' + (nested ? 'n' : '');
    if (toneTableCache[key]) return toneTableCache[key];
    var dark = appearance === 'dark';
    var values = [];
    for (var n = 0; n < 33; n++) {
      var v = n / 32;
      if (material === 'regular') {
        var t = dark ? MATERIALS.regular.dark.tone : MATERIALS.regular.light.tone;
        var toneWeight = dark ? 0.9 : 0.8;
        values.push(toneWeight * (t[0] + t[1] * v + t[2] * v * v) + (1 - toneWeight) * v);
      } else {
        var spec = dark ? MATERIALS.clear.dark : MATERIALS.clear.light;
        var tone = v + spec.shadowLift * Math.pow(1 - v, 3) - spec.highlightRolloff * Math.pow(v, 3);
        var tinted = dark ? 0.38 * v + 0.2 : 0.78 * v + 0.26;
        var tintWeight = dark ? 0.14 : 0.06;
        var layerLight = dark && nested ? 0.08 * (1 - v) : 0;
        values.push(sat((1 - tintWeight) * tone + tintWeight * tinted + layerLight));
      }
    }
    var table = values.map(function (x) { return x.toFixed(5); }).join(' ');
    toneTableCache[key] = table;
    return table;
  }

  function tintChannels(tint) {
    if (!tint || !/^#[\da-f]{6}$/i.test(tint)) return null;
    return [
      parseInt(tint.slice(1, 3), 16) / 255,
      parseInt(tint.slice(3, 5), 16) / 255,
      parseInt(tint.slice(5, 7), 16) / 255
    ];
  }

  function sat(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }

  /* ---------- Контур-сквиркл (порт @lisse/core 0.7.2) ---------- */

  var SMOOTHING = 0.8125;

  function rad(d) {
    return (d * Math.PI) / 180;
  }

  function cornerParams(radius, budget) {
    var e = radius;
    var p = (1 + SMOOTHING) * e;
    var o = 90 * (1 - SMOOTHING);
    var i = Math.sin(rad(o / 2)) * e * Math.SQRT2;
    var g = e * Math.tan(rad((90 - o) / 4));
    var c = g * Math.cos(rad(45 * SMOOTHING));
    var d = c * Math.tan(rad(45 * SMOOTHING));
    var u = (p - i - c - d) / 3;
    var a = 2 * u;
    if (p > budget) {
      var rem = budget - d - i - c;
      var m = rem / 6;
      var l = rem - m;
      u = Math.min(u, l);
      a = rem - u;
      p = budget;
    }
    return { a: a, b: u, c: c, d: d, p: p, i: i };
  }

  function bezier(out, x0, y0, x1, y1, x2, y2, x3, y3, steps) {
    for (var s = 1; s <= steps; s++) {
      var t = s / steps;
      var w = 1 - t;
      out.push(
        x0 * w * w * w + 3 * w * w * t * x1 + 3 * w * t * t * x2 + t * t * t * x3,
        y0 * w * w * w + 3 * w * w * t * y1 + 3 * w * t * t * y2 + t * t * t * y3
      );
    }
  }

  var outlineCache = new Map();

  // Тесселированный контур в центрированных координатах (y вниз):
  // точки и нормали четырёх углов + polygon() для clip-path
  function squircleOutline(w, h, radius) {
    var key = w + '|' + h + '|' + radius;
    if (outlineCache.has(key)) return outlineCache.get(key);
    var hw = w / 2;
    var hh = h / 2;
    var budget = Math.min(hw, hh);
    var r = Math.min(radius, budget);
    var outline;

    if (r < 0.5) {
      outline = {
        corners: [new Float64Array(0), new Float64Array(0), new Float64Array(0), new Float64Array(0)],
        extent: 0,
        polygon: 'polygon(0px 0px, ' + w + 'px 0px, ' + w + 'px ' + h + 'px, 0px ' + h + 'px)',
        width: w,
        height: h,
        radius: 0
      };
      outlineCache.set(key, outline);
      return outline;
    }

    var cp = cornerParams(r, budget);
    var pts = [];
    var x0 = hw - cp.p;
    var y0 = -hh;
    bezier(pts, x0, y0, x0 + cp.a, y0, x0 + cp.a + cp.b, y0, x0 + cp.a + cp.b + cp.c, y0 + cp.d, 24);
    var ax = x0 + cp.a + cp.b + cp.c;
    var ay = y0 + cp.d;
    // Дуга окружности между двумя кривыми Безье
    var chord = cp.i * Math.SQRT2;
    var offset = Math.sqrt(Math.max(0, r * r - (chord * chord) / 4));
    var cx = ax + cp.i / 2 - (cp.i / chord) * offset;
    var cy = ay + cp.i / 2 + (cp.i / chord) * offset;
    var angle = Math.atan2(ay - cy, ax - cx);
    var arc = 2 * Math.asin(Math.min(1, chord / (2 * r)));
    for (var s = 1; s <= 8; s++) {
      var theta = angle + (arc * s) / 8;
      pts.push(cx + r * Math.cos(theta), cy + r * Math.sin(theta));
    }
    var qx = ax + cp.i;
    var qy = ay + cp.i;
    bezier(pts, qx, qy, qx + cp.d, qy + cp.c, qx + cp.d, qy + cp.b + cp.c, qx + cp.d, qy + cp.a + cp.b + cp.c, 24);

    // Нормали правого верхнего угла: наружу — справа от направления обхода
    var anchored = [x0, y0].concat(pts, [hw, -hh + cp.p]);
    var count = anchored.length / 2;
    var trPts = new Float64Array(count * 2);
    var trNormals = new Float64Array(count * 2);
    for (var k = 0; k < count; k++) {
      var prev = Math.max(0, k - 1);
      var next = Math.min(count - 1, k + 1);
      var tdx = anchored[2 * next] - anchored[2 * prev];
      var tdy = anchored[2 * next + 1] - anchored[2 * prev + 1];
      if (k === 0) { tdx = 1; tdy = 0; }
      if (k === count - 1) { tdx = 0; tdy = 1; }
      var len = Math.hypot(tdx, tdy) || 1;
      trPts[2 * k] = anchored[2 * k];
      trPts[2 * k + 1] = anchored[2 * k + 1];
      trNormals[2 * k] = tdy / len;
      trNormals[2 * k + 1] = -tdx / len;
    }

    // Остальные углы — отражение точек и нормалей
    function mirror(mx, my) {
      var run = new Float64Array(count * 4);
      var sx = mx ? -1 : 1;
      var sy = my ? -1 : 1;
      for (var m = 0; m < count; m++) {
        run[4 * m] = sx * trPts[2 * m];
        run[4 * m + 1] = sy * trPts[2 * m + 1];
        run[4 * m + 2] = sx * trNormals[2 * m];
        run[4 * m + 3] = sy * trNormals[2 * m + 1];
      }
      return run;
    }
    var tr = mirror(false, false);
    var br = mirror(false, true);
    var bl = mirror(true, true);
    var tl = mirror(true, false);

    // Полигон по часовой: отражение по одной оси разворачивает обход,
    // поэтому BR и TL идут задом наперёд (иначе полигон самопересекается)
    var poly = [];
    function push(run, step) {
      var start = step > 0 ? 0 : count - 1;
      for (var q = start; step > 0 ? q < count : q >= 0; q += step) {
        poly.push((run[4 * q] + hw).toFixed(2) + 'px ' + (run[4 * q + 1] + hh).toFixed(2) + 'px');
      }
    }
    push(tr, 1);
    push(br, -1);
    push(bl, 1);
    push(tl, -1);

    outline = {
      corners: [tr, br, bl, tl],
      extent: cp.p,
      polygon: 'polygon(' + poly.join(', ') + ')',
      width: w,
      height: h,
      radius: r
    };
    if (outlineCache.size > 256) outlineCache.delete(outlineCache.keys().next().value);
    outlineCache.set(key, outline);
    return outline;
  }

  // Знаковое расстояние до контура и внешняя нормаль в точке (px, py)
  function outlineField(px, py, outline) {
    var hw = outline.width / 2;
    var hh = outline.height / 2;
    var p = outline.extent;
    var ax = Math.abs(px);
    var ay = Math.abs(py);
    var qx = ax - (hw - p);
    var qy = ay - (hh - p);

    if (qx > 0 && qy > 0) {
      var run = px >= 0
        ? (py < 0 ? outline.corners[0] : outline.corners[1])
        : (py < 0 ? outline.corners[3] : outline.corners[2]);
      if (run.length === 0) {
        var sdx = ax - hw;
        var sdy = ay - hh;
        var sd = Math.hypot(sdx, sdy);
        return { d: sd, nx: sdx / (sd || 1), ny: sdy / (sd || 1) };
      }
      // Ближайшая точка на каждом отрезке ломаной, а не на её вершинах
      var best2 = Infinity;
      var bx = 0, by = 0, bnx = 0, bny = 0;
      var n = run.length / 4;
      for (var k = 0; k < n - 1; k++) {
        var x1 = run[4 * k];
        var y1 = run[4 * k + 1];
        var ex = run[4 * k + 4] - x1;
        var ey = run[4 * k + 5] - y1;
        var len2 = ex * ex + ey * ey;
        var t = len2 > 1e-12 ? sat(((px - x1) * ex + (py - y1) * ey) / len2) : 0;
        var cx = x1 + ex * t;
        var cy = y1 + ey * t;
        var ddx = px - cx;
        var ddy = py - cy;
        var d2 = ddx * ddx + ddy * ddy;
        if (d2 < best2) {
          best2 = d2;
          bx = cx; by = cy;
          bnx = run[4 * k + 2]; bny = run[4 * k + 3];
        }
      }
      var distance = Math.sqrt(best2);
      var delta = distance > 1e-5 ? 1 / distance : 0;
      var dx = px - bx;
      var dy = py - by;
      var direction = dx * bnx + dy * bny >= 0 ? 1 : -1;
      return {
        d: distance * direction,
        nx: distance > 1e-5 ? dx * delta * direction : bnx,
        ny: distance > 1e-5 ? dy * delta * direction : bny
      };
    }
    if (qx > qy) return { d: qx - p, nx: Math.sign(px) || 1, ny: 0 };
    return { d: qy - p, nx: 0, ny: Math.sign(py) || 1 };
  }

  function resolveRadius(value, w, h) {
    var n = parseFloat(value);
    if (!isFinite(n)) return 0;
    var r = String(value).trim().slice(-1) === '%' ? (n / 100) * Math.min(w, h) : n;
    return Math.max(0, Math.min(r, w / 2, h / 2));
  }

  /* ---------- Карты на canvas (порт gpu/maps.wgsl) ---------- */

  var COS_SPREAD = Math.cos(1.08);
  var COS_DIFFUSE = Math.cos(1.08 * 0.65);
  var COS_SIDE = Math.cos(0.98);

  function pixelScale(w, h) {
    return w * h > 250000 ? 0.5 : Math.min(Math.max(window.devicePixelRatio || 1, 1), 2);
  }

  // Самый дорогой проход — попиксельный расчёт обеих карт
  function renderCanvases(w, h, radius, bezel, dark, tint) {
    try {
      var outline = squircleOutline(w, h, radius);
      var hw = w / 2;
      var hh = h / 2;
      var p = outline.extent;
      var bz = Math.max(1, Math.min(bezel, hw, hh));
      var pad = 2;

      var k = pixelScale(w, h);
      var fieldCanvas = document.createElement('canvas');
      fieldCanvas.width = Math.max(1, Math.round(w * k));
      fieldCanvas.height = Math.max(1, Math.round(h * k));
      var fctx = fieldCanvas.getContext('2d');

      // Обод выходит на 2px за форму: там половина блика и боковая тень
      var bw = w + pad * 2;
      var bh = h + pad * 2;
      var ok = pixelScale(bw, bh);
      var overlayCanvas = document.createElement('canvas');
      overlayCanvas.width = Math.max(1, Math.round(bw * ok));
      overlayCanvas.height = Math.max(1, Math.round(bh * ok));
      var octx = overlayCanvas.getContext('2d');
      if (!fctx || !octx) return { field: null, overlay: null };

      for (var pass = 0; pass < 2; pass++) {
        var isField = pass === 0;
        var cw = isField ? w : bw;
        var ch = isField ? h : bh;
        var scale = isField ? k : ok;
        var canvas = isField ? fieldCanvas : overlayCanvas;
        var ctx = isField ? fctx : octx;
        var width = canvas.width;
        var height = canvas.height;
        var img = ctx.createImageData(width, height);
        var data = img.data;

        for (var j = 0; j < height; j++) {
          var py = (j + 0.5) / scale - ch / 2;
          for (var i = 0; i < width; i++) {
            var px = (i + 0.5) / scale - cw / 2;
            var o = (j * width + i) * 4;

            if (isField) {
              var f = outlineField(px, py, outline);
              // Глубоко внутри — нейтральное смещение, полное покрытие
              if (f.d < -(bz + 4)) {
                data[o] = 128; data[o + 1] = 128; data[o + 2] = 128; data[o + 3] = 255;
                continue;
              }
              var depth = sat(-f.d / bz);
              var edge = 1 - sat(Math.sqrt((2 - depth) * depth));
              data[o] = Math.round(255 * (0.5 - f.nx * edge * 0.5));
              data[o + 1] = Math.round(255 * (0.5 - f.ny * edge * 0.5));
              data[o + 2] = 128;
              data[o + 3] = Math.round(255 * sat(0.5 - f.d));
              continue;
            }

            // Обод: быстро пропускаем заведомо пустые пиксели
            var qx = Math.abs(px) - (hw - p);
            var qy = Math.abs(py) - (hh - p);
            if (Math.max(qx, qy) - p > pad + 6) continue;
            var g = outlineField(px, py, outline);
            var coverage = sat(0.5 - g.d);
            var directional = Math.pow(sat((Math.abs(g.ny) - COS_SPREAD) / (1 - COS_SPREAD)), 1.25);
            var diffuseDir = Math.pow(sat((Math.abs(g.ny) - COS_DIFFUSE) / (1 - COS_DIFFUSE)), 1.25);
            var stroke = sat(g.d + 0.9 + 0.5) * sat(0.5 - g.d);
            var specular = directional * stroke;
            specular = specular / (1 + 0.5 * (1 - specular));
            var diffuse = diffuseDir * 0.18 * Math.pow(1 - sat(-g.d / 4.5), 2) * coverage;
            var highlight = sat(specular * (dark ? 0.82 : 1) + diffuse * (dark ? 0.4 : 1));
            var adjusted = g.d - 0.5;
            var falloff = 1 - sat(-adjusted / 0.5);
            var ramp = (falloff > 0 ? 1 : 0) * 0.25 + falloff * 0.75;
            var band = ramp * sat(adjusted + 0.5 + 0.5) * sat(-adjusted + 0.5);
            var wx = sat((g.nx - COS_SIDE) / (1 - COS_SIDE)) * band;
            var wy = sat((-g.nx - COS_SIDE) / (1 - COS_SIDE)) * band;
            var shade = (wx / (1 + 0.4 * (1 - wx)) + wy / (1 + 0.4 * (1 - wy))) * (dark ? 0.6 : 0.48);
            var alpha = highlight + shade * (1 - highlight);
            if (alpha <= 0.002) continue;
            if (tint) {
              var base = highlight / Math.max(alpha, 1e-5);
              data[o] = Math.round(255 * Math.min(1, base * (0.45 + 0.55 * tint[0])));
              data[o + 1] = Math.round(255 * Math.min(1, base * (0.45 + 0.55 * tint[1])));
              data[o + 2] = Math.round(255 * Math.min(1, base * (0.45 + 0.55 * tint[2])));
            } else {
              var light = ((dark ? 0.82 : 1) * highlight) / Math.max(alpha, 1e-5);
              data[o] = data[o + 1] = data[o + 2] = Math.round(255 * Math.min(1, light));
            }
            data[o + 3] = Math.round(255 * alpha);
          }
        }
        ctx.putImageData(img, 0, 0);
      }
      return { field: fieldCanvas, overlay: overlayCanvas };
    } catch (err) {
      return { field: null, overlay: null };
    }
  }

  /* ---------- Капсулы: печём один раз на 3×высоту и режем на 3 части ---------- */

  // Концы капсулы не зависят от её ширины — растягивается только середина,
  // поэтому длинные пилюли не пересчитываются попиксельно заново
  var bakeCache = new Map();

  function isCapsule(w, h, radius) {
    return radius >= Math.min(w, h) / 2 - 0.75 && w >= h * 2;
  }

  function capsuleBake(h, radius, o) {
    var key = 'bake|h' + h + '|r' + radius + '|' + o.bezel + '|' + (o.dark ? 'd' : 'l') + '|' + (o.tintKey || '');
    var baked = bakeCache.get(key);
    if (!baked) {
      baked = renderCanvases(h * 3, h, radius, o.bezel, o.dark, o.tint);
      if (bakeCache.size > 16) bakeCache.delete(bakeCache.keys().next().value);
      bakeCache.set(key, baked);
    }
    return baked;
  }

  function sliceCapsule(source, w, h, sourcePad, destPad) {
    var cap = h / 2;
    var cw = w + destPad * 2;
    var ch = h + destPad * 2;
    var scale = pixelScale(cw, ch);
    var canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(cw * scale));
    canvas.height = Math.max(1, Math.round(ch * scale));
    var ctx = canvas.getContext('2d');
    var sh = source.height;
    var sk = sh / (h + sourcePad * 2);
    // Каждый конец несёт свой отступ, середина тянется встык целыми
    // пикселями — перекрытие давало бы двойной обод и светлые точки
    var capSrc = sourcePad * sk + cap * sk;
    var capDest = Math.round(destPad * scale + cap * scale);
    var midDest = Math.max(1, canvas.width - 2 * capDest);
    ctx.drawImage(source, 0, 0, capSrc, sh, 0, 0, capDest, canvas.height);
    ctx.drawImage(source, capSrc, 0, Math.max(1, source.width - 2 * capSrc), sh, capDest, 0, midDest, canvas.height);
    ctx.drawImage(source, source.width - capSrc, 0, capSrc, sh, canvas.width - capDest, 0, capDest, canvas.height);
    return canvas;
  }

  /* ---------- Кэш data-URL карт ---------- */

  var fieldCache = new Map();
  var overlayCache = new Map();
  var CACHE_LIMIT = 64;

  function remember(cache, key, make) {
    if (cache.has(key)) return cache.get(key);
    var value = make();
    if (!value) return value;
    cache.set(key, value);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    return value;
  }

  function fieldURL(w, h, radius, o) {
    return remember(fieldCache, w + 'x' + h + 'r' + radius + 'b' + o.bezel, function () {
      if (isCapsule(w, h, radius)) {
        var baked = capsuleBake(h, radius, o);
        if (baked.field) return sliceCapsule(baked.field, w, h, 0, 0).toDataURL('image/png');
      }
      var c = renderCanvases(w, h, radius, o.bezel, o.dark, o.tint).field;
      return c ? c.toDataURL('image/png') : '';
    });
  }

  function overlayURL(w, h, radius, o) {
    var key = w + 'x' + h + 'r' + radius + 'b' + o.bezel + (o.dark ? 'd' : 'l') + (o.tintKey || '');
    return remember(overlayCache, key, function () {
      if (isCapsule(w, h, radius)) {
        var baked = capsuleBake(h, radius, o);
        if (baked.overlay) return sliceCapsule(baked.overlay, w, h, 2, 2).toDataURL('image/png');
      }
      var c = renderCanvases(w, h, radius, o.bezel, o.dark, o.tint).overlay;
      return c ? c.toDataURL('image/png') : '';
    });
  }

  /* ---------- Общий SVG-хост фильтров ---------- */

  // Одинаковая геометрия и параметры — один <filter> на всех: ряд
  // одинаковых кнопок стоит один фильтр и один набор карт
  var defsHost = null;
  var filterRefs = new Map();

  function getHost() {
    if (defsHost) return defsHost;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.setAttribute('class', 'lg-defs');
    document.body.appendChild(svg);
    defsHost = svg;
    return svg;
  }

  function acquireFilter(id, markup) {
    var existing = filterRefs.get(id);
    if (existing) {
      existing.count++;
      return;
    }
    var filter = document.createElementNS(SVG_NS, 'filter');
    filter.setAttribute('id', id);
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.innerHTML = markup;
    getHost().appendChild(filter);
    filterRefs.set(id, { el: filter, count: 1 });
  }

  function releaseFilter(id) {
    var entry = filterRefs.get(id);
    if (!entry) return;
    entry.count--;
    if (entry.count <= 0) {
      entry.el.remove();
      filterRefs.delete(id);
    }
  }

  // Цепочка одной линзы: преломление → тон → (окраска) → обрезка по карте
  function filterMarkup(o) {
    var dark = o.appearance === 'dark';
    var spec = o.material === 'regular' ? (dark ? MATERIALS.regular.dark : MATERIALS.regular.light) : null;
    var parts = [
      '<feImage href="' + o.field + '" x="0" y="0" width="' + o.w + '" height="' + o.h + '" preserveAspectRatio="none" result="field"/>'
    ];
    var base = 'SourceGraphic';
    if (spec) {
      parts.push(
        '<feGaussianBlur in="SourceGraphic" stdDeviation="' + MATERIALS.regular.blur + '" result="frost"/>',
        '<feGaussianBlur in="SourceGraphic" stdDeviation="' + spec.fillSigma + '" result="fill"/>',
        '<feBlend in="frost" in2="fill" mode="' + (dark ? 'darken' : 'lighten') + '" result="blend"/>',
        '<feComposite in="blend" in2="frost" operator="arithmetic" k2="' + spec.fillOpacity + '" k3="' + (1 - spec.fillOpacity) + '" result="mix"/>'
      );
      base = 'mix';
    }
    var s = o.refraction * 2;
    if (o.dispersion > 0) {
      parts.push(
        '<feDisplacementMap in="' + base + '" in2="field" scale="' + s * (1 + o.dispersion) + '" xChannelSelector="R" yChannelSelector="G" result="dr"/>',
        '<feDisplacementMap in="' + base + '" in2="field" scale="' + s + '" xChannelSelector="R" yChannelSelector="G" result="dg"/>',
        '<feDisplacementMap in="' + base + '" in2="field" scale="' + s * (1 - o.dispersion) + '" xChannelSelector="R" yChannelSelector="G" result="db"/>',
        '<feColorMatrix in="dr" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/>',
        '<feColorMatrix in="dg" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g"/>',
        '<feColorMatrix in="db" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/>',
        '<feBlend in="r" in2="g" mode="screen" result="rg"/>',
        '<feBlend in="rg" in2="b" mode="screen" result="refracted"/>'
      );
    } else {
      parts.push(
        '<feDisplacementMap in="' + base + '" in2="field" scale="' + s + '" xChannelSelector="R" yChannelSelector="G" result="refracted"/>'
      );
    }
    var table = toneTable(o.material, o.appearance, o.nested);
    parts.push(
      '<feComponentTransfer in="refracted" result="tone"><feFuncR type="table" tableValues="' + table + '"/><feFuncG type="table" tableValues="' + table + '"/><feFuncB type="table" tableValues="' + table + '"/></feComponentTransfer>'
    );
    var color = 'tone';
    if (spec) {
      parts.push('<feColorMatrix in="tone" type="saturate" values="' + spec.tone[3] + '" result="color"/>');
      color = 'color';
    }
    if (o.tint) {
      var body = spec ? 0.78 : 0.68;
      var rest = 1 - body;
      parts.push(
        '<feColorMatrix in="' + color + '" type="saturate" values="0" result="luminance"/>',
        '<feComponentTransfer in="luminance" result="tinted">',
        '<feFuncR type="linear" slope="' + o.tint[0] * rest + '" intercept="' + o.tint[0] * body + '"/>',
        '<feFuncG type="linear" slope="' + o.tint[1] * rest + '" intercept="' + o.tint[1] * body + '"/>',
        '<feFuncB type="linear" slope="' + o.tint[2] * rest + '" intercept="' + o.tint[2] * body + '"/>',
        '<feFuncA type="linear" slope="' + rest + '" intercept="' + body + '"/>',
        '</feComponentTransfer>'
      );
      color = 'tinted';
    }
    parts.push('<feComposite in="' + color + '" in2="field" operator="in"/>');
    return parts.join('');
  }

  /* ---------- Интерактив: пружина нажатия, растяжка, подсветка ---------- */

  // Событие, уже обработанное вложенным стеклом, не трогаем повторно
  var claimed = new WeakSet();

  function isDisabled(el) {
    return el.matches(':disabled, [data-disabled], [aria-disabled="true"]');
  }

  function attachInteraction(el) {
    var saved = { translate: el.style.translate, scale: el.style.scale };
    var tx = new Spring(0, SPRINGS.track);
    var ty = new Spring(0, SPRINGS.track);
    var press = new Spring(0, SPRINGS.press);
    var glow = new Spring(0, SPRINGS.glow);
    var pointer = null;
    var keyboard = false;
    var hovering = false;
    var previous = 0;
    var written = false;
    var glowX = 0;
    var glowY = 0;
    var raf = 0;
    var awake = false;

    function writeStyle(name, value) {
      if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
    }
    function size() {
      return { width: el.offsetWidth || 1, height: el.offsetHeight || 1 };
    }
    function layout() {
      var rect = el.getBoundingClientRect();
      var s = size();
      return {
        cx: rect.left + rect.width / 2 - tx.value,
        cy: rect.top + rect.height / 2 - ty.value,
        width: s.width, height: s.height, rect: rect
      };
    }
    function light(x, y) {
      var l = layout();
      glowX = ((x - l.rect.left) * l.width) / (l.rect.width || 1);
      glowY = ((y - l.rect.top) * l.height) / (l.rect.height || 1);
    }
    function set(spring, target, options) {
      spring.configure(options).target = target;
    }

    function move(event) {
      if (!pointer || event.pointerId !== pointer.id) return;
      pointer.clientX = event.clientX;
      pointer.clientY = event.clientY;
    }
    function release(event) {
      if (event && (!pointer || event.pointerId !== pointer.id)) return;
      pointer = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      set(press, 0, SPRINGS.release);
      set(tx, 0, SPRINGS.release);
      set(ty, 0, SPRINGS.release);
      set(glow, hovering ? 0.35 : 0, SPRINGS.glow);
    }
    function down(event) {
      if (claimed.has(event) || event.button !== 0 || isDisabled(el)) return;
      claimed.add(event);
      var l = layout();
      pointer = {
        id: event.pointerId, x: event.clientX, y: event.clientY,
        cx: l.cx, cy: l.cy, clientX: event.clientX, clientY: event.clientY
      };
      light(event.clientX, event.clientY);
      set(press, 1, SPRINGS.press);
      set(glow, 1, SPRINGS.press);
      var s = size();
      var follow = { duration: SPRINGS.track.duration + 0.0005 * Math.max(s.width, s.height), bounce: 0 };
      set(tx, 0, follow);
      set(ty, 0, follow);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
    }
    function hover(event) {
      if (event.pointerType === 'touch' || !window.matchMedia(HOVER_QUERY).matches) return;
      hovering = event.type !== 'pointerleave';
      if (hovering) light(event.clientX, event.clientY);
      if (!pointer && !keyboard) set(glow, hovering ? 0.35 : 0, SPRINGS.glow);
    }
    function key(event) {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      if (event.type === 'keydown') {
        if (event.repeat || claimed.has(event) || isDisabled(el) || pointer) return;
        claimed.add(event);
        keyboard = true;
        var s = size();
        glowX = s.width / 2;
        glowY = s.height / 2;
        set(press, 1, SPRINGS.press);
        set(glow, 1, SPRINGS.press);
      } else if (keyboard) {
        keyboard = false;
        set(press, 0, SPRINGS.release);
        set(glow, hovering ? 0.35 : 0, SPRINGS.glow);
      }
    }
    function drag(event) {
      if (!pointer) return;
      var origin = event.target;
      var source = origin && origin.nodeType === 1 ? origin : origin && origin.parentElement;
      if (!source || !source.closest('[draggable="true"]')) event.preventDefault();
    }
    function blur() {
      if (!keyboard) return;
      keyboard = false;
      set(press, 0, SPRINGS.release);
      set(glow, 0, SPRINGS.glow);
    }

    function frame(now) {
      var dt = previous ? Math.max(0, (now - previous) / 1000) : 1 / 60;
      previous = now;
      var s = size();
      var big = Math.max(s.width, s.height);
      if (pointer) {
        // Маленькие кнопки тянутся за пальцем целиком, большие — только
        // когда палец выходит за край
        var l = layout();
        var small = big <= 72;
        var ox = small
          ? pointer.clientX - pointer.x - (l.cx - pointer.cx)
          : pointer.clientX - Math.max(l.cx - s.width / 2, Math.min(l.cx + s.width / 2, pointer.clientX));
        var oy = small
          ? pointer.clientY - pointer.y - (l.cy - pointer.cy)
          : pointer.clientY - Math.max(l.cy - s.height / 2, Math.min(l.cy + s.height / 2, pointer.clientY));
        var limit = small ? 4 + 0.15 * big : Math.min(10, 3 + 0.04 * big);
        tx.target = rubberBand(ox, limit);
        ty.target = rubberBand(oy, limit);
        light(pointer.clientX, pointer.clientY);
      }
      [tx, ty, press, glow].forEach(function (spring) { spring.step(dt); });

      var elastic = motionLevel() === 'full';
      var grow = elastic ? Math.min(0.16, 8 / big) * press.value : 0;
      var cap = big <= 72 ? 0.2 : 0.12;
      var ex = elastic ? Math.min(cap, 0.5 * Math.abs(tx.value) / s.width + 0.00007 * Math.abs(tx.velocity)) : 0;
      var ey = elastic ? Math.min(cap, 0.5 * Math.abs(ty.value) / s.height + 0.00007 * Math.abs(ty.velocity)) : 0;
      var sx = ((1 + grow) * (1 + ex)) / Math.sqrt(1 + ey);
      var sy = ((1 + grow) * (1 + ey)) / Math.sqrt(1 + ex);
      var moved = elastic && (Math.abs(tx.value) > 0.01 || Math.abs(ty.value) > 0.01);
      var scaled = Math.abs(sx - 1) > 1e-4 || Math.abs(sy - 1) > 1e-4;
      var lit = glow.value > 0.001;

      if (moved || scaled || lit || pointer || keyboard) {
        written = true;
        writeStyle('translate', moved ? tx.value.toFixed(3) + 'px ' + ty.value.toFixed(3) + 'px' : saved.translate);
        writeStyle('scale', scaled ? sx.toFixed(5) + ' ' + sy.toFixed(5) : saved.scale);
        writeStyle('--lg-glow', lit ? glow.value.toFixed(4) : '0');
        writeStyle('--lg-glow-x', glowX.toFixed(2) + 'px');
        writeStyle('--lg-glow-y', glowY.toFixed(2) + 'px');
        writeStyle('--lg-glow-size', Math.max(36, Math.min(180, big * 0.9)).toFixed(1) + 'px');
        if (pointer || keyboard) el.setAttribute('data-glass-pressed', '');
        else el.removeAttribute('data-glass-pressed');
      } else if (written) {
        written = false;
        el.style.translate = saved.translate;
        el.style.scale = saved.scale;
        ['--lg-glow', '--lg-glow-x', '--lg-glow-y', '--lg-glow-size'].forEach(function (n) {
          el.style.removeProperty(n);
        });
        el.removeAttribute('data-glass-pressed');
      }
      var active = Boolean(pointer) || [tx, ty, press, glow].some(function (sp) { return !sp.isSettled(); });
      if (!active) previous = 0;
      return active;
    }

    function loop(now) {
      if (frame(now)) raf = requestAnimationFrame(loop);
      else awake = false;
    }
    function wake() {
      if (awake) return;
      awake = true;
      raf = requestAnimationFrame(loop);
    }

    var listeners = [
      ['pointerdown', down], ['dragstart', drag],
      ['pointerenter', hover], ['pointermove', hover], ['pointerleave', hover],
      ['keydown', key], ['keyup', key], ['focusout', blur],
      ['pointerdown', wake], ['pointerenter', wake], ['keydown', wake]
    ];
    listeners.forEach(function (l) { el.addEventListener(l[0], l[1]); });

    return function dispose() {
      release();
      cancelAnimationFrame(raf);
      awake = false;
      listeners.forEach(function (l) { el.removeEventListener(l[0], l[1]); });
      el.style.translate = saved.translate;
      el.style.scale = saved.scale;
      ['--lg-glow', '--lg-glow-x', '--lg-glow-y', '--lg-glow-size'].forEach(function (n) {
        el.style.removeProperty(n);
      });
      el.removeAttribute('data-glass-pressed');
    };
  }

  /* ---------- Экземпляр стекла ---------- */

  var instances = new WeakMap();

  function numberAttr(el, name, fallback) {
    var raw = el.getAttribute('data-glass-' + name);
    if (raw === null || raw === '') return fallback;
    var n = parseFloat(raw);
    return isFinite(n) ? n : fallback;
  }

  function readOptions(el) {
    var appearance = el.getAttribute('data-glass-appearance') === 'dark' ? 'dark' : 'light';
    var material = el.getAttribute('data-glass-material') === 'regular' ? 'regular' : 'clear';
    var tint = el.getAttribute('data-glass-tint') || '';
    return {
      appearance: appearance,
      material: material,
      refraction: numberAttr(el, 'refraction', null),
      bezel: numberAttr(el, 'bezel', null),
      blur: numberAttr(el, 'blur', 1),
      saturation: numberAttr(el, 'saturation', 1.2),
      brightness: numberAttr(el, 'brightness', 1.05),
      dispersion: numberAttr(el, 'dispersion', 0),
      fallbackBlur: numberAttr(el, 'fallback-blur', 10),
      mode: resolveMode(el.getAttribute('data-glass-mode') || 'auto'),
      interactive: el.hasAttribute('data-glass-interactive'),
      tintKey: tintChannels(tint) ? tint.toLowerCase() : '',
      tint: tintChannels(tint)
    };
  }

  function makeLayer(className) {
    var span = document.createElement('span');
    span.className = 'lg-layer ' + className;
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function init(el) {
    if (!el || instances.has(el)) return;
    var o = readOptions(el);

    // Слои стекла живут внутри элемента под его контентом (z-index:-1
    // в изолированном контексте) — нужен позиционированный элемент
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

    var lens = makeLayer('lg-lens');
    var overlay = makeLayer('lg-overlay');
    var fill = makeLayer('lg-fill');
    var glow = o.interactive ? makeLayer('lg-glow') : null;
    var frag = document.createDocumentFragment();
    [lens, overlay, fill, glow].forEach(function (layer) { if (layer) frag.appendChild(layer); });
    el.insertBefore(frag, el.firstChild);

    var nested = Boolean(el.parentElement && el.parentElement.closest('[data-liquid-glass]'));
    var amount = o.refraction === null ? (nested ? 8 : 18) : o.refraction;
    var heldFilter = null;
    var raf = 0;
    var last = '';

    function build(w, h, radius) {
      var bz = Math.round(o.bezel === null ? Math.min(32, Math.min(w, h) / 2) : o.bezel);
      var planes = { bezel: bz, dark: o.appearance === 'dark', tint: o.tint, tintKey: o.tintKey };
      var outline = squircleOutline(w, h, radius);
      var overlaySrc = overlayURL(w, h, radius, planes);
      var refracting = false;

      if (o.mode === 'refract') {
        var field = fieldURL(w, h, radius, planes);
        if (field) {
          var id = ('lgf' + w + 'x' + h + 'r' + radius + 'b' + bz + 'f' + Math.round(amount * 10) +
            o.appearance.charAt(0) + o.material.charAt(0) + o.tintKey +
            'p' + Math.round(o.dispersion * 100) + (nested ? 'n' : '')).replace(/[^a-zA-Z0-9-]/g, '');
          if (heldFilter !== id) {
            acquireFilter(id, filterMarkup({
              w: w, h: h, field: field, material: o.material, appearance: o.appearance,
              refraction: amount, dispersion: o.dispersion, tint: o.tint, nested: nested
            }));
            if (heldFilter) releaseFilter(heldFilter);
            heldFilter = id;
          }
          refracting = true;
        }
      }
      if (!refracting && heldFilter) {
        releaseFilter(heldFilter);
        heldFilter = null;
      }

      var dark = o.appearance === 'dark';
      var backdrop;
      if (refracting) {
        backdrop = 'url(#' + heldFilter + ')' + (o.blur > 0 ? ' blur(' + o.blur + 'px)' : '');
      } else {
        // Фолбэк: матовое стекло; WebKit сильнее 16px размывает некрасиво
        var engineBlur = detectEngine() === 'webkit' ? Math.min(o.fallbackBlur, 16) : o.fallbackBlur;
        var tone = 'saturate(' + o.saturation + ') brightness(' + (dark ? o.brightness * 0.88 : o.brightness) + ')';
        backdrop = 'blur(' + (o.material === 'regular' ? Math.max(2, engineBlur * 0.5) : engineBlur) + 'px) ' + tone;
      }
      lens.style.backdropFilter = backdrop;
      lens.style.webkitBackdropFilter = backdrop;
      lens.style.clipPath = outline.polygon;
      overlay.style.backgroundImage = overlaySrc ? 'url(' + overlaySrc + ')' : '';

      // Заливка: в фолбэке — молочный слой матового стекла или вуаль
      // тёмного; при преломлении матовость уже запечена в фильтр
      var fillKind = '';
      if (!refracting && o.material === 'regular') fillKind = dark ? 'regular-dark' : 'regular-light';
      else if (!refracting && dark) fillKind = 'veil-frost';
      else if (refracting && o.material === 'clear' && dark) fillKind = 'veil';
      if (fillKind) fill.setAttribute('data-fill', fillKind);
      else fill.removeAttribute('data-fill');
      if (o.tint && fillKind.indexOf('regular') === 0) {
        fill.style.backgroundColor = 'rgb(' + o.tint.map(function (c) { return Math.round(c * 255); }).join(' ') + ' / var(--lg-fill-opacity))';
      }

      el.setAttribute('data-liquid-glass', refracting ? 'refract' : 'frost');
    }

    // offsetWidth не учитывает transform — пружина нажатия не вызывает
    // пересчёт карт
    function measure() {
      raf = 0;
      var w = Math.round(el.offsetWidth);
      var h = Math.round(el.offsetHeight);
      if (w < 2 || h < 2) return;
      var radius = Math.round(resolveRadius(getComputedStyle(el).borderTopLeftRadius, w, h));
      var key = w + '|' + h + '|' + radius;
      if (key === last) return;
      last = key;
      build(w, h, radius);
    }

    var observer = new ResizeObserver(function () {
      if (!raf) raf = requestAnimationFrame(measure);
    });
    observer.observe(el);
    measure();

    var disposeInteraction = o.interactive ? attachInteraction(el) : null;

    instances.set(el, {
      refresh: function () {
        last = '';
        measure();
      },
      destroy: function () {
        observer.disconnect();
        cancelAnimationFrame(raf);
        if (heldFilter) releaseFilter(heldFilter);
        if (disposeInteraction) disposeInteraction();
        [lens, overlay, fill, glow].forEach(function (layer) { if (layer) layer.remove(); });
        el.removeAttribute('data-liquid-glass');
      }
    });
  }

  function refresh(el) {
    var inst = instances.get(el);
    if (inst) inst.refresh();
  }

  function destroy(el) {
    var inst = instances.get(el);
    if (!inst) return;
    inst.destroy();
    instances.delete(el);
  }

  function initAll(root) {
    var scope = root || document;
    if (scope.nodeType === 1 && scope.hasAttribute('data-glass')) init(scope);
    scope.querySelectorAll('[data-glass]').forEach(init);
  }

  // Новые элементы с data-glass (модалки, перестроенные карточки)
  // подхватываются сами, удалённые — освобождают свой фильтр
  function watch() {
    var mo = new MutationObserver(function (records) {
      records.forEach(function (record) {
        record.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) initAll(node);
        });
        record.removedNodes.forEach(function (node) {
          if (node.nodeType !== 1 || node.isConnected) return;
          if (node.hasAttribute('data-glass')) destroy(node);
          node.querySelectorAll('[data-glass]').forEach(destroy);
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  window.LiquidGlass = {
    init: init,
    refresh: refresh,
    destroy: destroy,
    initAll: initAll,
    engine: detectEngine
  };

  function start() {
    initAll(document);
    watch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
