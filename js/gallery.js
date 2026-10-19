// Модалка кейса + галерея + лайтбокс. IIFE — без import/export (file://).
(function () {
  'use strict';

  // Тексты кейсов для бизнеса — ТЗ 2026 (docs/12-REVISION-09.md), частных
  // — дословно из docs/01-CONTENT.md, раздел 4. Ничего не переписано.
  // Блоки: { type: 'p', text } | { type: 'ps', items } | { type: 'list', items }.
  // about и kpi — необязательные, без них блок в модалке скрывается.
  var CASES = [
    {
      slug: 'generations',
      name: 'GENERATIONS',
      location: 'Школа управления «Сколково», Москва',
      guests: '2000 человек',
      coverExt: 'jpg',
      photoCount: 8,
      photoExt: 'jpg',
      about: { type: 'p', text: 'GenerationS — это корпоративный акселератор, который помогает технологическим стартапам развить свои проекты и получить обратную связь и поддержку от ведущих корпораций России. Среди партнеров акселератора — ВТБ, AIRBUS, УРАЛХИМ, Правительство Москвы и другие.' },
      task: { type: 'p', text: 'За 20 дней разработать концепцию и в срок провести награждение участников и победителей.' },
      solution: { type: 'p', text: 'Команда ST EVENT разработала и реализовала церемонию награждения участников, несмотря на срочное изменение концепции события.' }
    },
    {
      slug: 'promobot',
      name: 'PROMOBOT TALKS',
      location: 'Технопарк Morion Digital, Пермь',
      guests: '500 человек',
      coverExt: 'jpg',
      photoCount: 4,
      photoExt: 'jpg',
      about: { type: 'p', text: 'Международная научно-популярная конференция о роботах и современных технологиях от российского производителя роботов.' },
      task: { type: 'p', text: 'Организовать митап на 500 человек с мультипотоковой онлайн-трансляцией в реальном времени. Обеспечить участие как российских спикеров, так и спикеров из Европы.' },
      solution: { type: 'p', text: 'Команда ST EVENT вела организацию серии митапов, офлайн-координацию на площадке, а также обеспечивала онлайн-трансляцию. Для выступлений были привезены спикеры из Москвы, Чехии, и организована трансляция спикеров из Китая и Бразилии.' }
    },
    {
      slug: 'bitva-robotov',
      name: 'БИТВА РОБОТОВ',
      location: 'Главный медиацентр, Олимпийский парк, Сочи',
      guests: 'более 2000 человек',
      coverExt: 'jpg',
      photoCount: 17,
      photoExt: 'jpg',
      about: { type: 'p', text: 'Чемпионат по боям роботов проходил в рамках Всемирного фестиваля молодежи и студентов — ежедневно каждый из этапов чемпионата посещало более 2000 человек, также на площадке велась мультипотоковая трансляция в реальном времени. Чемпионат посетили Герман Греф, Сергей Кириенко, Максут Шадаев, Валерий Фальков, известные блогеры и журналисты со всего мира. Чемпионат проводится ежегодно в разных городах России.' },
      task: {
        type: 'list',
        items: [
          'Произвести застройку площадки, где будет предусмотрен безопасный ринг, зрительный зал, ремонтная зона для участников, гримерные помещения и пресс-центр.',
          'Обеспечить трансфер участников и их роботов со всей России и из 20 стран мира.',
          'Провести чемпионат и его трансляцию с ведением на двух языках, русском и английском.',
          'Сделать событие зрелищным и интересным.'
        ]
      },
      solution: { type: 'p', text: 'Команда ST EVENT обеспечила застройку площадки: безопасный ринг, зрительный зал, ремонтную зону для участников, гримерные и пресс-центр. Организовала трансфер участников и их роботов из России и 20 стран мира, проведение чемпионата на двух языках и мультипотоковую онлайн-трансляцию. Техническую сложность проекта объединили со зрелищной подачей, чтобы каждый поединок был понятным и захватывающим для зрителей на площадке и онлайн.' }
    },
    {
      // Папка и файлы остались unikorn — это тот же кейс, переименован
      // по ТЗ 2026 в UJIN | КОРПОРАТИВНАЯ РЕГАТА
      slug: 'unikorn',
      name: 'UJIN | КОРПОРАТИВНАЯ РЕГАТА',
      location: 'Пермь',
      guests: '140 человек',
      coverExt: 'png',
      photoCount: 10,
      photoExt: 'png',
      photoExceptions: { 2: 'jpg', 3: 'jpg' },
      task: { type: 'p', text: 'Организовать тимбилдинг для 140 сотрудников компании из Москвы и Перми из нескольких этапов: парусной регаты и командных игр.' },
      solution: {
        type: 'ps',
        items: [
          'На яхте стираются привычные ранги и звания. Тимлид, бухгалтер или партнер — все они находятся в ограниченном пространстве, в буквальном смысле, «в одной лодке», а задачи решаются совместно и сообща.',
          'Во время прогулки под парусом сотрудники из разных городов знакомились, объединялись в большие команды и играли в игры по мотивам популярных YouTube-шоу.'
        ]
      }
    },
    {
      slug: 'kron',
      name: 'СП-КРОН | ЮБИЛЕЙ КОМПАНИИ',
      location: 'Пермь',
      guests: '160 человек',
      coverExt: 'jpg',
      photoCount: 20,
      photoExt: 'jpg',
      task: {
        type: 'list',
        items: [
          'Разработать концепцию события, активности которые объединят и познакомят сотрудников между собой.',
          'Организовать мероприятие, где каждый этап будет интересен и взрослым, и детям.',
          'Снять корпоративный фильм о компании в городах ее присутствия.'
        ]
      },
      solution: { type: 'p', text: 'Компания берется за решение масштабных задач, и руководство компании хотело познакомить с местом работы своих сотрудников и их семьи. Так родилась концепция «семейного» юбилея, где каждому участнику праздника будет весело.' }
    },
    {
      // ТЗ 2026: «кейс, который есть сейчас на сайте, оставить, убрать
      // только про KPI»
      slug: 'importservice',
      name: 'ИМПОРТСЕРВИС',
      location: 'Пермь',
      guests: '87 гостей',
      coverExt: 'jpg',
      photoCount: 12,
      photoExt: 'jpg',
      task: { type: 'p', text: 'Рассказать о масштабе и успехах компании и наградить сотрудников за значимые достижения.' },
      solution: {
        type: 'p',
        text: 'Разработка театрализованной церемонии награждения, в которой были затронуты корпоративные ценности компании. Разработка и проведение развлекательной части, отличной от предыдущих мероприятий.'
      }
    },
    {
      slug: 'vypusknoy',
      name: 'ВЫПУСКНОЙ ШКОЛА 22',
      location: 'Пермь',
      guests: '170 гостей',
      coverExt: 'jpg',
      photoCount: 41,
      photoExt: 'jpg',
      task: { type: 'p', text: 'Организовать для всей параллели нестандартный выпускной.' },
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
      task: { type: 'p', text: 'Организовать нестандартный день рождения, где гостями будут только девушки.' },
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
      task: { type: 'p', text: 'Организация и проведение детского дня рождения в стилистике любимого фильма.' },
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
      task: { type: 'p', text: 'Организовать свадьбу для современных айтишников.' },
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
  var modalAbout, modalAboutBlock, modalKpiBlock, modalCta;
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
      var texts = block.type === 'ps' ? block.items : [block.text];
      texts.forEach(function (text) {
        var p = document.createElement('p');
        p.textContent = text;
        container.appendChild(p);
      });
    }
  }

  // Необязательный блок модалки (О проекте, KPI) — скрыт, если данных нет
  function renderOptionalBlock(blockEl, container, block) {
    blockEl.hidden = !block;
    if (block) renderTextBlock(container, block);
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

    renderOptionalBlock(modalAboutBlock, modalAbout, c.about);
    renderTextBlock(modalTask, c.task);
    renderTextBlock(modalSolution, c.solution);
    renderOptionalBlock(modalKpiBlock, modalKpi, c.kpi);
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
    modalAbout = document.getElementById('caseModalAbout');
    modalAboutBlock = document.getElementById('caseModalAboutBlock');
    modalKpiBlock = document.getElementById('caseModalKpiBlock');
    modalCta = document.getElementById('caseModalCta');

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

    // «Обсудить мероприятие» в конце кейса — закрываем кейс и открываем
    // модалку заявки (js/request-modal.js); без неё — обычный якорь
    if (modalCta) {
      modalCta.addEventListener('click', function (event) {
        if (!window.ST_openRequestModal) return;
        event.preventDefault();
        var returnEl = lastFocusedEl;
        closeModal();
        window.ST_openRequestModal(returnEl);
      });
    }
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
