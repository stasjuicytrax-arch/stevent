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

  /* ---------- Шапка-пилюля (рецепт DIGITAL EVENTS, раздел 5) ----------
     Десктоп: при скролле вниз на 80px сжимается до «логотип + бургер»,
     при скролле вверх на 40px раскрывается. Мобильный: всегда сжатая,
     бургер открывает полноэкранное меню. */

  var desktopQuery = window.matchMedia('(min-width: 1024px)');

  function initHeader() {
    var header = document.getElementById('siteHeader');
    var pill = document.getElementById('navPill');
    var burger = document.getElementById('burgerBtn');
    var menu = document.getElementById('mobileMenu');
    if (!header || !pill || !burger) return;
    var logo = pill.querySelector('.nav-pill__logo');

    // Разница полной и сжатой ширины — на неё сужается подложка и
    // сдвигается пилюля (css/sections.css, --nav-collapse)
    function measure() {
      if (!desktopQuery.matches) {
        pill.style.removeProperty('--nav-collapse');
        return;
      }
      var cs = getComputedStyle(pill);
      var collapsed = parseFloat(cs.paddingLeft) + logo.offsetWidth +
        parseFloat(cs.columnGap) + burger.offsetWidth + parseFloat(cs.paddingRight);
      pill.style.setProperty('--nav-collapse', Math.max(0, pill.offsetWidth - collapsed) + 'px');
    }

    function setCollapsed(on) {
      header.classList.toggle('is-collapsed', on);
    }

    var lastY = window.scrollY;
    var down = 0;
    var up = 0;
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      var dy = y - lastY;
      lastY = y;
      if (y < 80) {
        down = up = 0;
        setCollapsed(false);
        return;
      }
      if (dy > 0) {
        down += dy;
        up = 0;
        if (down > 80) setCollapsed(true);
      } else if (dy < 0) {
        up -= dy;
        down = 0;
        if (up > 40) setCollapsed(false);
      }
    }, { passive: true });

    function setMenuOpen(open) {
      if (!menu) return;
      menu.classList.toggle('mobile-menu--open', open);
      document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    }

    // На десктопе бургер раскрывает пилюлю обратно, на телефоне — меню
    burger.addEventListener('click', function () {
      if (desktopQuery.matches) {
        down = 0;
        setCollapsed(false);
        return;
      }
      setMenuOpen(!menu.classList.contains('mobile-menu--open'));
    });
    if (menu) {
      menu.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () { setMenuOpen(false); });
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') setMenuOpen(false);
    });

    measure();
    window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener('load', measure);

    // Активный пункт — по секции в середине экрана
    var links = Array.prototype.slice.call(pill.querySelectorAll('.nav-pill__link'));
    var sections = links.map(function (link) { return document.querySelector(link.getAttribute('href')); });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var active = links[sections.indexOf(entry.target)];
        links.forEach(function (l) { l.classList.toggle('is-active', l === active); });
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    sections.forEach(function (section) { if (section) observer.observe(section); });
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
    initAnchors();
    initServices();
    initWhyCards();
    initPortfolioFilter();
  });
})();
