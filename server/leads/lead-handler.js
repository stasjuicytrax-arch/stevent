/* Обработчик заявок с форм st-event.com → Telegram-канал. Без зависимостей: чистый Node.js.
   Устроен как обработчик New Year (ngperm.ru). Секреты берутся из переменных окружения функции. */

'use strict';

const https = require('https');

const env = (k) => process.env[k] || '';

/* Не больше 5 заявок с одного адреса за 10 минут (в пределах живого экземпляра функции) */
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
  if (name.length < 2) return { error: 'Укажите имя' };
  if (phone.replace(/\D/g, '').length !== 11) return { error: 'Укажите телефон целиком' };

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

/* Вызов Bot API. Из Яндекс.Облака api.telegram.org недоступен, поэтому адрес подменяется на релей
   вне РФ: TELEGRAM_API_BASE=https://stevent-relay.ngperm.workers.dev, ключ релея — заголовком X-Relay-Key. */
function tgCall(method, payload) {
  return new Promise((resolve) => {
    const token = env('TELEGRAM_BOT_TOKEN');
    if (!token) return resolve({ ok: false, reason: 'Telegram не настроен' });
    let base;
    try { base = new URL(env('TELEGRAM_API_BASE') || 'https://api.telegram.org'); } catch { return resolve({ ok: false, reason: 'Неверный TELEGRAM_API_BASE' }); }
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: base.hostname,
        port: base.port || 443,
        path: `${base.pathname.replace(/\/$/, '')}/bot${token}/${method}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(env('TELEGRAM_RELAY_KEY') ? { 'X-Relay-Key': env('TELEGRAM_RELAY_KEY') } : {}),
        },
        timeout: 8000,
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let j = {};
          try { j = JSON.parse(raw); } catch { /* не JSON */ }
          resolve({ ok: res.statusCode === 200 && j.ok !== false, reason: `HTTP ${res.statusCode}${j.description ? `: ${j.description}` : ''}` });
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve({ ok: false, reason: e.message }));
    req.end(body);
  });
}

async function handleLead(body, meta) {
  if (tooOften(meta.ip)) return { status: 429, body: { ok: false, error: 'Слишком много заявок подряд. Попробуйте позже' } };

  const checked = validate(body || {});
  if (checked.error === 'spam') return { status: 200, body: { ok: true } }; // боту отвечаем как обычно, ничего не шлём
  if (checked.error) return { status: 400, body: { ok: false, error: checked.error } };

  const chat = env('TELEGRAM_CHAT_ID');
  const tg = chat
    ? await tgCall('sendMessage', { chat_id: chat, text: telegramText(checked.lead), parse_mode: 'HTML', disable_web_page_preview: true })
    : { ok: false, reason: 'Telegram не настроен' };
  if (!tg.ok) {
    console.error('Telegram не отправлен:', tg.reason); // видно в логах функции, не посетителю
    return { status: 502, body: { ok: false, error: 'Не удалось отправить заявку' } };
  }
  return { status: 200, body: { ok: true } };
}

module.exports = { handleLead, validate, telegramText, tgCall };
