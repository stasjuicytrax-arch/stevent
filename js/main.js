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
    var list = document.getElementById('servicesList');
    document.querySelectorAll('.service:not(.service--static)').forEach(function (item) {
      var head = item.querySelector('.service__head');
      head.addEventListener('click', function () {
        var open = !item.classList.contains('is-open');
        item.classList.toggle('is-open', open);
        head.setAttribute('aria-expanded', String(open));
        // Человек понял, что строки раскрываются, — плюсы больше не «дышат»
        if (list) list.classList.add('is-touched');
      });
    });
  }


  /* ---------- Направления на главной: «Для бизнеса / Частные события» ---------- */

  // Правка заказчика 28.10.2026: направления не на отдельных страницах,
  // а раскрываются под карточками на главной. Открыт один блок; карточки
  // и переключатель в шапке блока — [data-open-dir]. Ссылка с #business /
  // #private (в т. ч. со старых business.html / private.html) открывает сразу.
  function initDirections() {
    var panels = {
      business: document.getElementById('business'),
      private: document.getElementById('private')
    };
    if (!panels.business || !panels.private) return;

    // Отступ под стеклянную шапку сайта, чтобы она не закрывала переключатель
    function scrollToPanel(panel) {
      if (window.ST_LENIS) window.ST_LENIS.scrollTo(panel, { offset: -96, duration: 1.2 });
      else panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    function open(type, scroll) {
      var panel = panels[type];
      if (!panel) return;
      // inert + нулевая высота (css) вместо hidden — см. .dir-panel[inert]
      Object.keys(panels).forEach(function (key) {
        panels[key].inert = key !== type;
      });
      document.querySelectorAll('[data-open-dir]').forEach(function (el) {
        var on = el.dataset.openDir === type;
        if (el.classList.contains('dir-switch__btn')) {
          el.classList.toggle('is-active', on);
          el.setAttribute('aria-pressed', on ? 'true' : 'false');
        } else {
          el.setAttribute('aria-expanded', on ? 'true' : 'false');
        }
      });
      // Форма заявки: заранее отмечаем, что планируют
      var plan = document.querySelector('#contactForm input[name="plan"][value="' + (type === 'business' ? 'Событие для компании' : 'Частный праздник') + '"]');
      if (plan) plan.checked = true;
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
      if (hasGsap && !reduceMotion) {
        gsap.fromTo(panel, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out', clearProps: 'opacity,visibility,transform' });
      }
      if (scroll) scrollToPanel(panel);
    }

    document.querySelectorAll('[data-open-dir]').forEach(function (el) {
      el.addEventListener('click', function (event) {
        event.preventDefault();
        open(el.dataset.openDir, true);
        if (history.replaceState) history.replaceState(null, '', '#' + el.dataset.openDir);
      });
    });

    var hash = location.hash.replace('#', '');
    if (panels[hash]) {
      open(hash, false);
      // Ждём раскладку и шрифты — иначе прокрутка промахивается
      setTimeout(function () { scrollToPanel(panels[hash]); }, 400);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initPreloader();
    initHeader();
    initAnchors();
    initServices();
    initDirections();
  });
})();
