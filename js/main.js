// Изоляция через IIFE — без import/export, ES-модули блокируются CORS на file://
(function () {
  'use strict';

  // Прелоадер — счётчик 0→100, уход шторкой, один раз за сессию
  function initPreloader() {
    var preloader = document.getElementById('preloader');
    if (!preloader) return;

    if (sessionStorage.getItem('st-preloader-shown')) {
      preloader.remove();
      document.dispatchEvent(new CustomEvent('preloader:done'));
      return;
    }

    var counterEl = document.getElementById('preloaderCounter');
    var duration = 1200;
    var start = performance.now();
    var finished = false;
    var removed = false;

    function removeFromDom() {
      if (removed) return;
      removed = true;
      preloader.remove();
    }

    function finish() {
      if (finished) return;
      finished = true;
      sessionStorage.setItem('st-preloader-shown', '1');
      preloader.classList.add('preloader--hidden');
      document.dispatchEvent(new CustomEvent('preloader:done'));
      preloader.addEventListener('transitionend', removeFromDom, { once: true });
      // Подстраховка на случай, если transitionend не сработает (reduced-motion и т.п.)
      setTimeout(removeFromDom, 900);
    }

    function tick(now) {
      if (finished) return;
      var progress = Math.min((now - start) / duration, 1);
      counterEl.textContent = String(Math.round(progress * 100));
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        finish();
      }
    }

    requestAnimationFrame(tick);

    // Предохранитель: если счётчик или загрузка застряли — шторка всё равно уезжает
    setTimeout(finish, 3000);
  }

  // Шапка всегда на месте — прятать при скролле вниз не нужно (правка,
  // ночь 24.09.2026: раньше header--hidden сдвигала её за экран через
  // translateY(-100%) в css/components.css, эффект читался как
  // «улетает наверх»). header--scrolled остаётся — им уплотняется
  // капсула меню при скролле больше 10px.
  function initHeader() {
    var header = document.getElementById('siteHeader');
    if (!header) return;

    window.addEventListener(
      'scroll',
      function () {
        header.classList.toggle('header--scrolled', window.scrollY > 10);
      },
      { passive: true }
    );
  }

  // Правый блок шапки — телефон, пока виден hero, кроссфейд на кнопку
  // "ОБСУДИТЬ ПРОЕКТ", когда hero ушёл за верхний край (иначе кнопка
  // дублирует кнопку в hero на первом экране). docs/05-REVISION-02.md,
  // R9 (дедуп) + R17 (кроссфейд вместо простого скрытия).
  // Мобильное меню — полноэкранный бургер
  function initBurger() {
    var burger = document.getElementById('burgerBtn');
    var menu = document.getElementById('mobileMenu');
    if (!burger || !menu) return;

    function closeMenu() {
      menu.classList.remove('mobile-menu--open');
      burger.setAttribute('aria-expanded', 'false');
    }

    function toggleMenu() {
      var isOpen = menu.classList.toggle('mobile-menu--open');
      burger.setAttribute('aria-expanded', String(isOpen));
    }

    burger.addEventListener('click', toggleMenu);

    menu.querySelectorAll('.mobile-menu__link').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeMenu();
    });
  }

  // Аккордеон услуг — открыта всегда ровно одна строка
  function initAccordion() {
    var items = document.querySelectorAll('.accordion__item');
    if (!items.length) return;

    var scrollTimer = null;

    function openItem(item, trigger) {
      if (item.classList.contains('is-open')) return;

      items.forEach(function (other) {
        other.classList.remove('is-open');
        other.querySelector('.accordion__trigger').setAttribute('aria-expanded', 'false');
      });

      item.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');

      // Раскрытие сдвигает следующие пункты вниз и меняет общую высоту
      // страницы — на узких вьюпортах хватало, чтобы очередной триггер
      // уехал за нижний край экрана и следующий клик проходил мимо
      // (docs/06-REVISION-03.md, R19). Через Lenis, а не голый
      // scrollIntoView — напрямую конфликтует с его RAF-циклом.
      //
      // Откладываем до конца CSS-transition раскрытия (--dur=420ms) —
      // иначе позиции считаются ДО того, как соседние панели
      // схлопнулись/раскрылись. clearTimeout — повторный клик до
      // истечения таймера отменяет ещё не выполненный устаревший расчёт.
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        // ScrollTrigger.refresh() ЗДЕСЬ убран — он и был причиной белой
        // вспышки, не лекарством от неё. Проверено прицельно: вызов
        // refresh() именно в этом месте (после смены высоты страницы от
        // аккордеона, пока Lenis активен) сдвигал АБСОЛЮТНЫЕ пиксельные
        // позиции ВСЕХ ScrollTrigger'ов на величину, равную текущему
        // scrollY (напр. у триггера hero start:0 после refresh()
        // становился start:-1674 при scrollY=1674 — GSAP читал текущий
        // скролл как 0 внутри своего внутреннего пересчёта, хотя
        // window.scrollY возвращал верное значение). Из-за этого прогресс
        // scrub-перехода темы (R24) улетал за пределы [0,1], тема
        // защёлкивалась в светлое состояние мгновенно — и был тот самый
        // белый блик в разделе «Услуги». Без refresh() кэш триггеров
        // просто остаётся немного неточным до следующего естественного
        // resize/refresh — и это не вызывает видимых проблем (проверено).
        //
        // Скроллим, только если раскрытая строка реально не помещается
        // в текущий вьюпорт целиком — раньше скроллило всегда, отсюда
        // и лишний рывок страницы даже когда пункт и так был виден.
        var rect = item.getBoundingClientRect();
        var fitsInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight;
        if (fitsInViewport) return;

        if (window.ST_LENIS) {
          window.ST_LENIS.scrollTo(trigger, { offset: -100, duration: 0.6 });
        } else if (typeof trigger.scrollIntoView === 'function') {
          trigger.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 460);
    }

    items.forEach(function (item) {
      var trigger = item.querySelector('.accordion__trigger');
      var side = item.querySelector('.accordion__side');

      // Кликабельна вся строка (номер+название в <button>, «N направлений»
      // + шеврон в соседнем .accordion__side) — раньше слушатель висел
      // только на .accordion__trigger, правая треть строки не открывала
      // карточку. .accordion__trigger остаётся настоящей <button> для
      // клавиатурной доступности (Tab + Enter/Space); .accordion__side —
      // обычный div, слушатель нужен явно, клавиатурная активация ему
      // не нужна — той же строки уже достаточно через кнопку.
      trigger.addEventListener('click', function () {
        openItem(item, trigger);
      });
      if (side) {
        side.addEventListener('click', function () {
          openItem(item, trigger);
        });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initPreloader();
    initHeader();
    initBurger();
    initAccordion();
  });
})();
