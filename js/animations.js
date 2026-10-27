// Движение сайта — docs/13-REDESIGN-LIME.md §6. GSAP 3.15 + ScrollTrigger +
// SplitText + Flip + Lenis, всё локально. У каждой секции свой приём —
// одинаковый reveal у соседних секций запрещён (§7).
// prefers-reduced-motion: скрипт не выполняется вовсе — разметка и CSS
// уже в конечном видимом состоянии, скрытые стартовые состояния ставит
// только этот файл.
(function () {
  'use strict';

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  gsap.registerPlugin(ScrollTrigger);
  if (typeof SplitText !== 'undefined') gsap.registerPlugin(SplitText);
  if (typeof Flip !== 'undefined') gsap.registerPlugin(Flip);

  var EASE = 'expo.out';
  var EASE_SNAP = 'power4.inOut';
  var DUR = 1.1;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var mobile = window.matchMedia('(max-width: 767px)').matches;

  // Для модалки кейса (js/gallery.js — FLIP обложки из карточки)
  window.ST_MOTION = { ease: EASE, durFast: 0.25, dur: 0.6, durSlow: 1 };

  function onPreloaderDone(fn) {
    if (window.ST_PRELOADER_DONE) {
      fn();
      return;
    }
    document.addEventListener('preloader:done', fn, { once: true });
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* ---------- Lenis: плавный скролл, все триггеры привязаны к нему ---------- */

  var lenis = null;

  function initLenis() {
    if (typeof Lenis === 'undefined') return;
    lenis = new Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      // Внутри модалок колесо должно скроллить их, а не страницу
      prevent: function (node) {
        return Boolean(node.closest && node.closest('.case-modal, .request-modal__panel, .mobile-menu'));
      }
    });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.ST_LENIS = lenis; // gallery.js / request-modal.js: stop()/start()
  }

  // Скорость скролла px/кадр (Lenis знает её точно, без него — по разнице)
  var lastScroll = window.scrollY;
  var nativeVelocity = 0;
  gsap.ticker.add(function () {
    nativeVelocity = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
  });

  function scrollVelocity() {
    return lenis ? lenis.velocity : nativeVelocity;
  }

  /* ---------- Маркеры секций: линия дорисовывается ---------- */

  function initSectionTags() {
    $$('.section-tag').forEach(function (tagEl) {
      gsap.fromTo(tagEl, { '--tag-line': 0 }, {
        '--tag-line': 1,
        duration: 1.4,
        ease: EASE,
        scrollTrigger: { trigger: tagEl, start: 'top 90%', once: true }
      });
    });
  }

  /* ---------- HERO: буквы из-под маски, фото, шлейф, параллакс ---------- */

  function initHero() {
    var hero = $('#hero');
    if (!hero) return;
    var title = $('.hero__title', hero);
    var photo = $('#heroPhoto');
    var visual = $('#heroVisual');
    var chars = [];

    if (title && typeof SplitText !== 'undefined') {
      var split = new SplitText(title, { type: 'words,chars', mask: 'chars', wordsClass: 'hero__word', charsClass: 'hero__char' });
      chars = split.chars;
      gsap.set(chars, { yPercent: 115 });
    }

    var lead = $$('.hero__lead, .hero__actions', hero);
    var plaques = $$('.hero__plaque, .hero__card', hero);
    gsap.set(lead, { autoAlpha: 0, y: 30, filter: 'blur(8px)' });
    gsap.set(plaques, { autoAlpha: 0, y: 40 });
    if (photo) gsap.set(photo, { clipPath: 'inset(100% 0% 0% 0% round 24px)' });
    gsap.set($('#heroImg'), { scale: 1.3 });
    gsap.set($('.hero__glow', hero), { scale: 0.3, autoAlpha: 0 });

    onPreloaderDone(function () {
      var tl = gsap.timeline({ delay: 0.15 });
      tl.to(chars, { yPercent: 0, duration: 1.2, ease: EASE, stagger: 0.025 }, 0)
        .to(photo, { clipPath: 'inset(0% 0% 0% 0% round 24px)', duration: 1.4, ease: EASE_SNAP }, 0.1)
        .to('#heroImg', { scale: 1, duration: 2, ease: EASE }, 0.1)
        .to($('.hero__glow', hero), { scale: 1, autoAlpha: 1, duration: 1.8, ease: EASE }, 0.5)
        .to(lead, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1, ease: EASE, stagger: 0.1 }, 0.55)
        .to(plaques, { autoAlpha: 1, y: 0, duration: 1, ease: EASE, stagger: 0.12 }, 0.85);
    });

    // Гигантская контурная надпись едет при скролле
    gsap.to('.hero__outline', {
      xPercent: -18,
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
    });

    // Фото уходит медленнее страницы — глубина
    if (visual) {
      gsap.to(visual, {
        yPercent: 12,
        ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true }
      });
    }

    if (fine) {
      initHeroTrail();
      initHeroParallax();
    }
  }

  // Моушн-шлейф (приём addco/kozyuk, §5): 3 копии фото позади смещаются
  // против движения — сильнее при быстрой мыши или быстром скролле
  function initHeroTrail() {
    var trails = $$('.hero__trail');
    if (!trails.length) return;
    var mouseV = 0;
    var lastX = null;
    var energy = 0;

    if (fine) {
      $('#hero').addEventListener('mousemove', function (event) {
        if (lastX !== null) mouseV += event.clientX - lastX;
        lastX = event.clientX;
      });
    }

    var setters = trails.map(function (el) {
      return { x: gsap.quickSetter(el, 'x', 'px'), o: gsap.quickSetter(el, 'opacity') };
    });
    var resting = true;

    function tick() {
      var v = mouseV * 0.6 + scrollVelocity() * 1.4;
      mouseV *= 0.82;
      energy += (v - energy) * 0.12;
      // В покое ничего не пишем: каждая запись перерисовывала фото и
      // заставляла пересчитывать стекло поверх него
      if (Math.abs(energy) < 0.05 && Math.abs(v) < 0.05) {
        if (!resting) {
          energy = 0;
          setters.forEach(function (s) { s.x(0); s.o(0); });
          resting = true;
        }
        return;
      }
      resting = false;
      var mag = Math.min(1, Math.abs(energy) / 40);
      setters.forEach(function (s, i) {
        s.x(-energy * (i + 1) * 1.6);
        s.o(mag * (0.42 - i * 0.12));
      });
    }

    // Считаем только пока hero виден
    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top bottom',
      end: 'bottom top',
      onToggle: function (self) {
        if (self.isActive) gsap.ticker.add(tick);
        else gsap.ticker.remove(tick);
      }
    });
  }

  // Фото слегка следует за мышью (10–20px), свечение — навстречу
  function initHeroParallax() {
    var hero = $('#hero');
    var photo = $('#heroPhoto');
    var glow = $('.hero__glow');
    if (!photo) return;
    var px = gsap.quickTo(photo, 'x', { duration: 1, ease: 'power3.out' });
    var py = gsap.quickTo(photo, 'y', { duration: 1, ease: 'power3.out' });
    var gx = glow ? gsap.quickTo(glow, 'x', { duration: 1.4, ease: 'power3.out' }) : null;
    var gy = glow ? gsap.quickTo(glow, 'y', { duration: 1.4, ease: 'power3.out' }) : null;

    hero.addEventListener('mousemove', function (event) {
      var r = hero.getBoundingClientRect();
      var nx = (event.clientX - r.left) / r.width - 0.5;
      var ny = (event.clientY - r.top) / r.height - 0.5;
      px(nx * 18);
      py(ny * 14);
      if (gx) {
        gx(nx * -40);
        gy(ny * -30);
      }
    });
    hero.addEventListener('mouseleave', function () {
      px(0); py(0);
      if (gx) { gx(0); gy(0); }
    });
  }

  /* ---------- Бегущие ленты: скорость и наклон от скорости скролла ---------- */

  // Лента едет сама; скролл добавляет скорость, наклоняет её, а скролл
  // вверх разворачивает направление
  function velocityMarquee(root, opts) {
    var track = $('.marquee__track', root);
    var group = $('.marquee__group', root);
    if (!track || !group) return;
    var base = opts.speed;
    var dir = opts.reverse ? -1 : 1;
    var x = 0;
    var skewTo = opts.skew ? gsap.quickTo(track, 'skewX', { duration: 0.4, ease: 'power3.out' }) : null;
    var setX = gsap.quickSetter(track, 'x', 'px');
    // Ширина группы меряется на ресайзе, а не на каждом кадре — чтение
    // offsetWidth в тикере форсировало перерасчёт раскладки 60 раз в секунду
    var width = group.offsetWidth || 1;
    window.addEventListener('resize', function () { width = group.offsetWidth || 1; });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { width = group.offsetWidth || 1; });

    function tick(time, delta) {
      var v = opts.react ? scrollVelocity() : 0;
      if (opts.react && Math.abs(v) > 0.5) dir = (v > 0 ? 1 : -1) * (opts.reverse ? -1 : 1);
      var speed = base + Math.min(Math.abs(v) * 0.6, 24);
      x -= speed * dir * (delta / 16.67);
      x = ((x % width) - width) % width; // бесшовный цикл в [-width, 0)
      setX(x);
      if (skewTo) skewTo(Math.max(-12, Math.min(12, -v * 0.35)));
    }

    // Лента вне экрана не крутится
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) gsap.ticker.add(tick);
      else gsap.ticker.remove(tick);
    }).observe(root);
  }

  function initMarquees() {
    $$('.tape--lime').forEach(function (el) { velocityMarquee(el, { speed: 1.4, react: true, skew: true }); });
    $$('.tape--dark').forEach(function (el) { velocityMarquee(el, { speed: 1.1, react: true, skew: true, reverse: true }); });
    $$('.clients__row').forEach(function (el) {
      velocityMarquee(el, { speed: 0.7, reverse: el.classList.contains('clients__row--reverse') });
    });
  }

  /* ---------- О НАС: слова заливаются по скроллу, фото шторкой ---------- */

  function initAbout() {
    var manifest = $('#aboutManifest');
    if (manifest && typeof SplitText !== 'undefined') {
      var words = [];
      $$('.about__words', manifest).forEach(function (el) {
        words = words.concat(new SplitText(el, { type: 'words', wordsClass: 'about__word' }).words);
      });
      gsap.fromTo(words, { color: 'rgb(242 241 234 / .14)' }, {
        color: 'rgb(242 241 234 / 1)',
        ease: 'none',
        stagger: 0.1,
        scrollTrigger: { trigger: manifest, start: 'top 80%', end: 'bottom 45%', scrub: true }
      });
      gsap.fromTo($$('.about__pill', manifest), { scale: 0, rotate: -12 }, {
        scale: 1,
        rotate: 0,
        ease: 'back.out(2)',
        stagger: 0.2,
        scrollTrigger: { trigger: manifest, start: 'top 75%', end: 'center 50%', scrub: true }
      });
    }

    // Фото основателей «проявляются» шторкой снизу вверх
    $$('.founder__photo').forEach(function (frame, i) {
      var img = $('img', frame);
      gsap.timeline({ scrollTrigger: { trigger: frame, start: 'top 85%', once: true }, delay: i * 0.15 })
        .fromTo(frame, { clipPath: 'inset(100% 0% 0% 0% round 20px)' }, { clipPath: 'inset(0% 0% 0% 0% round 20px)', duration: 1.3, ease: EASE_SNAP })
        .fromTo(img, { scale: 1.35 }, { scale: 1, duration: 1.8, ease: EASE }, 0);
    });

    // Цифры целей докручиваются
    $$('.goal__num[data-count]').forEach(function (el) {
      var target = parseInt(el.dataset.count, 10);
      var suffix = el.dataset.suffix || '';
      var state = { v: 0 };
      el.textContent = '0' + suffix;
      gsap.to(state, {
        v: target,
        duration: 2,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onUpdate: function () { el.textContent = Math.round(state.v) + suffix; }
      });
    });
  }

  /* ---------- УСЛУГИ: строки «прочерчиваются», картинка за курсором ---------- */

  function initServices() {
    var rows = $$('.service');
    rows.forEach(function (row, i) {
      gsap.timeline({ scrollTrigger: { trigger: row, start: 'top 88%', once: true } })
        .fromTo(row, { '--row-line': 0 }, { '--row-line': 1, duration: 1.2, ease: EASE }, 0)
        .fromTo($$('.service__num, .service__name, .service__count', row), { x: -60, autoAlpha: 0 }, {
          x: 0, autoAlpha: 1, duration: 1, ease: EASE, stagger: 0.06
        }, 0.1 + i * 0.03);
    });

    if (!fine || mobile) return;
    var follow = $('#followImg');
    var list = $('#servicesList');
    if (!follow || !list) return;
    var img = $('img', follow);
    var fx = gsap.quickTo(follow, 'x', { duration: 0.6, ease: 'power3.out' });
    var fy = gsap.quickTo(follow, 'y', { duration: 0.6, ease: 'power3.out' });
    var fr = gsap.quickTo(follow, 'rotate', { duration: 0.8, ease: 'power3.out' });
    var lastX = 0;

    list.addEventListener('mousemove', function (event) {
      fx(event.clientX);
      fy(event.clientY);
      fr(Math.max(-14, Math.min(14, (event.clientX - lastX) * 0.6)));
      lastX = event.clientX;
    });
    rows.forEach(function (row) {
      row.addEventListener('mouseenter', function () {
        img.src = row.dataset.followImg;
        follow.classList.add('is-visible');
      });
      row.addEventListener('mouseleave', function () {
        follow.classList.remove('is-visible');
      });
    });
  }

  /* ---------- ПОЧЕМУ МЫ: стопка вразброс разлетается в ряд ---------- */

  function initWhyUs() {
    var wrap = $('#whyCards');
    if (!wrap) return;
    var cards = $$('.why-card', wrap);
    var ROT = [-14, 9, -5];
    var OFF_Y = [30, -20, 10];

    // Стартовая позиция — все карточки в центре контейнера, стопкой
    function toCenter(card) {
      var w = wrap.getBoundingClientRect();
      var c = card.getBoundingClientRect();
      return (w.left + w.width / 2) - (c.left + c.width / 2) - (gsap.getProperty(card, 'x') || 0);
    }
    function toMiddleY(card) {
      var w = wrap.getBoundingClientRect();
      var c = card.getBoundingClientRect();
      return (w.top + w.height / 2) - (c.top + c.height / 2) - (gsap.getProperty(card, 'y') || 0);
    }

    gsap.fromTo(cards, {
      x: function (i, el) { return toCenter(el); },
      y: function (i, el) { return toMiddleY(el) + OFF_Y[i]; },
      rotate: function (i) { return ROT[i]; },
      scale: 0.92
    }, {
      x: 0,
      y: 0,
      rotate: function (i) { return mobile ? 0 : [-2, 1.5, -1][i]; },
      scale: 1,
      ease: 'power2.out',
      stagger: 0.08,
      scrollTrigger: {
        trigger: wrap,
        start: 'top 85%',
        end: 'center 55%',
        scrub: 0.8,
        invalidateOnRefresh: true
      }
    });

    gsap.fromTo('.why-us__bg-title', { xPercent: 8 }, {
      xPercent: -8,
      ease: 'none',
      scrollTrigger: { trigger: '.why-us', start: 'top bottom', end: 'bottom top', scrub: true }
    });

    // Цифры докручиваются, когда карточки встают в ряд
    $$('.why-card__big', wrap).forEach(function (el) {
      var m = el.textContent.match(/^(\D*)(\d+)(\D*)$/);
      if (!m) return;
      var target = parseInt(m[2], 10);
      var from = target > 1000 ? target - 30 : 0;
      var state = { v: from };
      gsap.to(state, {
        v: target,
        duration: 1.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: wrap, start: 'center 70%', once: true },
        onUpdate: function () { el.textContent = m[1] + Math.round(state.v) + m[3]; }
      });
    });
  }

  /* ---------- ПОРТФОЛИО: плитки бенто «раскрываются» из центра ---------- */

  function initPortfolio() {
    var cards = $$('.case-card');
    gsap.set(cards, { clipPath: 'inset(14% 14% 14% 14% round 20px)' });
    gsap.set($$('.case-card__media img'), { scale: 1.3 });
    ScrollTrigger.batch(cards, {
      start: 'top 90%',
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, { clipPath: 'inset(0% 0% 0% 0% round 20px)', duration: 1.2, ease: EASE_SNAP, stagger: 0.1 });
        gsap.to(batch.map(function (c) { return $('img', c); }), { scale: 1, duration: 1.6, ease: EASE, stagger: 0.1 });
      }
    });
    // Скрытые фильтром карточки ScrollTrigger не видит — показываем их сразу,
    // иначе после переключения фильтра они остались бы схлопнутыми
    cards.forEach(function (card) {
      if (card.hidden) {
        gsap.set(card, { clipPath: 'inset(0% 0% 0% 0% round 20px)' });
        gsap.set($('img', card), { scale: 1 });
      }
    });
  }

  /* ---------- ГАЛЕРЕЯ: веер раскрывается от скролла с глубиной ---------- */

  function initFan() {
    var stage = $('#fanStage');
    if (!stage) return;
    gsap.fromTo('#fanTrack', { rotateX: 38, scale: 0.78, yPercent: 12 }, {
      rotateX: 0,
      scale: 1,
      yPercent: 0,
      ease: 'none',
      scrollTrigger: { trigger: stage, start: 'top bottom', end: 'center 55%', scrub: true }
    });
  }

  /* ---------- ГЕОГРАФИЯ: названия городов «набираются» контуром ---------- */

  function initGeography() {
    var list = $('#geoCityList');
    if (!list) return;
    // Строки строит js/map.js в DOMContentLoaded + rAF — ждём их
    requestAnimationFrame(function () {
      var rows = $$('.geography__city-row', list);
      gsap.fromTo(rows, { clipPath: 'inset(0% 100% 0% 0%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 1.1,
        ease: EASE_SNAP,
        stagger: 0.09,
        scrollTrigger: { trigger: list, start: 'top 85%', once: true }
      });
      gsap.fromTo($$('.geography__stat-num'), { yPercent: 100, autoAlpha: 0 }, {
        yPercent: 0,
        autoAlpha: 1,
        duration: 1,
        ease: EASE,
        stagger: 0.1,
        scrollTrigger: { trigger: '.geography__stats', start: 'top 88%', once: true }
      });
    });
  }

  /* ---------- КОНТАКТЫ: лаймовый остров раскрывается на весь экран ---------- */

  function initContacts() {
    var island = $('#contacts');
    if (!island) return;
    gsap.fromTo(island, { clipPath: 'inset(6% 8% 0% 8% round 64px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 32px)',
      ease: 'none',
      scrollTrigger: { trigger: island, start: 'top bottom', end: 'top 25%', scrub: true }
    });

    var title = $('.contacts__title', island);
    if (title && typeof SplitText !== 'undefined') {
      var split = new SplitText(title, { type: 'lines', mask: 'lines', linesClass: 'contacts__line' });
      gsap.fromTo(split.lines, { yPercent: 110 }, {
        yPercent: 0,
        duration: 1.2,
        ease: EASE,
        stagger: 0.1,
        scrollTrigger: { trigger: title, start: 'top 85%', once: true }
      });
    }
  }

  /* ---------- ФУТЕР: буквы ST EVENT выезжают снизу по одной ---------- */

  function initFooter() {
    var letters = $$('.footer__letter');
    if (!letters.length) return;
    gsap.fromTo(letters, { yPercent: 105 }, {
      yPercent: 0,
      ease: 'none',
      stagger: 0.06,
      scrollTrigger: { trigger: '#footerGiant', start: 'top bottom', end: 'bottom bottom', scrub: 0.6 }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initLenis();
    // Разбивка текста на буквы/слова — после загрузки шрифтов, иначе
    // SplitText меряет строки по запасному шрифту
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () {
      initHero();
      initAbout();
      initContacts();
      ScrollTrigger.refresh();
    });
    initSectionTags();
    initMarquees();
    initServices();
    initWhyUs();
    initPortfolio();
    initFan();
    initGeography();
    initFooter();
  });
})();
