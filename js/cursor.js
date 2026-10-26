// Кастомный курсор — docs/13-REDESIGN-LIME.md §6: лаймовая точка 10px
// (mix-blend-mode: difference), над [data-cursor="view"] — круг 90px
// «СМОТРЕТЬ», магнитный эффект у кнопок. Только мышь, без
// prefers-reduced-motion. IIFE, без модулей (file://).
(function () {
  'use strict';

  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduce) return;

  var MAGNET_SELECTOR = '.btn, [data-magnetic]';
  var MAGNET_PULL = 0.28; // доля смещения кнопки за курсором
  var MAGNET_MAX = 14; // px

  function init() {
    var cursor = document.createElement('div');
    cursor.className = 'cursor is-hidden';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<div class="cursor__dot"><span class="cursor__label">СМОТРЕТЬ</span></div>';
    document.body.appendChild(cursor);
    document.documentElement.classList.add('has-cursor');

    // Плавное следование: GSAP quickTo, без него — прямая запись
    var hasGsap = typeof gsap !== 'undefined';
    var moveX = hasGsap ? gsap.quickTo(cursor, 'x', { duration: 0.35, ease: 'power3.out' }) : null;
    var moveY = hasGsap ? gsap.quickTo(cursor, 'y', { duration: 0.35, ease: 'power3.out' }) : null;

    function place(x, y) {
      if (hasGsap) {
        moveX(x);
        moveY(y);
      } else {
        cursor.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
      }
    }

    document.addEventListener('mousemove', function (event) {
      cursor.classList.remove('is-hidden');
      place(event.clientX, event.clientY);
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      cursor.classList.add('is-hidden');
    });

    // Режим «СМОТРЕТЬ» — делегированием, чтобы работало и для карточек,
    // которые строятся скриптами позже (веер, модалки)
    document.addEventListener('mouseover', function (event) {
      var view = event.target.closest('[data-cursor="view"]');
      cursor.classList.toggle('is-view', Boolean(view));
    });

    // Магнит: кнопка чуть тянется за курсором и пружинит обратно
    document.querySelectorAll(MAGNET_SELECTOR).forEach(function (el) {
      if (!hasGsap) return;
      var toX = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      var toY = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      el.addEventListener('mousemove', function (event) {
        var rect = el.getBoundingClientRect();
        var dx = (event.clientX - rect.left - rect.width / 2) * MAGNET_PULL;
        var dy = (event.clientY - rect.top - rect.height / 2) * MAGNET_PULL;
        toX(Math.max(-MAGNET_MAX, Math.min(MAGNET_MAX, dx)));
        toY(Math.max(-MAGNET_MAX, Math.min(MAGNET_MAX, dy)));
      });
      el.addEventListener('mouseleave', function () {
        toX(0);
        toY(0);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
