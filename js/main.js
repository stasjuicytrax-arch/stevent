// Поведение интерфейса (без «показных» анимаций — те в js/animations.js).
// IIFE, без import/export: ES-модули блокируются CORS на file://
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof gsap !== 'undefined';

  /* ---------- Прелоадер: счётчик 2008 → 2026, лаймовая шторка ---------- */

  // Флаг ST_PRELOADER_DONE — для подписчиков, которые подключаются позже
  // события (повторный заход в сессии: событие уходит синхронно, ещё до
  // js/animations.js)
  function preloaderDone() {
    window.ST_PRELOADER_DONE = true;
    document.dispatchEvent(new CustomEvent('preloader:done'));
  }

  function initPreloader() {
    var preloader = document.getElementById('preloader');
    if (!preloader) return;

    if (sessionStorage.getItem('st-preloader-shown') || reduceMotion) {
      preloader.remove();
      preloaderDone();
      return;
    }

    var counterEl = document.getElementById('preloaderCounter');
    var FROM = 2008;
    var TO = 2026;
    var duration = 1400;
    var start = performance.now();
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      counterEl.textContent = String(TO);
      sessionStorage.setItem('st-preloader-shown', '1');
      // Короткая пауза на «2026», затем шторка уходит вверх
      setTimeout(function () {
        preloader.classList.add('preloader--hidden');
        preloaderDone();
        setTimeout(function () { preloader.remove(); }, 1200);
      }, 260);
    }

    function tick(now) {
      if (finished) return;
      var t = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      counterEl.textContent = String(Math.round(FROM + (TO - FROM) * eased));
      if (t < 1) requestAnimationFrame(tick);
      else finish();
    }

    requestAnimationFrame(tick);
    setTimeout(finish, 3200); // предохранитель, если rAF застрял
  }

  /* ---------- Шапка: прячется при скролле вниз, возвращается вверх ---------- */

  function initHeader() {
    var header = document.getElementById('siteHeader');
    if (!header) return;
    var lastY = window.scrollY;

    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      var menuOpen = document.body.classList.contains('menu-open');
      header.classList.toggle('header--scrolled', y > 20);
      if (!menuOpen) header.classList.toggle('header--hidden', y > lastY && y > 160);
      lastY = y;
    }, { passive: true });
  }

  /* ---------- «Капля» в капсуле меню: перетекает к пункту ---------- */

  function initNavDrop() {
    var capsule = document.getElementById('navCapsule');
    var drop = document.getElementById('navDrop');
    if (!capsule || !drop) return;
    var links = Array.prototype.slice.call(capsule.querySelectorAll('.nav-capsule__link'));
    var active = null;

    function moveTo(link, instant) {
      if (!link) {
        drop.classList.remove('is-visible');
        return;
      }
      var cRect = capsule.getBoundingClientRect();
      var lRect = link.getBoundingClientRect();
      var x = lRect.left - cRect.left;
      drop.classList.add('is-visible');
      if (hasGsap && !reduceMotion && !instant) {
        // Капля сначала вытягивается к цели, потом догоняет — «перетекание»
        gsap.to(drop, { x: x, width: lRect.width, duration: 0.55, ease: 'elastic.out(1, 0.75)', overwrite: true });
      } else {
        drop.style.transform = 'translateX(' + x + 'px)';
        drop.style.width = lRect.width + 'px';
      }
    }

    links.forEach(function (link) {
      link.addEventListener('mouseenter', function () { moveTo(link); });
    });
    capsule.addEventListener('mouseleave', function () { moveTo(active); });

    // Активный пункт — по секции, которая сейчас в середине экрана
    var sections = links.map(function (link) {
      return document.querySelector(link.getAttribute('href'));
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var i = sections.indexOf(entry.target);
        active = links[i] || null;
        links.forEach(function (l) { l.classList.toggle('is-active', l === active); });
        moveTo(active);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    sections.forEach(function (section) { if (section) observer.observe(section); });

    // Над hero активного пункта нет — капля прячется
    var hero = document.getElementById('hero');
    if (hero) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && entries[0].intersectionRatio > 0.5) {
          active = null;
          links.forEach(function (l) { l.classList.remove('is-active'); });
          moveTo(null);
        }
      }, { threshold: [0.5] }).observe(hero);
    }
  }

  /* ---------- Мобильное меню ---------- */

  function initBurger() {
    var burger = document.getElementById('burgerBtn');
    var menu = document.getElementById('mobileMenu');
    if (!burger || !menu) return;

    var header = document.getElementById('siteHeader');

    function setOpen(open) {
      // Шапка могла уехать при скролле — кнопка закрытия должна быть видна
      if (open && header) header.classList.remove('header--hidden');
      menu.classList.toggle('mobile-menu--open', open);
      document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    }

    burger.addEventListener('click', function () {
      setOpen(!menu.classList.contains('mobile-menu--open'));
    });
    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setOpen(false);
    });
  }

  /* ---------- Плавная прокрутка к якорям через Lenis ---------- */

  function initAnchors() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link || event.defaultPrevented) return;
      var id = link.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target || !window.ST_LENIS) return;
      event.preventDefault();
      window.ST_LENIS.scrollTo(target, { offset: 0, duration: 1.2 });
    });
  }

  /* ---------- Услуги: раскрытие списка направлений (ТЗ 2026) ---------- */

  function initServices() {
    document.querySelectorAll('.service').forEach(function (item) {
      var head = item.querySelector('.service__head');
      head.addEventListener('click', function () {
        var open = !item.classList.contains('is-open');
        item.classList.toggle('is-open', open);
        head.setAttribute('aria-expanded', String(open));
      });
    });
  }

  /* ---------- «Почему мы»: текст карточки раскрывается по клику ---------- */

  function initWhyCards() {
    document.querySelectorAll('.why-card').forEach(function (card) {
      var face = card.querySelector('.why-card__face');
      face.addEventListener('click', function () {
        var open = !card.classList.contains('is-open');
        card.classList.toggle('is-open', open);
        face.setAttribute('aria-expanded', String(open));
      });
    });
  }

  /* ---------- Фильтр портфолио «Для бизнеса / Частные события» ---------- */

  // Плашки «Корпоративный / Частный клиент» в hero ведут сюда же и
  // включают свой фильтр (data-filter-link). Перестройка — GSAP Flip.
  function initPortfolioFilter() {
    var buttons = document.querySelectorAll('.portfolio__filter');
    var cards = Array.prototype.slice.call(document.querySelectorAll('.case-card[data-type]'));
    if (!buttons.length || !cards.length) return;
    var current = 'business';

    function applyFilter(type) {
      if (type === current) return;
      current = type;
      buttons.forEach(function (btn) {
        var on = btn.dataset.filter === type;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      var canFlip = hasGsap && typeof Flip !== 'undefined' && !reduceMotion;
      var state = canFlip ? Flip.getState(cards) : null;
      cards.forEach(function (card) {
        card.hidden = card.dataset.type !== type;
      });
      if (!canFlip) return;

      Flip.from(state, {
        duration: 0.8,
        ease: 'power3.inOut',
        stagger: 0.04,
        absolute: true,
        onEnter: function (els) {
          return gsap.fromTo(els, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.7, ease: 'expo.out', delay: 0.2 });
        },
        onLeave: function (els) {
          return gsap.to(els, { opacity: 0, scale: 0.85, duration: 0.4, ease: 'power2.in' });
        }
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () { applyFilter(btn.dataset.filter); });
    });
    document.querySelectorAll('[data-filter-link]').forEach(function (link) {
      link.addEventListener('click', function () { applyFilter(link.dataset.filterLink); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initPreloader();
    initHeader();
    initNavDrop();
    initBurger();
    initAnchors();
    initServices();
    initWhyCards();
    initPortfolioFilter();
  });
})();
