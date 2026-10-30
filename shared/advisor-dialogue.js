export function advisorIntent(question = '') {
  const query = String(question || '').trim().toLocaleLowerCase('ru-RU');
  if (!query) return 'empty';
  if (/^(?:эй|привет|здравствуй|здравствуйте|добрый\s+(?:день|вечер|утро)|доброе\s+утро|hello|hi|ку|салют)[\s!?.]*$/iu.test(query)) return 'smalltalk';
  if (/(?:созда|добав|предлож|сгенер|придума)[\wё-]*[^\n]{0,60}гипотез|своя\s+гипотез|новая\s+гипотез/iu.test(query)) return 'hypothesis';
  if (/самостоятельн|своими\s+силами|сами\s+сдела|без\s+(?:подключения|внедрения|агентов)|план\s+внедрен|сколько\s+(?:стоит|времени|по\s+времени)|какой\s+бюджет|какие\s+сроки|стоимость\s+внедрен|цена\s+внедрен/iu.test(query)) return 'implementation';
  if (/что\s+(?:с\s+этим\s+)?делать|что\s+дальше|с\s+чего\s+начать|следующ\w*\s+шаг|как\s+(?:это\s+)?(?:применить|использовать|улучшить)|какие\s+(?:действия|шаги)|какой\s+план|что\s+предлож/iu.test(query)) return 'recommendation';
  if (/офлайн|без\s+интернета|кто\s+(?:тебя\s+|вас\s+)?созд|как\s+(?:ты|вы)\s+работа|что\s+(?:ты|вы)\s+уме|твои\s+возможности|ваши\s+возможности/iu.test(query)) return 'meta';
  return 'factual';
}

export function greetingAnswer(research = {}, opportunity = null) {
  const company = research.companyName ? ` по компании «${research.companyName}»` : '';
  const direction = opportunity?.title ? ` Сейчас выбрано направление «${opportunity.title}».` : '';
  return `Здравствуйте! Я ваш ИИ-советник${company}.${direction} Могу объяснить находки, разобрать следующий шаг или помочь добавить свою гипотезу. Что сейчас важнее?`;
}
