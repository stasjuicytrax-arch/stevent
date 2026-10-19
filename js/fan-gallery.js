// Секция-галерея «веер карточек» — доп. промпт, ночь 24.09.2026.
// Воспроизводит визуальный эффект присланного React-примера на чистом
// JS + GSAP (уже подключён локально, assets/vendor/gsap.min.js), без
// сборки и модулей — тот же IIFE-паттерн, что у остальных js/*.js.
// Обложки — те же 8 файлов assets/portfolio/*/cover.*, что и в разделе
// «Портфолио» (js/gallery.js CASES); список здесь короче (только то,
// что нужно карточке-обложке), не полный дубль данных кейса.
(function () {
  'use strict';

  var CASES = [
    { slug: 'generations', name: 'GenerationS', ext: 'jpg' },
    { slug: 'promobot', name: 'Promobot Talks', ext: 'jpg' },
    { slug: 'bitva-robotov', name: 'Битва роботов', ext: 'jpg' },
    { slug: 'kron', name: 'СП-Крон', ext: 'jpg' },
    { slug: 'importservice', name: 'Импортсервис', ext: 'jpg' },
    { slug: 'unikorn', name: 'UJIN', ext: 'png' },
    { slug: 'vypusknoy', name: 'Выпускной школа 22', ext: 'jpg' },
    { slug: 'ibiza', name: 'Ibiza Party', ext: 'jpg' },
    { slug: 'hogvarts', name: 'Хогвартс', ext: 'jpg' },
    { slug: 'svadba', name: 'Свадьба Дарьи и Алексея', ext: 'jpg' },
  ];

  function initFanGallery() {
    var stage = document.getElementById('fanStage');
    var track = document.getElementById('fanTrack');
    var dotsWrap = document.getElementById('fanDots');
    var prevBtn = document.getElementById('fanPrev');
    var nextBtn = document.getElementById('fanNext');
    if (!stage || !track || typeof gsap === 'undefined') return;

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var total = CASES.length;
    var activeIndex = 0;
    var hoverIndex = -1;
    var cardEls = [];
    var dotEls = [];

    // Карточки и точки-пагинация — строим один раз из CASES
    CASES.forEach(function (c, i) {
      var card = document.createElement('div');
      card.className = 'fan-gallery__card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', c.name);
      card.innerHTML =
        '<img src="assets/portfolio/' + c.slug + '/cover.' + c.ext + '" alt="' + c.name + '" loading="lazy">' +
        '<div class="fan-gallery__card-overlay"><span class="fan-gallery__card-name">' + c.name + '</span></div>';

      card.addEventListener('click', function () { goTo(i); });
      card.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          goTo(i);
        }
      });
      card.addEventListener('mouseenter', function () {
        hoverIndex = i;
        layout();
      });
      card.addEventListener('mouseleave', function () {
        hoverIndex = -1;
        layout();
      });

      // Стартовое состояние для входной анимации — карточки «влетают»
      // в веер из центра при появлении секции, не возникают мгновенно
      gsap.set(card, { opacity: 0, scale: .3, y: 40, x: 0, rotate: 0 });

      track.appendChild(card);
      cardEls.push(card);

      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'fan-gallery__dot';
      dot.setAttribute('aria-label', 'Показать: ' + c.name);
      dot.addEventListener('click', function () { goTo(i); });
      dotsWrap.appendChild(dot);
      dotEls.push(dot);
    });

    // Кратчайшее кольцевое смещение — карточки «закольцованы», у стрелок
    // нет тупика с краю (проще и приятнее в использовании, чем жёсткий
    // список с остановкой на первом/последнем кейсе)
    function wrappedOffset(i) {
      var raw = i - activeIndex;
      var half = total / 2;
      while (raw > half) raw -= total;
      while (raw < -half) raw += total;
      return raw;
    }

    function layout() {
      var stageW = stage.clientWidth || 800;
      // Множители пересчитываются от реальной ширины сцены (и реальной
      // ширины карточки — читаем её из CSS, не дублируем число) при
      // каждом вызове, чтобы веер заполнял ширину блока, но самая
      // дальняя видимая карточка (offset 3, scale 1-3*0.15=0.55)
      // гарантированно не вылезала за пределы сцены. Раньше xStep
      // считался только от stageW без учёта cardW — при увеличенных
      // карточках (доп. промпт, ночь 24.09.2026) это уводило веер за
      // границы блока на всех ширинах, кроме самой широкой (проверено
      // на 1920/1440/1024/768/390, overflow был везде кроме 1920).
      var scaleStep = 0.15;
      // offsetWidth, не getComputedStyle(--fan-card-w) — кастомное
      // свойство возвращается как строка "clamp(...)", не число;
      // offsetWidth даёт реальную раскладочную ширину и не зависит от
      // уже применённого GSAP transform:scale() (transform не меняет
      // layout-размер, только визуальный)
      var cardW = (cardEls[0] && cardEls[0].offsetWidth) || stageW * 0.15;
      var farScale = 1 - 3 * scaleStep;
      var margin = 12;
      var maxXStep = (stageW / 2 - (cardW * farScale) / 2 - margin) / 3;
      var xStep = Math.max(24, Math.min(maxXStep, stageW * 0.12));
      var yStep = Math.max(8, Math.min(20, stageW * 0.014));
      var angleStep = stageW < 480 ? 9 : 13;
      var hoverOffset = hoverIndex === -1 ? null : wrappedOffset(hoverIndex);

      cardEls.forEach(function (card, i) {
        var offset = wrappedOffset(i);
        var abs = Math.abs(offset);
        var isHovered = hoverOffset !== null && offset === hoverOffset && offset !== 0;
        var isHoverNeighbor = hoverOffset !== null && (offset === hoverOffset - 1 || offset === hoverOffset + 1);

        var visible = abs <= 3;
        // Смещение считаем от офсета, зажатого в ±3 (не от реального,
        // который у 8 карточек доходит до ±4) — иначе невидимая (opacity:0)
        // карточка всё равно уезжала далеко за viewport своим transform:
        // translateX и раздувала document.scrollWidth, включая
        // горизонтальный скролл страницы, хотя ничего видимого не
        // торчало (та же природа бага, что была с водяным знаком в
        // модалке — абсолютно спозиционированный элемент вне рамок
        // родителя считается в scrollWidth независимо от opacity).
        var clampedAbs = Math.min(abs, 3);
        var clampedOffset = offset === 0 ? 0 : (offset > 0 ? clampedAbs : -clampedAbs);
        var x = clampedOffset * xStep;
        var y = clampedAbs * yStep;
        var rot = clampedOffset * angleStep;
        var scale = Math.max(0.42, 1 - clampedAbs * scaleStep);

        // Наведение на боковую карточку — она приподнимается и немного
        // увеличивается, соседние раздвигаются, освобождая ей место
        if (isHovered) {
          y -= 16;
          scale += 0.08;
        }
        if (isHoverNeighbor) {
          x += offset > hoverOffset ? 14 : -14;
        }

        var opacity = visible ? (offset === 0 ? 1 : Math.max(0.32, 1 - abs * 0.22)) : 0;
        var zIndex = offset === 0 ? 100 : (isHovered ? 90 : 50 - abs);

        gsap.to(card, {
          x: x, y: y, rotate: rot, scale: scale,
          opacity: opacity,
          zIndex: zIndex,
          duration: reduceMotion ? 0 : 0.7,
          ease: 'power3.out',
          overwrite: 'auto',
        });

        card.classList.toggle('fan-gallery__card--active', offset === 0);
        card.style.pointerEvents = visible ? 'auto' : 'none';
      });

      dotEls.forEach(function (dot, i) {
        dot.classList.toggle('fan-gallery__dot--active', i === activeIndex);
      });
    }

    function goTo(i) {
      activeIndex = ((i % total) + total) % total;
      layout();
    }

    prevBtn.addEventListener('click', function () { goTo(activeIndex - 1); });
    nextBtn.addEventListener('click', function () { goTo(activeIndex + 1); });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { layout(); }, 100);
    });

    // Появление при загрузке — тот же приём, что у остальных блоков
    // (data-reveal="block"): секция целиком проявляется через
    // initSectionMasks() в js/animations.js (clip-path), здесь отдельно
    // не дублируем — веер и так «влетает» из своего начального layout(),
    // если секция появится во вьюпорте до первого вызова layout().
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.create({
        trigger: stage,
        start: 'top 85%',
        once: true,
        onEnter: function () { layout(); },
      });
    } else {
      layout();
    }
  }

  document.addEventListener('DOMContentLoaded', initFanGallery);
})();
