/* Liquid Glass — рецепт с сайта DIGITAL EVENTS
   (references/liquid-glass/RECIPE-from-digital-events.md, раздел 2).
   Одна SVG-карта смещения на страницу: красный канал — сдвиг по X,
   зелёный — по Y, нейтральный центр, искажение только у краёв (bezel).
   В Chromium — преломление (класс .glass-svg на <html>), в Safari/Firefox —
   фолбэк blur (класс .glass без .glass-svg). Работает и по file://. */
(function () {
  var BEZEL = 32;
  var map =
    "<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'>" +
    "<defs>" +
    "<linearGradient id='x' x1='0' x2='1' y1='0' y2='0'><stop offset='0' stop-color='#000'/><stop offset='1' stop-color='#f00'/></linearGradient>" +
    "<linearGradient id='y' x1='0' x2='0' y1='0' y2='1'><stop offset='0' stop-color='#000'/><stop offset='1' stop-color='#0f0'/></linearGradient>" +
    "<filter id='b'><feGaussianBlur stdDeviation='" + BEZEL / 3 + "'/></filter>" +
    "</defs>" +
    "<rect width='256' height='256' fill='url(#x)'/>" +
    "<rect width='256' height='256' fill='url(#y)' style='mix-blend-mode:screen'/>" +
    "<rect x='" + BEZEL + "' y='" + BEZEL + "' width='" + (256 - BEZEL * 2) + "' height='" + (256 - BEZEL * 2) + "' rx='" + BEZEL + "' fill='#808000' filter='url(#b)'/>" +
    "</svg>";
  var url = 'data:image/svg+xml,' + encodeURIComponent(map);

  var img = document.getElementById('st-liquid-map');
  if (img) {
    img.setAttribute('href', url);
    img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url);
  }

  // url()-фильтры в backdrop-filter стабильно работают только в Chromium
  var ua = navigator.userAgent;
  var chromium = /Chrome\/|Edg\/|YaBrowser\//.test(ua) && !/Firefox\//.test(ua);
  // На тач-устройствах преломление не включаем: SVG-фильтр в backdrop-
  // filter на телефоне заметно тормозил первый экран — там остаётся
  // обычное размытое стекло (.glass без .glass-svg)
  var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (chromium && finePointer && window.CSS && CSS.supports('backdrop-filter', 'url(#st-liquid)')) {
    document.documentElement.classList.add('glass-svg');
  }
})();
