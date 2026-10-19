// GSAP + ScrollTrigger — строго по docs/02-DESIGN-SYSTEM.md §8.
// Одна кривая (--ease), три длительности (--dur-fast/--dur/--dur-slow).
// prefers-reduced-motion отключает всё целиком.
(function () {
  'use strict';

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    return; // vendor не загрузился — сайт остаётся рабочим и без анимаций
  }

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) {
    return; // всё мгновенно, ничего не анимируем программно
  }

  gsap.registerPlugin(ScrollTrigger);

  var EASE = 'power2.out';
  if (typeof CustomEase !== 'undefined') {
    gsap.registerPlugin(CustomEase);
    // Ровно --ease из tokens.css: cubic-bezier(.22, 1, .36, 1)
    CustomEase.create('st-ease', '0.22, 1, 0.36, 1');
    EASE = 'st-ease';
  }

  var DUR_FAST = 0.2; // --dur-fast
  var DUR = 0.42; // --dur
  var DUR_SLOW = 0.8; // --dur-slow
  var LINE_STAGGER = 0.06; // 60ms — docs/02-DESIGN-SYSTEM.md §8, п.1

  // Прелоадер мог уже отработать до подписки (см. js/main.js) — тогда сразу
  function onPreloaderDone(fn) {
    if (window.ST_PRELOADER_DONE) {
      fn();
      return;
    }
    document.addEventListener('preloader:done', fn, { once: true });
  }

  var isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // js/gallery.js запускается раньше этого файла (порядок в index.html),
  // но реально использует эти значения только внутри openModal() — а её
  // вызывают уже после того, как весь этот IIFE успел выполниться (все
  // deferred-скрипты отрабатывают до первого DOMContentLoaded). Раннего
  // return при отсутствии GSAP/reduced-motion достаточно — тогда
  // window.ST_MOTION просто не появится, и gallery.js откатится
  // к мгновенному открытию модалки (docs/05-REVISION-02.md, R16.9).
  window.ST_MOTION = { ease: EASE, durFast: DUR_FAST, dur: DUR, durSlow: DUR_SLOW };

  /* ---------- 1. Reveal текста по строкам ---------- */

  function splitIntoLines(el) {
    var text = el.textContent;
    var words = text.trim().split(/\s+/);
    el.textContent = '';

    var wordEls = words.map(function (word, i) {
      var span = document.createElement('span');
      span.className = 'reveal-word';
      span.style.display = 'inline-block';
      span.textContent = word;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      return span;
    });

    // Группируем слова по строкам через фактический offsetTop после рендера
    var lines = [];
    var currentTop = null;
    var currentLine = [];
    wordEls.forEach(function (span) {
      var top = span.offsetTop;
      if (currentTop === null || Math.abs(top - currentTop) > 1) {
        if (currentLine.length) lines.push(currentLine);
        currentLine = [span];
        currentTop = top;
      } else {
        currentLine.push(span);
      }
    });
    if (currentLine.length) lines.push(currentLine);

    // Пересобираем: каждая строка — свой блок с overflow:hidden,
    // внутри — обёртка, которую и анимируем (маска по строкам)
    el.textContent = '';
    var lineWrappers = lines.map(function (lineWords, idx) {
      var lineBox = document.createElement('span');
      lineBox.className = 'reveal-line';
      lineBox.style.display = 'block';
      lineBox.style.overflow = 'hidden';

      var inner = document.createElement('span');
      inner.className = 'reveal-line__inner';
      inner.style.display = 'block';

      lineWords.forEach(function (span, i) {
        inner.appendChild(span);
        if (i < lineWords.length - 1) inner.appendChild(document.createTextNode(' '));
      });

      lineBox.appendChild(inner);
      el.appendChild(lineBox);
      if (idx < lines.length - 1) el.appendChild(document.createTextNode(' '));
      return inner;
    });

    return lineWrappers;
  }

  function initTextReveal() {
    var targets = document.querySelectorAll('[data-reveal="lines"]');

    targets.forEach(function (el) {
      var lines;
      try {
        lines = splitIntoLines(el);
      } catch (err) {
        return; // не смогли разбить — оставляем текст как есть, не ломаем страницу
      }
      if (!lines.length) return;

      gsap.set(lines, { y: 24, opacity: 0 });

      var isInHero = !!el.closest('.hero');

      var tween = function () {
        gsap.to(lines, {
          y: 0,
          opacity: 1,
          duration: DUR_SLOW,
          ease: EASE,
          stagger: LINE_STAGGER,
        });
      };

      if (isInHero) {
        onPreloaderDone(function () {
          gsap.delayedCall(DUR_SLOW * 0.6, tween);
        });
      } else {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 85%',
          once: true,
          onEnter: tween,
        });
      }
    });
  }

  /* ---------- 2. Reveal блоков (карточки, статы) — та же маска, без строк ---------- */

  function initBlockReveal() {
    // Группируем по общему родителю, чтобы соседи внутри одного блока
    // анимировались одной пачкой со stagger, а не по одному глобально
    var parents = new Set();
    document.querySelectorAll('[data-reveal="block"]').forEach(function (el) {
      parents.add(el.parentElement);
    });

    parents.forEach(function (parent) {
      var items = Array.prototype.filter.call(parent.children, function (child) {
        return child.hasAttribute('data-reveal') && child.getAttribute('data-reveal') === 'block';
      });
      if (!items.length) return;

      gsap.set(items, { y: 24, opacity: 0 });

      // Свой шаг стаггера у родителя (например, портфолио — 80ms, R14),
      // по умолчанию — 60ms, как у reveal по строкам
      var staggerAttr = parent.getAttribute('data-reveal-stagger');
      var stagger = staggerAttr ? parseInt(staggerAttr, 10) / 1000 : LINE_STAGGER;

      ScrollTrigger.create({
        trigger: parent,
        start: 'top 85%',
        once: true,
        onEnter: function () {
          gsap.to(items, {
            y: 0,
            opacity: 1,
            duration: DUR_SLOW,
            ease: EASE,
            stagger: stagger,
          });
        },
      });
    });
  }

  /* ---------- 3. Hero-остров — разворот при загрузке ---------- */

  function initHeroReveal() {
    var island = document.querySelector('.hero__island');
    if (!island) return;

    gsap.set(island, { scale: 0.96, transformOrigin: '50% 50%' });

    onPreloaderDone(function () {
      gsap.to(island, { scale: 1, duration: DUR_SLOW, ease: EASE });
    });
  }

  /* ---------- 4. Счётчики-одометр (R16.6) ----------
     Не интерполяция числа текстом, а вертикальная прокрутка колонки
     цифр 0–9 до нужной, как в механическом счётчике — буквально из ТЗ. */

  function buildOdometer(el, digitsStr, suffix) {
    el.textContent = '';
    el.classList.add('odometer');
    var reels = [];

    digitsStr.split('').forEach(function (ch) {
      var mask = document.createElement('span');
      mask.className = 'odometer__digit';
      var strip = document.createElement('span');
      strip.className = 'odometer__strip';
      for (var i = 0; i <= 9; i++) {
        var d = document.createElement('span');
        d.className = 'odometer__num';
        d.textContent = String(i);
        strip.appendChild(d);
      }
      mask.appendChild(strip);
      el.appendChild(mask);
      reels.push({ strip: strip, target: parseInt(ch, 10) });
    });

    if (suffix) {
      var suf = document.createElement('span');
      suf.className = 'odometer__suffix';
      suf.textContent = suffix;
      el.appendChild(suf);
    }

    return reels;
  }

  function initCounters() {
    document.querySelectorAll('.stat__number').forEach(function (el) {
      var match = el.textContent.trim().match(/^(\d+)(\D*)$/);
      if (!match) return;
      var reels = buildOdometer(el, match[1], match[2] || '');

      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: function () {
          reels.forEach(function (reel, i) {
            // yPercent — доля от высоты самого strip'а (10 цифр), поэтому
            // один шаг вниз по цифре = ровно 10%, без ручного пересчёта в px
            gsap.to(reel.strip, {
              yPercent: -reel.target * 10,
              duration: DUR_SLOW,
              ease: EASE,
              delay: i * 0.05,
            });
          });
        },
      });
    });
  }

  /* ---------- 4б. Линия над маркером секции — прочерчивается (R12) ---------- */

  function initMarkerLines() {
    document.querySelectorAll('.section-marker').forEach(function (marker) {
      ScrollTrigger.create({
        trigger: marker,
        start: 'top 90%',
        once: true,
        onEnter: function () {
          marker.classList.add('is-drawn');
        },
      });
    });
  }

  /* Декоративная линия «География» — тот же приём отрисовки, что у
     initMarkerLines(), просто другой элемент и путь (итоговая ревизия,
     вечер 23.09.2026, п.2 доп. промпта про references/4.jpg). */
  function initGeoDecoLine() {
    var line = document.querySelector('.geography__deco-line');
    if (!line) return;
    ScrollTrigger.create({
      trigger: line,
      start: 'top 80%',
      once: true,
      onEnter: function () {
        line.classList.add('is-drawn');
      },
    });
  }

  /* ---------- 5. Портфолио ----------
     Горизонтальный скролл с пиннингом убран полностью — заказчик хочет
     видеть все кейсы сразу (docs/05-REVISION-02.md, R14). Карточки теперь
     появляются как обычные [data-reveal="block"] с задержкой 80ms —
     см. initBlockReveal() и data-reveal-stagger="80" на #portfolioGrid. */

  /* ---------- 6. Magnetic-кнопка — убрана полностью (правка, ночь
     24.09.2026) ----------
     Раньше магнитный эффект (GSAP quickTo по x/y, притяжение к курсору)
     применялся ко ВСЕМ .btn--primary — hero, шапка, форма, модалка —
     из-за этого обычные кнопки "дёргались"/сдвигались при наведении.
     Магнитный эффект — приём для пунктов НАВИГАЦИИ (капсула меню),
     он уже отдельно и точечно реализован в initMagneticNavLinks() ниже
     (селектор .header__link, не .btn--primary) — эту функцию трогать
     не нужно, она и раньше не затрагивала обычные кнопки. */

  /* ---------- 6б. Капсула меню — скользящая подсветка (R10) ---------- */

  function initNavCapsule() {
    var capsule = document.getElementById('navCapsule');
    var highlight = document.getElementById('navHighlight');
    if (!capsule || !highlight) return;

    var links = capsule.querySelectorAll('.header__link');
    if (!links.length) return;

    function moveTo(link) {
      var capsuleRect = capsule.getBoundingClientRect();
      var linkRect = link.getBoundingClientRect();
      gsap.to(highlight, {
        x: linkRect.left - capsuleRect.left,
        width: linkRect.width,
        opacity: 1,
        duration: DUR,
        ease: EASE,
      });
    }

    links.forEach(function (link) {
      link.addEventListener('mouseenter', function () { moveTo(link); });
    });

    capsule.addEventListener('mouseleave', function () {
      gsap.to(highlight, { opacity: 0, duration: DUR, ease: EASE });
    });
  }

  /* ---------- R16.1. Lenis — инерционный скролл ---------- */

  function initLenis() {
    if (typeof Lenis === 'undefined') return null;

    var lenis = new Lenis({
      duration: 1.1,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t));
      },
      // .stop() на открытии модалки (js/gallery.js, js/request-modal.js)
      // останавливает обновление позиции, но Lenis по умолчанию всё
      // равно перехватывает и глушит wheel-событие на уровне всего
      // документа — до нативно скроллящихся модалок (.case-modal,
      // .request-modal__panel, overflow-y:auto) оно просто не доходило.
      // prevent — единственный надёжный способ вообще не трогать
      // wheel/touch внутри этих контейнеров, независимо от stop/start.
      prevent: function (node) {
        return !!(node.closest && node.closest('.case-modal, .request-modal__panel'));
      },
    });

    // Обязательная связка со ScrollTrigger (R16.1) — иначе триггеры
    // считают позицию по нативному скроллу, который Lenis подменяет
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    window.ST_LENIS = lenis; // js/gallery.js вызывает stop()/start() на модалке
    return lenis;
  }

  /* ---------- R16.2. Hero-заголовок по буквам ---------- */

  function initHeroLetters() {
    var title = document.querySelector('.hero__title');
    if (!title) return;

    var text = title.textContent;
    var words = text.split(' ');
    title.textContent = '';
    title.setAttribute('aria-label', text);

    // Буквы группируются по словам (.hero__word, display:inline-block) —
    // иначе перенос строки может случиться между любыми двумя буквами
    // (каждая — свой inline-block), ломая слово посередине. Поймано на
    // реальном скриншоте 390px: «ST EVE / NT».
    var letters = [];
    words.forEach(function (word, wi) {
      var wordWrap = document.createElement('span');
      wordWrap.className = 'hero__word';
      wordWrap.setAttribute('aria-hidden', 'true');

      word.split('').forEach(function (ch) {
        var mask = document.createElement('span');
        mask.className = 'hero__letter-mask';

        var inner = document.createElement('span');
        inner.className = 'hero__letter';
        inner.textContent = ch;

        mask.appendChild(inner);
        wordWrap.appendChild(mask);
        letters.push(inner);
      });

      title.appendChild(wordWrap);
      if (wi < words.length - 1) title.appendChild(document.createTextNode(' '));
    });

    gsap.set(letters, { y: '100%' });

    onPreloaderDone(function () {
      gsap.to(letters, {
        y: '0%',
        duration: DUR_SLOW,
        ease: EASE,
        stagger: 0.04, // R16.2, буквально
      });
    });
  }

  /* ---------- R16.3. Уход hero при скролле (scrub) ---------- */

  function initHeroScrub() {
    var hero = document.querySelector('.hero');
    var island = document.querySelector('.hero__island');
    if (!hero || !island) return;

    // immediateRender:false — не даёт этому твину применить своё "from"
    // сразу при создании (что перебило бы ещё не отыгравший scale .96→1
    // из initHeroReveal); значения включаются только когда реально
    // изменится scroll-прогресс триггера.
    gsap.fromTo(island,
      { scale: 1, opacity: 1, filter: 'blur(0px)' },
      {
        scale: 0.94,
        opacity: 0.5,
        filter: 'blur(4px)',
        ease: 'none',
        immediateRender: false,
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      }
    );
  }

  /* ---------- R16.4. Смена темы (светлая секция) ---------- */
  //
  // Раньше здесь был scroll-scrub переход цвета body между --bg и
  // --bg-light, привязанный к абсолютной пиксельной позиции .why-us
  // через ScrollTrigger. Убран целиком — итоговая ревизия, 23.09.2026,
  // п.6: ломался трижды подряд (пиксельные позиции устаревали при любом
  // изменении высоты страницы — открытии аккордеона, и даже
  // ScrollTrigger.refresh() для починки этого же самого бага сам вносил
  // рассинхронизацию с Lenis). У каждой секции и так свой фиксированный
  // фон через CSS (--bg по умолчанию с body, --bg-light явно на .why-us)
  // — никакой JS-интерполяции не нужно вообще, значит и ломаться нечему.

  /* ---------- R16.7. Маска раскрытия секций ---------- */

  function initSectionMasks() {
    // .hero — уже открывается собственным сценарием загрузки (R16.2/п.3
    // дизайн-системы), .why-us — уже вырезана диагональю (clip-path:
    // polygon), второй clip-path заменил бы, а не сложился с первым
    var sections = document.querySelectorAll('main > section:not(.hero):not(.why-us)');

    sections.forEach(function (section) {
      gsap.set(section, { clipPath: 'inset(0 0 100% 0)' });
      ScrollTrigger.create({
        trigger: section,
        start: 'top 90%',
        once: true,
        onEnter: function () {
          gsap.to(section, { clipPath: 'inset(0% 0 0% 0)', duration: DUR_SLOW, ease: EASE });
        },
      });
    });
  }

  /* ---------- R16.8. Магнитные пункты меню ---------- */

  function initMagneticNavLinks() {
    if (!isFinePointer) return;

    var RADIUS = 24;
    var MAX_OFFSET = 4;

    document.querySelectorAll('.header__link').forEach(function (link) {
      var xTo = gsap.quickTo(link, 'x', { duration: DUR_FAST, ease: EASE });
      var yTo = gsap.quickTo(link, 'y', { duration: DUR_FAST, ease: EASE });

      link.addEventListener('mousemove', function (event) {
        var rect = link.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = event.clientX - cx;
        var dy = event.clientY - cy;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist > RADIUS) return;
        var pull = 1 - dist / RADIUS;
        xTo((dx / dist) * MAX_OFFSET * pull);
        yTo((dy / dist) * MAX_OFFSET * pull);
      });

      link.addEventListener('mouseleave', function () {
        xTo(0);
        yTo(0);
      });
    });
  }

  /* ---------- 7. Курсор-точка ---------- */

  function initCursorDot() {
    if (!isFinePointer) return;
    var dot = document.getElementById('cursorDot');
    if (!dot) return;

    var xTo = gsap.quickTo(dot, 'x', { duration: DUR_FAST, ease: EASE });
    var yTo = gsap.quickTo(dot, 'y', { duration: DUR_FAST, ease: EASE });
    var scaleTo = gsap.quickTo(dot, 'scale', { duration: DUR_FAST, ease: EASE });

    window.addEventListener('mousemove', function (event) {
      xTo(event.clientX);
      yTo(event.clientY);
    });

    var clickableSelector = 'a, button, [role="button"], input, textarea, select, label';

    document.addEventListener('mouseover', function (event) {
      // Карточка портфолио — крупнее, чем обычные интерактивные элементы (R14)
      if (event.target.closest('.case-card')) {
        scaleTo(8); // 8px → 64px
      } else if (event.target.closest(clickableSelector)) {
        scaleTo(6); // 8px → 48px
      }
    });
    document.addEventListener('mouseout', function (event) {
      if (event.target.closest('.case-card') || event.target.closest(clickableSelector)) {
        scaleTo(1);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.fonts.ready.then(function () {
      initTextReveal();
      initBlockReveal();
    }).catch(function () {
      initTextReveal();
      initBlockReveal();
    });

    initLenis();
    initHeroReveal();
    initHeroLetters();
    initHeroScrub();
    initCounters();
    initMarkerLines();
    initGeoDecoLine();
    initSectionMasks();
    initMagneticNavLinks();
    initCursorDot();
    if (isFinePointer) initNavCapsule();
  });
})();
