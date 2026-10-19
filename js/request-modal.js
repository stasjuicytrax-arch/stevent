// Модалка заявки — открывается с кнопки «ОБСУДИТЬ МЕРОПРИЯТИЕ» (hero)
// вместо скролла к #contacts. Пересобрана с нуля (правка, ночь
// 24.09.2026): один класс .is-open переключает CSS-переход появления
// (см. css/components.css) — без FLIP-морфинга и без built-in тайминга
// на rect кнопки-триггера, это была причина повторяющихся поломок.
// IIFE, без import/export (file://).
(function () {
  'use strict';

  var modal, form, closeBtn, backdrop, titleEl;
  var formController = null;
  var lastFocusedEl = null;
  var TITLE_DEFAULT = 'Обсудить мероприятие';
  var TITLE_SUCCESS = 'Спасибо, заявка отправлена!';

  function getFocusable(container) {
    var nodes = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return Array.prototype.filter.call(nodes, function (el) {
      return !el.disabled && el.offsetParent !== null;
    });
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      closeModal();
      return;
    }
    if (event.key === 'Tab') {
      var focusable = getFocusable(modal);
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  function openModal(triggerEl) {
    lastFocusedEl = triggerEl || document.activeElement;

    form.reset();
    form.classList.remove('is-sending', 'is-success', 'is-error');
    modal.classList.remove('request-modal--success');
    titleEl.textContent = TITLE_DEFAULT;
    if (formController) formController.resetIcon();

    modal.hidden = false;
    document.body.classList.add('no-scroll');
    if (window.ST_LENIS) window.ST_LENIS.stop();
    document.addEventListener('keydown', handleKeydown);

    // rAF — переключить класс после того, как браузер применит
    // hidden=false, иначе CSS-transition не запустится (переход из
    // display:none в display:flex не анимируется)
    requestAnimationFrame(function () {
      modal.classList.add('is-open');
    });

    closeBtn.focus();
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    if (window.ST_LENIS) window.ST_LENIS.start();
    document.removeEventListener('keydown', handleKeydown);
    if (lastFocusedEl) lastFocusedEl.focus({ preventScroll: true });

    // ждём завершения CSS-перехода панели, чтобы закрытие тоже было
    // видно, потом убираем из потока полностью
    setTimeout(function () {
      modal.hidden = true;
    }, 320);
  }

  function initRequestModal() {
    modal = document.getElementById('requestModal');
    if (!modal) return;

    backdrop = document.getElementById('requestModalBackdrop');
    closeBtn = document.getElementById('requestModalClose');
    form = document.getElementById('requestForm');
    titleEl = document.getElementById('requestModalTitle');

    document.querySelectorAll('a.hero__cta').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        openModal(btn);
      });
    });

    // Для кнопки в конце кейса (js/gallery.js)
    window.ST_openRequestModal = openModal;

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    if (window.ST_initContactForm) {
      formController = window.ST_initContactForm(form, {
        onSuccess: function () {
          titleEl.textContent = TITLE_SUCCESS;
          modal.classList.add('request-modal--success');
        },
      });
    }
  }

  document.addEventListener('DOMContentLoaded', initRequestModal);
})();
