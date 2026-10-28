const text = (value, limit = 500) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
const telegramText = value => text(value, 1600).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function createEnterpriseLead(input = {}) {
  const name = text(input.name, 120);
  const phone = text(input.phone, 80);
  const email = text(input.email, 160);
  if (!name) throw new Error('Укажите ваше имя.');
  if (!phone && !email) throw new Error('Укажите телефон или email для связи.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Проверьте адрес электронной почты.');
  const company = text(input.company, 180);
  const website = text(input.website, 300);
  const process = text(input.process, 300);
  const hypothesis = text(input.hypothesis, 1400);
  const way = text(input.way, 40) || 'Любой';
  const comment = text(input.comment, 1500);
  const context = [
    'Заявка из ИИ-советника Balanov.PRO. Первичный аудит — 0 ₽.',
    `Сайт: ${website || 'Не указан'}`,
    `Процесс для проверки: ${process || 'Не выбран'}`,
    `Гипотеза: ${hypothesis || 'Требует уточнения на аудите'}`,
    `Комментарий: ${comment || 'Нет'}`,
    'Это гипотеза по публичным материалам, а не подтверждённый внутренний процесс.',
  ];
  return {
    name, phone, email, company, way,
    comment: context.join('\n'),
    totalNew: '', totalOld: '', packages: [], team: '', equip: '', services: [],
    messageText: [
      '<b>Бесплатный аудит из ИИ-советника Balanov.PRO</b>',
      `<b>Имя:</b> ${telegramText(name)}`,
      `<b>Компания:</b> ${telegramText(company || 'Не указана')}`,
      `<b>Телефон:</b> ${telegramText(phone || 'Не указан')}`,
      `<b>Email:</b> ${telegramText(email || 'Не указан')}`,
      `<b>Способ связи:</b> ${telegramText(way)}`,
      ...context.map(line => telegramText(line)),
    ].join('\n'),
  };
}

export async function submitEnterpriseLead(input, fetchImpl = fetch) {
  const response = await fetchImpl('https://balanov.pro/send.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(createEnterpriseLead(input)),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success || (result.mailSent === false && result.tgSent === false)) {
    throw new Error(result.error || 'Сервер не подтвердил передачу заявки. Используйте подготовленное письмо ниже.');
  }
  return result;
}
