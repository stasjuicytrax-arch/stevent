// Модалка кейса + галерея + лайтбокс. IIFE — без import/export (file://).
(function () {
  'use strict';

  // Тексты дословно из docs/01-CONTENT.md, раздел 4. Ничего не переписано.
  var CASES = [
    {
      slug: 'bitva-robotov',
      name: 'БИТВА РОБОТОВ',
      location: 'Сочи',
      guests: 'более 2000 гостей',
      coverExt: 'jpg',
      photoCount: 17,
      photoExt: 'jpg',
      task: 'Популяризация робототехники в России. Привлечение новых кадров в сферу IT.',
      solution: {
        type: 'p',
        text: 'Зрелищное соревнование, где встречаются лучшие технологии и изобретатели со всего мира. Шоу мирового уровня. Edutainment — образование через развлечение. Выставка роботов со всего мира — международная площадка по обмену опытом в области робототехники.'
      },
      kpi: { type: 'p', text: 'Чемпионат проводится в нескольких городах России.' }
    },
    {
      slug: 'kron',
      name: 'КРОН',
      location: 'Пермь',
      guests: '140 гостей',
      coverExt: 'jpg',
      photoCount: 20,
      photoExt: 'jpg',
      task: 'Организовать и вовлечь всех сотрудников компании и их семьи в мероприятие.',
      solution: {
        type: 'p',
        text: 'Разработка и организация оптимальной концепции для взрослых и детей. Съёмка корпоративного фильма о компании в городах присутствия. Награждение лучших сотрудников.'
      },
      kpi: { type: 'p', text: '96% положительных отзывов от сотрудников и их семей.' }
    },
    {
      slug: 'importservice',
      name: 'ИМПОРТСЕРВИС',
      location: 'Пермь',
      guests: '87 гостей',
      coverExt: 'jpg',
      photoCount: 12,
      photoExt: 'jpg',
      task: 'Рассказать о масштабе и успехах компании и наградить сотрудников за значимые достижения.',
      solution: {
        type: 'p',
        text: 'Разработка театрализованной церемонии награждения, в которой были затронуты корпоративные ценности компании. Разработка и проведение развлекательной части, отличной от предыдущих мероприятий.'
      },
      kpi: {
        type: 'list',
        items: [
          '99% положительных отзывов от сотрудников компании.',
          '37% повышение лояльности сотрудников к корпоративным ценностям.'
        ]
      }
    },
    {
      slug: 'unikorn',
      name: 'ЮНИКОРН',
      location: 'Пермь',
      guests: '140 гостей',
      coverExt: 'png',
      photoCount: 10,
      photoExt: 'png',
      photoExceptions: { 2: 'jpg', 3: 'jpg' },
      task: 'Организовать тимбилдинг и вовлечь всех сотрудников компании.',
      solution: {
        type: 'p',
        text: 'Все гости мероприятия приняли участие в настоящей парусной регате, а также был организован турнир «NEОфисные игры».'
      },
      kpi: { type: 'p', text: '100% положительных отзывов от сотрудников компании.' }
    },
    {
      slug: 'vypusknoy',
      name: 'ВЫПУСКНОЙ ШКОЛА 22',
      location: 'Пермь',
      guests: '170 гостей',
      coverExt: 'jpg',
      photoCount: 41,
      photoExt: 'jpg',
      task: 'Организовать для всей параллели нестандартный выпускной.',
      solution: {
        type: 'list',
        items: [
          'Нестандартная церемония вручения дипломов об окончании школы',
          'Написание сценария и режиссирование креативного поздравления от учителей',
          'Разработка интерактивных игровых блоков с привлечением лучших артистов Пермского края',
          'Креативное видеопоздравление от всех гостей в формате экспресс-монтажа'
        ]
      },
      kpi: { type: 'p', text: '100% положительных отзывов.' }
    },
    {
      slug: 'ibiza',
      name: 'IBIZA PARTY',
      location: 'Пермь',
      guests: '25 гостей',
      coverExt: 'jpg',
      photoCount: 29,
      photoExt: 'jpg',
      task: 'Организовать нестандартный день рождения, где гостями будут только девушки.',
      solution: {
        type: 'p',
        text: 'Разработка квеста для гостей. Создание брендированного меню. Атмосфера легендарной Ibiza Party. Преимущественно мужской состав артистов на весь вечер. Приглашение известных московских артистов.'
      },
      kpi: { type: 'p', text: '100% положительных отзывов после мероприятия.' }
    },
    {
      slug: 'hogvarts',
      name: 'ХОГВАРТС',
      location: 'Пермь',
      guests: '50 гостей',
      coverExt: 'jpg',
      photoCount: 49,
      photoExt: 'jpg',
      task: 'Организация и проведение детского дня рождения в стилистике любимого фильма.',
      solution: {
        type: 'p',
        text: 'Разработка сценария и квест-игры по мотивам «Гарри Поттера». Привлечение профессиональных актёров. Застройка декораций из фильма. Иммерсивное погружение в концепцию мероприятия.'
      },
      kpi: { type: 'p', text: '100% положительных отзывов.' }
    },
    {
      slug: 'svadba',
      name: 'СВАДЬБА ДАРЬИ И АЛЕКСЕЯ',
      location: 'Пермь',
      guests: '56 гостей',
      coverExt: 'jpg',
      photoCount: 11,
      photoExt: 'jpg',
      task: 'Организовать свадьбу для современных айтишников.',
      solution: {
        type: 'list',
        items: [
          'Разработка креативных идей для программы свадьбы',
          'Разработка и написание сайта для свадьбы',
          'Программирование телеграм-бота для розыгрыша подвязки',
          'Театрализованное представление-сюрприз',
          'Танцевальный флешмоб',
          'Стендап от жениха'
        ]
      },
      kpi: { type: 'p', text: '100% положительных отзывов.' }
    }
  ];

  var EAGER_COUNT = 6;

  var modal, modalClose, modalCover, modalCoverImg, modalTitle, modalMeta;
  var modalTask, modalSolution, modalKpi, modalGallery;
  var lightbox, lightboxImage, lightboxClose, lightboxPrev, lightboxNext;

  var currentPhotos = [];
  var currentPhotoIndex = 0;
  var lastFocusedEl = null;
  var galleryObserver = null;
  var touchStartX = 0;

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function findCase(slug) {
    for (var i = 0; i < CASES.length; i++) {
      if (CASES[i].slug === slug) return CASES[i];
    }
    return null;
  }

  function getPhotoList(c) {
    var list = [];
    for (var i = 1; i <= c.photoCount; i++) {
      var ext = (c.photoExceptions && c.photoExceptions[i]) || c.photoExt;
      list.push({
        src: 'assets/portfolio/' + c.slug + '/' + c.slug + '-' + pad2(i) + '.' + ext,
        alt: c.name + ' — фото ' + i + ' из ' + c.photoCount
      });
    }
    return list;
  }

  function renderTextBlock(container, block) {
    container.innerHTML = '';
    if (block.type === 'list') {
      var ul = document.createElement('ul');
      ul.className = 'case-modal__list';
      block.items.forEach(function (item) {
        var li = document.createElement('li');
        li.textContent = item;
        ul.appendChild(li);
      });
      container.appendChild(ul);
    } else {
      var p = document.createElement('p');
      p.textContent = block.text;
      container.appendChild(p);
    }
  }

  function getFocusable(container) {
    var nodes = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return Array.prototype.filter.call(nodes, function (el) {
      return !el.disabled && el.offsetParent !== null;
    });
  }

  function renderGallery(photos) {
    modalGallery.innerHTML = '';
    if (galleryObserver) {
      galleryObserver.disconnect();
    }

    // Первые 6 фото — сразу, остальные лениво через IntersectionObserver
    // (в hogvarts 49 фото, в vypusknoy 41 — без этого модалка тормозит)
    galleryObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            delete img.dataset.src;
          }
          galleryObserver.unobserve(img);
        });
      },
      { root: modal, rootMargin: '400px 0px' }
    );

    photos.forEach(function (photo, index) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'case-modal__gallery-item media';
      item.setAttribute('aria-label', 'Открыть фото ' + (index + 1) + ' из ' + photos.length);

      var img = document.createElement('img');
      img.alt = photo.alt;
      if (index < EAGER_COUNT) {
        img.src = photo.src;
      } else {
        img.dataset.src = photo.src;
        galleryObserver.observe(img);
      }

      item.appendChild(img);
      item.addEventListener('click', function () {
        openLightbox(index);
      });
      modalGallery.appendChild(item);
    });
  }

  function handleModalKeydown(event) {
    if (event.key === 'Escape') {
      if (!lightbox.hidden) {
        closeLightbox();
      } else {
        closeModal();
      }
      return;
    }
    if (event.key === 'Tab' && lightbox.hidden) {
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

  // Открытие через FLIP — карточка визуально разворачивается в полноэкранный
  // вид, а не fade (docs/05-REVISION-02.md, R16.9). First — обложка
  // карточки-триггера, Last — обложка модалки в её обычном месте.
  // window.ST_MOTION приходит из js/animations.js (может не быть, если
  // GSAP не загрузился или включён prefers-reduced-motion — тогда просто
  // открываем мгновенно, без анимации).
  function playOpenFlip(firstRect) {
    var motion = window.ST_MOTION;
    var body = modal.querySelector('.case-modal__body');
    if (!motion || !firstRect || typeof gsap === 'undefined') {
      if (typeof gsap !== 'undefined') {
        gsap.set([modalCover, body, modalClose], { clearProps: 'all' });
      }
      return;
    }

    var lastRect = modalCover.getBoundingClientRect();
    var scaleX = firstRect.width / lastRect.width;
    var scaleY = firstRect.height / lastRect.height;

    gsap.set(modalCover, {
      transformOrigin: 'top left',
      x: firstRect.left - lastRect.left,
      y: firstRect.top - lastRect.top,
      scaleX: scaleX,
      scaleY: scaleY,
    });
    gsap.set(body, { opacity: 0, y: 24 });
    gsap.set(modalClose, { opacity: 0 });

    // Абсолютные тайминги вместо цепочки relative-офсетов — с ними легко
    // случайно поставить body раньше modalClose при переносе чисел
    var tl = gsap.timeline();
    tl.to(modalCover, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: motion.durSlow, ease: motion.ease }, 0)
      .to(modalClose, { opacity: 1, duration: motion.durFast }, motion.durSlow * 0.5)
      .to(body, { opacity: 1, y: 0, duration: motion.dur, ease: motion.ease }, motion.durSlow * 0.6);
  }

  function openModal(slug, triggerEl) {
    var c = findCase(slug);
    if (!c) return;

    currentPhotos = getPhotoList(c);
    lastFocusedEl = triggerEl || document.activeElement;

    // Прямоугольник обложки карточки — до того, как модалка займёт её место
    var firstRect = null;
    if (triggerEl) {
      var media = triggerEl.querySelector('.case-card__media');
      if (media) firstRect = media.getBoundingClientRect();
    }

    modalCoverImg.src = 'assets/portfolio/' + c.slug + '/cover.' + c.coverExt;
    modalCoverImg.alt = c.name + ' — обложка кейса';
    modalTitle.textContent = c.name;
    modalMeta.textContent = c.location + ' · ' + c.guests;

    renderTextBlock(modalTask, { type: 'p', text: c.task });
    renderTextBlock(modalSolution, c.solution);
    renderTextBlock(modalKpi, c.kpi);
    renderGallery(currentPhotos);

    modal.hidden = false;
    modal.scrollTop = 0;
    document.body.classList.add('no-scroll');
    if (window.ST_LENIS) window.ST_LENIS.stop();
    document.addEventListener('keydown', handleModalKeydown);
    modalClose.focus();

    playOpenFlip(firstRect);
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('no-scroll');
    if (window.ST_LENIS) window.ST_LENIS.start();
    document.removeEventListener('keydown', handleModalKeydown);
    if (galleryObserver) {
      galleryObserver.disconnect();
      galleryObserver = null;
    }
    // preventScroll — без него .focus() сам скроллит элемент в область
    // видимости по своей логике, что и давало рывок позиции страницы
    // при закрытии модалки (найдено вместе с починкой скролла внутри
    // самой модалки — два независимых бага с похожим симптомом).
    if (lastFocusedEl) lastFocusedEl.focus({ preventScroll: true });
  }

  function updateLightboxImage() {
    var photo = currentPhotos[currentPhotoIndex];
    lightboxImage.src = photo.src;
    lightboxImage.alt = photo.alt;
  }

  function openLightbox(index) {
    currentPhotoIndex = index;
    updateLightboxImage();
    lightbox.hidden = false;
    lightboxClose.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    modalClose.focus();
  }

  function showPrevPhoto() {
    currentPhotoIndex = (currentPhotoIndex - 1 + currentPhotos.length) % currentPhotos.length;
    updateLightboxImage();
  }

  function showNextPhoto() {
    currentPhotoIndex = (currentPhotoIndex + 1) % currentPhotos.length;
    updateLightboxImage();
  }

  function initSwipe() {
    lightbox.addEventListener(
      'touchstart',
      function (event) {
        touchStartX = event.changedTouches[0].clientX;
      },
      { passive: true }
    );
    lightbox.addEventListener(
      'touchend',
      function (event) {
        var dx = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) < 40) return;
        if (dx > 0) showPrevPhoto();
        else showNextPhoto();
      },
      { passive: true }
    );
  }

  function initCaseModal() {
    modal = document.getElementById('caseModal');
    if (!modal) return;

    modalClose = document.getElementById('caseModalClose');
    modalCover = document.getElementById('caseModalCover');
    modalCoverImg = document.getElementById('caseModalCoverImg');
    modalTitle = document.getElementById('caseModalTitle');
    modalMeta = document.getElementById('caseModalMeta');
    modalTask = document.getElementById('caseModalTask');
    modalSolution = document.getElementById('caseModalSolution');
    modalKpi = document.getElementById('caseModalKpi');
    modalGallery = document.getElementById('caseModalGallery');

    lightbox = document.getElementById('lightbox');
    lightboxImage = document.getElementById('lightboxImage');
    lightboxClose = document.getElementById('lightboxClose');
    lightboxPrev = document.getElementById('lightboxPrev');
    lightboxNext = document.getElementById('lightboxNext');

    document.querySelectorAll('.case-card').forEach(function (card) {
      card.addEventListener('click', function () {
        openModal(card.dataset.case, card);
      });
      card.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openModal(card.dataset.case, card);
        }
      });
    });

    modalClose.addEventListener('click', closeModal);
    modal.addEventListener('click', function (event) {
      if (event.target === modal) closeModal();
    });
    modalCover.addEventListener('click', function (event) {
      if (event.target === modalCover) closeModal();
    });

    lightboxClose.addEventListener('click', closeLightbox);
    lightboxPrev.addEventListener('click', showPrevPhoto);
    lightboxNext.addEventListener('click', showNextPhoto);
    lightbox.addEventListener('click', function (event) {
      if (event.target === lightbox) closeLightbox();
    });

    initSwipe();
  }

  document.addEventListener('DOMContentLoaded', initCaseModal);
})();
