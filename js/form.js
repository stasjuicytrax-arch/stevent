// Форма обратной связи — маска телефона, валидация, состояния.
// Отправка не подключена: console.log + экран успеха (TZ, секция 08).
// Общая логика для двух форм на странице (инлайн-форма в разделе
// «Контакты» и модалка заявки, docs/08-REVISION-05.md R27) — поля
// ищутся по [name=...] внутри переданной формы, а не по хардкоженным
// id, чтобы не дублировать эту функцию для каждой формы отдельно.
(function () {
  'use strict';

  function formatPhone(value) {
    var digits = value.replace(/\D/g, '');
    if (digits.charAt(0) === '7' || digits.charAt(0) === '8') {
      digits = digits.slice(1);
    }
    digits = digits.slice(0, 10);

    var out = '+7';
    if (digits.length > 0) out += ' (' + digits.slice(0, 3);
    if (digits.length >= 3) out += ')';
    if (digits.length > 3) out += ' ' + digits.slice(3, 6);
    if (digits.length > 6) out += '-' + digits.slice(6, 8);
    if (digits.length > 8) out += '-' + digits.slice(8, 10);
    return out;
  }

  function isPhoneComplete(value) {
    return value.replace(/\D/g, '').length === 11;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function setFieldError(input, errorEl, message) {
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      if (errorEl) errorEl.textContent = message;
    } else {
      input.removeAttribute('aria-invalid');
      if (errorEl) errorEl.textContent = '';
    }
  }

  // Три состояния иконки кнопки — один SVG, innerHTML подменяется
  // целиком (не накладываются друг на друга через opacity/position).
  // Спиннер крутится вращением самого .btn__icon (CSS-класс
  // is-spinning), галочка дорисовывается через её собственный
  // stroke-dashoffset-переход (см. css/components.css) — правка,
  // ночь 24.09.2026, п.1.
  var ICON_ARROW = '<path d="M5 11L11 5M11 5H6.5M11 5V9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';
  var ICON_SPINNER = '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="28" stroke-dashoffset="21"/>';
  var ICON_CHECK = '<path class="btn__icon-check-path" d="M4 8.5L6.5 11L12 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>';

  function setSubmitIcon(iconEl, state) {
    if (!iconEl) return;
    iconEl.classList.remove('is-spinning', 'is-success');
    if (state === 'sending') {
      iconEl.innerHTML = ICON_SPINNER;
      iconEl.classList.add('is-spinning');
    } else if (state === 'success') {
      iconEl.innerHTML = ICON_CHECK;
      // Без rAF браузер схлопывает установку innerHTML и добавление
      // класса в один кадр — stroke-dashoffset transition не успевает
      // отыграть от "16" (просто появляется уже дорисованной).
      requestAnimationFrame(function () {
        iconEl.classList.add('is-success');
      });
    } else {
      iconEl.innerHTML = ICON_ARROW;
    }
  }

  // form — элемент <form>; options.onSuccess — необязательный колбэк
  // после успешной "отправки" (модалка меняет заголовок на благодарность)
  function initContactForm(form, options) {
    if (!form) return;
    options = options || {};

    var nameInput = form.querySelector('[name="name"]');
    var phoneInput = form.querySelector('[name="phone"]');
    var emailInput = form.querySelector('[name="email"]');
    var messageInput = form.querySelector('[name="message"]');
    var consentInput = form.querySelector('[name="consent"]');
    var submitBtn = form.querySelector('button[type="submit"]');
    var submitText = submitBtn.querySelector('.btn__text');
    var submitIcon = submitBtn.querySelector('.btn__icon');
    var statusEl = form.querySelector('[role="status"]');

    function errorElFor(input) {
      return input && input.id ? document.getElementById(input.id + 'Error') : null;
    }
    var nameError = errorElFor(nameInput);
    var phoneError = errorElFor(phoneInput);
    var emailError = errorElFor(emailInput);

    phoneInput.addEventListener('focus', function () {
      if (!phoneInput.value) phoneInput.value = '+7 (';
    });

    phoneInput.addEventListener('input', function () {
      phoneInput.value = formatPhone(phoneInput.value);
    });

    function validate() {
      var valid = true;

      if (!nameInput.value.trim()) {
        setFieldError(nameInput, nameError, 'Укажите имя');
        valid = false;
      } else {
        setFieldError(nameInput, nameError, '');
      }

      if (!isPhoneComplete(phoneInput.value)) {
        setFieldError(phoneInput, phoneError, 'Укажите полный номер телефона');
        valid = false;
      } else {
        setFieldError(phoneInput, phoneError, '');
      }

      if (emailInput.value.trim() && !isValidEmail(emailInput.value.trim())) {
        setFieldError(emailInput, emailError, 'Проверьте формат email');
        valid = false;
      } else {
        setFieldError(emailInput, emailError, '');
      }

      if (!consentInput.checked) {
        valid = false;
      }

      return valid;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      if (!validate()) {
        form.classList.remove('is-success');
        form.classList.add('is-error');
        statusEl.textContent = 'Проверьте поля, отмеченные ошибкой.';
        return;
      }

      form.classList.remove('is-error');
      form.classList.add('is-sending');
      submitBtn.disabled = true;
      submitText.textContent = 'ОТПРАВЛЯЕМ…';
      statusEl.textContent = '';
      setSubmitIcon(submitIcon, 'sending');

      var payload = {
        name: nameInput.value.trim(),
        phone: phoneInput.value,
        email: emailInput.value.trim(),
        message: messageInput ? messageInput.value.trim() : '',
      };

      // Реальной отправки нет — подключим бэкенд позже
      window.setTimeout(function () {
        console.log('Заявка ST EVENT:', payload);

        form.classList.remove('is-sending');
        form.classList.add('is-success');
        submitBtn.disabled = false;
        submitText.textContent = 'ОТПРАВИТЬ';
        statusEl.textContent = 'Заявка отправлена. Мы свяжемся с вами в ближайшее время.';
        setSubmitIcon(submitIcon, 'success');
        form.reset();
        if (options.onSuccess) options.onSuccess();
      }, 800);
    });

    // js/request-modal.js вызывает это при каждом открытии модалки —
    // иконка должна вернуться к обычной стрелке, иначе повторное
    // открытие после успешной отправки показывало бы галочку.
    return {
      resetIcon: function () {
        setSubmitIcon(submitIcon, 'idle');
      },
    };
  }

  // js/request-modal.js вызывает это для модалки — вынесено на window,
  // т.к. оба файла независимые IIFE (без общего модульного пространства,
  // ES-модули блокируются CORS на file://)
  window.ST_initContactForm = initContactForm;

  document.addEventListener('DOMContentLoaded', function () {
    initContactForm(document.getElementById('contactForm'));
  });
})();
