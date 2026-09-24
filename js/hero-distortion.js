// Интерактивное искажение hero-фото по курсору — рябь/линза.
// Итоговая ревизия, 23.09.2026, п.3. IIFE, без import/export (file://).
//
// Реализовано на Canvas2D, НЕ WebGL. Первая версия использовала
// WebGL-текстуру из <img>, но texImage2D бросает
// "The image element contains cross-origin data" для любого
// изображения, загруженного через file:// — браузеры считают его
// непроверяемо cross-origin для ЗАГРУЗКИ ТЕКСТУРЫ (в отличие от обычного
// <img> или обычного canvas 2D drawImage, которые из file:// работают
// нормально). Раз сайт обязан открываться двойным кликом без сервера
// (CLAUDE.md), WebGL-путь здесь недопустим в принципе — не баг конкретного
// браузера, а системное ограничение схемы file://.
// Решение — маленькие плитки без обрезки и без матричных transform
// (простой drawImage) рисуются на отдельный офскрин-канвас, который
// затем целиком накладывается на резкое базовое фото с лёгким
// ctx.filter blur — блюр смешивает края соседних плиток, поэтому
// результат выглядит как гладкая рябь, а не решётка (правка, ночь
// 24.09.2026 — до этого пробовали (1) плоскую сетку независимых
// квадратов CELL=16 без общих вершин — резкие грани на стыках, и
// (2) треугольную mesh-warp сетку с аффинными transform — технически
// работала верно по всей ширине фото (проверено удержанием курсора в
// разных точках), но крупные плоские треугольники читались как грани/
// осколки на контрастных участках фото; сейчас проще и без матричной
// геометрии вообще). Канвас при этом не тайнтится, т.к. пиксели
// обратно не читаются (getImageData/toDataURL не используются).
//
// Полная прогрессивная деградация: touch и prefers-reduced-motion —
// скрипт ничего не делает, остаётся статичный <img> с фильтром (R2).
(function () {
  'use strict';

  function initHeroDistortion() {
    // Диагностика на случай тихого отказа инициализации — раньше при
    // несовпадении medim query или отсутствии элемента функция просто
    // молча завершалась, без единого сообщения в консоли (жалоба:
    // "эффект не виден, непонятно почему" — правка, ночь 24.09.2026).
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (reduceMotion) {
      console.info('[hero-distortion] отключено: prefers-reduced-motion активен — это ожидаемо, не ошибка.');
      return;
    }
    if (!canHover) {
      console.info('[hero-distortion] отключено: устройство не поддерживает hover+точный указатель (touch/трекпад-эмуляция) — это ожидаемо, не ошибка.');
      return;
    }

    var media = document.getElementById('heroMedia');
    var img = document.getElementById('heroMediaImg');
    var canvas = document.getElementById('heroDistortionCanvas');
    if (!media || !img || !canvas) {
      console.warn('[hero-distortion] инициализация не удалась: не найден один из элементов (heroMedia/heroMediaImg/heroDistortionCanvas). Проверьте разметку hero в index.html.');
      return;
    }

    var ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('[hero-distortion] инициализация не удалась: canvas.getContext(\'2d\') вернул null.');
      return;
    }

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = 0, cssH = 0;
    var coverSx = 0, coverSy = 0, coverSw = 0, coverSh = 0; // object-fit: cover в координатах исходника

    var mouseTarget = { x: 0.5, y: 0.5 };
    var mouseCurrent = { x: 0.5, y: 0.5 };
    var strengthTarget = 0;
    var strengthCurrent = 0;
    var startTime = performance.now();
    var rafId = null;

    function resize() {
      var rect = media.getBoundingClientRect();
      cssW = Math.max(1, Math.round(rect.width));
      cssH = Math.max(1, Math.round(rect.height));
      canvas.width = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Офскрин-слой ряби — тот же размер, что у видимого канваса
      warpCanvas.width = canvas.width;
      warpCanvas.height = canvas.height;

      // object-fit: cover — те же вычисления, что браузер делает для img,
      // чтобы искажённая картинка визуально не отличалась обрезкой
      var boxAspect = cssW / cssH;
      var iw = img.naturalWidth || 1;
      var ih = img.naturalHeight || 1;
      var imgAspect = iw / ih;
      if (imgAspect > boxAspect) {
        coverSh = ih;
        coverSw = ih * boxAspect;
        coverSx = (iw - coverSw) / 2;
        coverSy = 0;
      } else {
        coverSw = iw;
        coverSh = iw / boxAspect;
        coverSx = 0;
        coverSy = (ih - coverSh) / 2;
      }
    }

    function onMouseMove(event) {
      var rect = media.getBoundingClientRect();
      mouseTarget.x = (event.clientX - rect.left) / rect.width;
      mouseTarget.y = (event.clientY - rect.top) / rect.height;
      strengthTarget = 1;
    }

    function onMouseLeave() {
      strengthTarget = 0;
    }

    // Переписано с нуля (правка, ночь 24.09.2026) — предыдущая версия на
    // треугольной сетке (affine mesh-warp) была геометрически верна
    // (проверено изолированным тестом на удержании курсора в разных
    // точках фото, включая правый край) — эффект технически работал
    // по всей ширине. Проблема была в другом: крупные плоские
    // треугольники с разным наклоном каждый визуально читались как
    // грани/сколы ("осколки стекла"), особенно на контрастных участках
    // фото. Убрано целиком — вместо треугольников теперь маленькие
    // прямоугольные плитки БЕЗ обрезки и БЕЗ аффинных трансформаций
    // (простой прямой drawImage, никакой матричной геометрии), которые
    // рисуются не сразу на видимый канвас, а на отдельный офскрин-слой,
    // а затем весь слой целиком накладывается на фото с лёгким
    // css-подобным блюром (ctx.filter) — блюр смешивает края соседних
    // плиток друг с другом, поэтому на глаз это выглядит как гладкая
    // рябь, а не сетка. Базовое фото (offscreen НЕ участвует) остаётся
    // идеально чётким везде, где нет искажения — блюрится только сам
    // слой ряби.
    var CELL = 24; // px экрана — размер плитки

    // Офскрин-канвас для слоя ряби — создаётся один раз, пересчитывается
    // в resize() вместе с основным канвасом
    var warpCanvas = document.createElement('canvas');
    var warpCtx = warpCanvas.getContext('2d');

    function render(now) {
      // Догоняющая инерция — курсор "догоняется" плавно, не резко.
      // Увеличена относительно самой первой версии (было 0.08/0.06) —
      // при низких значениях эффект визуально "не успевал" за быстрым
      // движением мыши на большом расстоянии (жалоба — правка, ночь
      // 24.09.2026)
      mouseCurrent.x += (mouseTarget.x - mouseCurrent.x) * 0.28;
      mouseCurrent.y += (mouseTarget.y - mouseCurrent.y) * 0.28;
      strengthCurrent += (strengthTarget - strengthCurrent) * 0.2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      // База — вся картинка одним вызовом, дёшево, остаётся идеально
      // резкой (блюр ниже применяется только к слою ряби поверх неё)
      ctx.drawImage(img, coverSx, coverSy, coverSw, coverSh, 0, 0, cssW, cssH);

      if (strengthCurrent > 0.01) {
        var cx = mouseCurrent.x * cssW;
        var cy = mouseCurrent.y * cssH;
        // Зона влияния — доля от МЕНЬШЕЙ стороны фото, поэтому на любой
        // ширине окна (узкой или широкой) радиус остаётся геометрически
        // предсказуемым, не завязан на абсолютные пиксели
        var radius = Math.min(cssW, cssH) * 0.32;
        var t = (now - startTime) / 1000;

        // Область очистки/блюра — только небольшой квадрат вокруг
        // курсора (с запасом под перекрытие плиток и радиус блюра), а
        // не весь канвас целиком. ctx.filter — дорогая операция; раньше
        // применялся к полному размеру канваса каждый кадр, хотя
        // реальный контент занимал маленькую часть площади — сильно
        // проседал fps (правка, ночь 24.09.2026)
        var pad = 10;
        var bx = Math.max(0, Math.floor(cx - radius - pad));
        var by = Math.max(0, Math.floor(cy - radius - pad));
        var bw = Math.min(cssW, Math.ceil(cx + radius + pad)) - bx;
        var bh = Math.min(cssH, Math.ceil(cy + radius + pad)) - by;

        warpCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        warpCtx.clearRect(bx, by, bw, bh);

        var startCol = Math.floor((cx - radius) / CELL);
        var endCol = Math.ceil((cx + radius) / CELL);
        var startRow = Math.floor((cy - radius) / CELL);
        var endRow = Math.ceil((cy + radius) / CELL);

        for (var row = startRow; row <= endRow; row++) {
          for (var col = startCol; col <= endCol; col++) {
            var baseX = col * CELL;
            var baseY = row * CELL;

            var cellCx = baseX + CELL / 2;
            var cellCy = baseY + CELL / 2;
            var dx = cellCx - cx;
            var dy = cellCy - cy;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > radius) continue; // вне круга — плитка не нужна, база и так верна

            var falloff = 1 - dist / radius;
            falloff = falloff * falloff * (3 - 2 * falloff); // smoothstep — гладкое затухание к краю, без резкой границы
            var ripple = Math.sin(dist * 0.24 - t * 2.4) * 0.5 + 0.5;
            // Амплитуда — тот же множитель, что и в предыдущей версии
            // (явный запрос "минимум в два-три раза" от самой первой
            // версии эффекта)
            var mag = falloff * strengthCurrent * (42 + 38 * ripple);
            var dirX = dist > 0.5 ? dx / dist : 0;
            var dirY = dist > 0.5 ? dy / dist : 0;
            // К центру ("линза"), не от центра — стягивание, не разрыв
            var offX = -dirX * mag;
            var offY = -dirY * mag;

            var srcX = coverSx + (baseX / cssW) * coverSw;
            var srcY = coverSy + (baseY / cssH) * coverSh;
            var srcW = (CELL / cssW) * coverSw;
            var srcH = (CELL / cssH) * coverSh;

            // Плитка рисуется на 3px больше своего слота с каждой
            // стороны — соседние плитки слегка перекрывают друг друга,
            // это плюс блюр ниже и даёт гладкий стык вместо шва
            var overlap = 3;
            warpCtx.drawImage(
              img, srcX, srcY, srcW, srcH,
              baseX + offX - overlap, baseY + offY - overlap,
              CELL + overlap * 2, CELL + overlap * 2
            );
          }
        }

        // Слой ряби накладывается на резкое базовое фото с лёгким
        // блюром только в границах bx/by/bw/bh (не всего канваса) —
        // именно блюр убирает "гранёный" вид отдельных плиток, превращая
        // их в мягкую непрерывную рябь. Источник — сырой буфер warpCanvas
        // в device-пикселях (bx*dpr и т.д.), назначение — те же
        // CSS-координаты под активным dpr-transform ctx
        ctx.save();
        ctx.filter = 'blur(2px)';
        ctx.drawImage(warpCanvas, bx * dpr, by * dpr, bw * dpr, bh * dpr, bx, by, bw, bh);
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    }

    function start() {
      try {
        resize();
        media.classList.add('is-distortion-active');
        media.addEventListener('mousemove', onMouseMove);
        media.addEventListener('mouseleave', onMouseLeave);
        window.addEventListener('resize', resize);
        rafId = requestAnimationFrame(render);
        console.info('[hero-distortion] инициализация успешна, эффект активен.');
      } catch (err) {
        console.warn('[hero-distortion] инициализация упала с ошибкой, эффект отключён:', err);
      }
    }

    if (img.complete && img.naturalWidth) {
      start();
    } else {
      img.addEventListener('load', start, { once: true });
      img.addEventListener('error', function () {
        console.warn('[hero-distortion] фото hero не загрузилось (' + img.src + ') — искажение недоступно без исходного изображения.');
      }, { once: true });
    }
  }

  document.addEventListener('DOMContentLoaded', initHeroDistortion);
})();
