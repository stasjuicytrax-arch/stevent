/* Cloudflare Worker «stevent-relay» — приём заявок с сайта st-event.com и
   отправка в Telegram-канал. Устроен как обработчик заявок New Year
   (server/lead-handler.js там): та же ловушка для ботов, тот же лимит
   «не больше 5 заявок с одного адреса за 10 минут», та же проверка имени
   и телефона, сообщение в HTML-разметке Telegram.

   Отличие от New Year: там сайт шлёт заявку в Яндекс.Облако, а уже оттуда
   она идёт через Cloudflare-релей (из Яндекс.Облака Telegram недоступен).
   У ST EVENT своего сервера нет (сайт на GitHub Pages), поэтому сайт шлёт
   заявку прямо сюда, а Worker сам говорит с Telegram.

   Секрет (wrangler secret put): TELEGRAM_BOT_TOKEN — токен бота.
   Переменная (wrangler.toml): TELEGRAM_CHAT_ID — канал, сейчас @helpppevent. */

// Страницы, с которых принимаем заявки (запросы из чужих сайтов — отказ)
const ORIGINS = [
  'https://st-event.com',
  'https://www.st-event.com',
  'https://stasjuicytrax-arch.github.io',
];

/* Не больше 5 заявок с одного адреса за 10 минут (в пределах живого экземпляра) */
const RATE_LIMIT = 5;
const RATE_WINDOW = 10 * 60 * 1000;
const hits = new Map();

function tooOften(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 2000) hits.clear();
  return list.length > RATE_LIMIT;
}

const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
// Сообщение о мероприятии — переносы строк сохраняем, лишние пробелы убираем
const cleanText = (v, max) => String(v == null ? '' : v).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function validate(body) {
  /* Ловушка для ботов: поле «site» спрятано на странице, человек его не заполняет */
  if (clean(body.site, 50)) return { error: 'spam' };

  const name = clean(body.name, 80);
  const phone = clean(body.phone, 30);
  const digits = phone.replace(/\D/g, '');
  if (name.length < 2) return { error: 'Укажите имя' };
  if (digits.length !== 11) return { error: 'Укажите телефон целиком' };

  const email = clean(body.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Проверьте формат email' };

  return {
    lead: {
      form: clean(body.form_name, 150) || 'не указана',
      name,
      phone,
      email,
      message: cleanText(body.message, 2000),
      page: clean(body.page_url, 300),
      utm: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
        .map((k) => [k.replace('utm_', ''), clean(body[k], 120)])
        .filter(([, v]) => v),
    },
  };
}

function telegramText(l) {
  const time = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const lines = [
    '#stevent 🔔 <b>Новая заявка — ST Event</b>',
    '',
    `<b>Форма:</b> ${esc(l.form)}`,
    `<b>Имя:</b> ${esc(l.name)}`,
    `<b>Телефон:</b> ${esc(l.phone)}`,
  ];
  if (l.email) lines.push(`<b>Email:</b> ${esc(l.email)}`);
  if (l.message) lines.push(`<b>О мероприятии:</b> ${esc(l.message)}`);
  lines.push('');
  lines.push(`<b>Страница:</b> ${esc(l.page || '—')} | <b>Время:</b> ${esc(time)} (МСК)`);
  if (l.utm.length) lines.push(`<b>UTM:</b> ${esc(l.utm.map(([k, v]) => `${k}: ${v}`).join(' / '))}`);
  return lines.join('\n');
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
    };
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json(405, { ok: false, error: 'Метод не поддерживается' });
    // Запросы из чужих браузерных страниц не принимаем (без Origin — допускается для проверки из консоли)
    if (origin && !ORIGINS.includes(origin)) return json(403, { ok: false, error: 'Запрещено' });
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return json(500, { ok: false, error: 'Telegram не настроен' });

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (tooOften(ip)) return json(429, { ok: false, error: 'Слишком много заявок подряд. Попробуйте позже' });

    let data;
    try {
      data = await request.json();
    } catch {
      return json(400, { ok: false, error: 'Неверный формат данных' });
    }

    const checked = validate(data || {});
    if (checked.error === 'spam') return json(200, { ok: true }); // боту отвечаем как обычно, ничего не шлём
    if (checked.error) return json(400, { ok: false, error: checked.error });

    const tg = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: telegramText(checked.lead),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    }).catch(() => null);

    let ok = false;
    let reason = 'нет ответа';
    if (tg) {
      const j = await tg.json().catch(() => ({}));
      ok = tg.ok && j.ok !== false;
      reason = `HTTP ${tg.status}${j.description ? `: ${j.description}` : ''}`;
    }
    if (!ok) {
      console.error('Telegram не отправлен:', reason); // видно в логах Worker, не посетителю
      return json(502, { ok: false, error: 'Не удалось отправить заявку' });
    }
    return json(200, { ok: true });
  },
};
