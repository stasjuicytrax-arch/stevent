// Точечная карта России — docs/05-REVISION-02.md, R15.
// Изоляция через IIFE, без import/export (file://).
(function () {
  'use strict';

  function pluralProjects(n) {
    n = parseInt(n, 10);
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'проект';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'проекта';
    return 'проектов';
  }

  // Список городов слева от карты — итоговая ревизия, 23.09.2026, п.8б.
  // Заменяет плавающие подписи-выноски на карте (собирали коллизии,
  // «висели в воздухе», см. docs/07-REVISION-04.md R25 и её же баг с
  // дёргающейся Москвой). Строится из того же CITIES, что и точки на
  // карте, — порядок гарантированно совпадает (п.8в), без ручного
  // дублирования списка в двух местах.
  function buildCityList(CITIES) {
    var list = document.getElementById('geoCityList');
    if (!list) return;
    list.innerHTML = '';
    CITIES.forEach(function (city, i) {
      var row = document.createElement('div');
      row.className = 'geography__city-row';
      row.innerHTML =
        '<span class="geography__city-num">#' + String(i + 1).padStart(2, '0') + '</span>' +
        '<span class="geography__city-name">' + city.name + '</span>' +
        '<span class="geography__city-count">' + city.count + ' ' + pluralProjects(city.count) + '</span>';
      list.appendChild(row);
    });
  }

  function initGeographyMap() {
    var scene = document.getElementById('geoScene');
    var mapEl = document.getElementById('geoMap');
    var canvas = document.getElementById('geoCanvas');
    // Список городов — assets/data/cities.js (R15: при новых городах от
    // клиента меняется только он, не этот файл)
    var CITIES = window.ST_GEO_CITIES || [];
    if (!scene || !mapEl || !canvas || !window.ST_GEO || !window.ST_GEO_RUSSIA || !CITIES.length) return;

    buildCityList(CITIES);

    var ctx = canvas.getContext('2d');
    var geo = window.ST_GEO;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    // Проецируем полигоны один раз — дальше только линейный пересчёт под canvas
    var projectedPolys = window.ST_GEO_RUSSIA.coordinates.map(function (poly) {
      return poly.map(function (ring) {
        return ring.map(function (pt) {
          var p = geo.project(pt[0], pt[1]);
          return [p.x, p.y];
        });
      });
    });

    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    projectedPolys.forEach(function (poly) {
      poly.forEach(function (ring) {
        ring.forEach(function (pt) {
          if (pt[0] < minX) minX = pt[0];
          if (pt[0] > maxX) maxX = pt[0];
          if (pt[1] < minY) minY = pt[1];
          if (pt[1] > maxY) maxY = pt[1];
        });
      });
    });

    // У Albers в этой ориентации параллелей большая проекционная Y —
    // это север. Экранная Y должна убывать к северу (север сверху),
    // проверяем эмпирически, а не считаем на бумаге и не зашиваем как факт.
    var testNorth = geo.project(100, 80);
    var testSouth = geo.project(100, 41);
    var flipY = testNorth.y > testSouth.y;

    var scale = 1, offX = 0, offY = 0, w = 0, h = 0;
    var dpr = window.devicePixelRatio || 1;

    function toCanvasX(px) {
      return offX + (px - minX) * scale;
    }
    function toCanvasY(py) {
      return flipY ? (offY + (maxY - py) * scale) : (offY + (py - minY) * scale);
    }
    function fromCanvasX(px) {
      return (px - offX) / scale + minX;
    }
    function fromCanvasY(py) {
      return flipY ? (maxY - (py - offY) / scale) : ((py - offY) / scale + minY);
    }

    // Маркеры городов строятся из CITIES, а не хардкодятся в index.html —
    // добавление города клиентом меняет только assets/data/cities.js (R15).
    // Столбик (3D pole) с остриём убран — итоговая ревизия, пункт 2а:
    // это визуально работало как стрелка-выноска от точки к подписи,
    // попросили заменить на интерактивный кружок без соединительной линии.
    function buildMarkers() {
      CITIES.forEach(function (city) {
        if (document.getElementById(city.id)) return;
        var marker = document.createElement('div');
        marker.className = 'geography__marker';
        marker.id = city.id;
        marker.innerHTML = '<span class="geography__marker-dot"></span>';
        mapEl.appendChild(marker);
      });
    }

    var dots = []; // {x, y, dist}
    var cityScreen = []; // {id, px, py} — позиция маркера в локальных координатах .geography__map

    function layout() {
      var rect = scene.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var pad = 16;
      var spanX = maxX - minX || 1;
      var spanY = maxY - minY || 1;
      scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
      offX = (w - spanX * scale) / 2;
      offY = (h - spanY * scale) / 2;

      var step = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--geo-dot-step')) || 8;

      dots = [];
      var cx = w / 2, cy = h / 2;
      var maxDist = Math.sqrt(cx * cx + cy * cy) || 1;
      for (var py = pad; py <= h - pad; py += step) {
        for (var px = pad; px <= w - pad; px += step) {
          var projX = fromCanvasX(px);
          var projY = fromCanvasY(py);
          if (geo.pointInMultiPolygon(projX, projY, projectedPolys)) {
            var dist = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy)) / maxDist;
            dots.push({ x: px, y: py, dist: dist });
          }
        }
      }

      cityScreen = CITIES.map(function (city) {
        var p = geo.project(city.lon, city.lat);
        return { id: city.id, px: toCanvasX(p.x), py: toCanvasY(p.y) };
      });

      cityScreen.forEach(function (c) {
        var el = document.getElementById(c.id);
        if (el) el.style.transform = 'translate(' + c.px + 'px, ' + c.py + 'px)';
      });
    }

    var dotR = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--geo-dot-d')) / 2 || 1.25;
    var waveDur = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--geo-wave-dur')) || 1.2) * 1000;

    // Цвета — из токенов редизайна (docs/13 §6: чёрная карта, контуры
    // тонкой линией, точки приглушённые, города лаймовые)
    var rootStyle = getComputedStyle(document.documentElement);
    var dotColor = rootStyle.getPropertyValue('--c-text-faint').trim() || 'rgba(242,241,234,.32)';
    var lineColor = rootStyle.getPropertyValue('--c-text-dim').trim() || 'rgba(242,241,234,.58)';

    // Контур страны тонкой линией — проявляется вместе с волной точек
    function drawOutline(alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.lineJoin = 'round';
      projectedPolys.forEach(function (poly) {
        poly.forEach(function (ring) {
          ctx.beginPath();
          ring.forEach(function (pt, i) {
            var x = toCanvasX(pt[0]);
            var y = toCanvasY(pt[1]);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.stroke();
        });
      });
      ctx.restore();
    }

    function drawDots(progress) {
      // progress = 1 — статично (без волны, напр. reduced-motion или кадр вне анимации)
      ctx.clearRect(0, 0, w, h);
      drawOutline(Math.min(1, progress * 1.6));
      ctx.fillStyle = dotColor;
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        var local = 1;
        if (progress < 1) {
          // Задержка каждой точки пропорциональна расстоянию от центра,
          // общая длительность --geo-wave-dur (R15)
          var delay = d.dist * 0.6;
          var t = (progress - delay) / (1 - delay < 0.01 ? 0.01 : (1 - delay));
          local = Math.max(0, Math.min(1, t));
        }
        if (local <= 0) continue;
        var eased = 1 - Math.pow(1 - local, 3); // ease-out кубическая, без внешней зависимости
        var r = dotR * (0.4 + 0.6 * eased);
        ctx.globalAlpha = eased;
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Лаймовые точки городов загораются по очереди после волны
    function lightCities(stepMs) {
      CITIES.forEach(function (city, i) {
        setTimeout(function () {
          var el = document.getElementById(city.id);
          if (el) el.classList.add('is-lit');
        }, i * stepMs);
      });
    }

    function playWave() {
      if (reduceMotion) {
        drawDots(1);
        lightCities(0);
        return;
      }
      setTimeout(function () { lightCities(260); }, waveDur * 0.6);
      var start = null;
      function frame(ts) {
        if (start === null) start = ts;
        var progress = Math.min(1, (ts - start) / waveDur);
        drawDots(progress);
        if (progress < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    // Волна проходит один раз, при первом входе секции в вьюпорт
    var waveStarted = false;
    function maybeStartWave() {
      if (waveStarted) return;
      var rect = scene.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        waveStarted = true;
        playWave();
      }
    }

    // === Реакция на курсор — наклон ±4°, задержка 300ms, только hover:hover ===
    var baseX = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--geo-tilt-x')) || 52;
    var baseZ = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--geo-tilt-z')) || -8;
    var reactive = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--geo-tilt-reactive')) || 4;
    var curX = baseX, curZ = baseZ, targetX = baseX, targetZ = baseZ;
    var tiltRunning = false;
    var perspectiveStr = getComputedStyle(document.documentElement).getPropertyValue('--geo-perspective').trim();

    // Подписи у точек убраны целиком — итоговая ревизия, 23.09.2026, п.8а:
    // весь прежний механизм (updateLabels/computeLabelOffsets/
    // resolveLabelCollisions) существовал только ради их позиционирования
    // и разведения коллизий. Названия и числа городов теперь только в
    // списке слева (buildCityList выше) — там нет 3D-проекции, коллизий
    // в принципе быть не может.
    function applyTilt() {
      mapEl.style.transform = 'perspective(' + perspectiveStr + ') rotateX(' + curX + 'deg) rotateZ(' + curZ + 'deg)';
    }

    // --geo-tilt-delay (300ms, R15) — это не debounce-задержка перед
    // стартом, а характерное время «доезда» наклона до курсора: карта
    // должна СЛЕДОВАТЬ за мышью с лёгким отставанием, непрерывно, а не
    // ждать остановки курсора и потом дёргаться. Раньше здесь был
    // setTimeout с clearTimeout на каждый mousemove — классический
    // debounce, который никогда не срабатывал, пока пользователь водит
    // мышью не останавливаясь (а это и есть естественный способ
    // проверить, следит ли карта за курсором) — баг R20, карта визуально
    // не реагировала на курсор. Экспоненциальный коэффициент даёт тот же
    // «вес» 300ms, но как постоянную времени плавного следования.
    var tiltLerp = 1 - Math.exp(-16.67 / (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--geo-tilt-delay')) || 300));

    function tiltFrame() {
      curX += (targetX - curX) * tiltLerp;
      curZ += (targetZ - curZ) * tiltLerp;
      applyTilt();
      if (Math.abs(targetX - curX) > 0.01 || Math.abs(targetZ - curZ) > 0.01) {
        requestAnimationFrame(tiltFrame);
      } else {
        tiltRunning = false;
      }
    }

    function startTiltAnim() {
      if (!tiltRunning) {
        tiltRunning = true;
        requestAnimationFrame(tiltFrame);
      }
    }

    function onMouseMove(e) {
      var rect = scene.getBoundingClientRect();
      var nx = (e.clientX - rect.left) / rect.width * 2 - 1; // -1..1
      var ny = (e.clientY - rect.top) / rect.height * 2 - 1;
      targetX = baseX + (-ny) * reactive;
      targetZ = baseZ + nx * reactive;
      startTiltAnim();
    }

    function onMouseLeave() {
      targetX = baseX;
      targetZ = baseZ;
      startTiltAnim();
    }

    if (canHover && !reduceMotion) {
      scene.addEventListener('mousemove', onMouseMove);
      scene.addEventListener('mouseleave', onMouseLeave);
    }

    buildMarkers();
    layout();
    drawDots(reduceMotion ? 1 : 0);
    applyTilt();

    window.addEventListener('resize', function () {
      layout();
      drawDots(waveStarted || reduceMotion ? 1 : 0);
      applyTilt();
    });

    window.addEventListener('scroll', maybeStartWave, { passive: true });
    maybeStartWave();
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Ждём кадр после разметки, чтобы .geography__scene уже имел размеры
    requestAnimationFrame(initGeographyMap);
  });
})();
