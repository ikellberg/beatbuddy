export const DINO_PHRASES = {
  positive: [
    'Вау, точно в ритм!',
    'Классный удар!',
    'Так держать!',
    'Отлично попал!',
    'Супер, продолжаем!',
    'Вот это темп!',
    'Ритм пойман!',
    'Мощно получилось!'
  ],
  miss: [
    'Ничего, следующий твой!',
    'Почти, давай ещё!',
    'Спокойно, ты сможешь!',
    'Лови бит на следующем!',
    'Не сдаёмся, идём дальше!',
    'Чуть-чуть мимо, бывает!',
    'Ещё попытка!',
    'Сейчас получится!'
  ]
}

/**
 * Выбирает случайную фразу без мгновенного повтора предыдущей.
 * Возвращает пустую строку, если список пуст.
 * @param {string[]} list
 * @param {string} last
 * @returns {string}
 */
export function pickPhraseWithoutImmediateRepeat(list, last = '') {
  if (!Array.isArray(list) || list.length === 0) return ''
  if (list.length === 1) return list[0]

  let idx = Math.floor(Math.random() * list.length)
  if (list[idx] === last) {
    idx = (idx + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length
  }
  return list[idx]
}
