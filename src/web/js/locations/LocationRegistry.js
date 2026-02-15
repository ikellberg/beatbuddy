/**
 * LocationRegistry — реестр доступных локаций.
 *
 * Простой объект-реестр (не класс). Локации регистрируются через register(),
 * UI получает список через getAll(), Animator создаёт экземпляр через create().
 */

/** @typedef {'overlay' | 'in-canvas'} SpeechMode */

/** @type {Map<string, {id: string, name: string, createFn: () => object, speechMode: SpeechMode}>} */
const registry = new Map()

/**
 * Зарегистрировать локацию.
 * @param {string} id - уникальный идентификатор
 * @param {string} name - отображаемое имя для UI
 * @param {() => object} createFn - фабрика, возвращающая объект локации
 * @param {{speechMode?: SpeechMode}} [options]
 */
export function register(id, name, createFn, options = {}) {
  if (registry.has(id)) {
    console.warn(`[LocationRegistry] Локация "${id}" уже зарегистрирована, перезаписываем`)
  }

  const speechMode = options.speechMode === 'in-canvas' ? 'in-canvas' : 'overlay'
  registry.set(id, { id, name, createFn, speechMode })
  console.log(`[LocationRegistry] Зарегистрирована: "${id}" (${name})`)
}

/**
 * Получить список всех локаций для UI.
 * @returns {Array<{id: string, name: string}>}
 */
export function getAll() {
  return [...registry.values()].map(({ id, name }) => ({ id, name }))
}

/**
 * Создать экземпляр локации по id.
 * @param {string} id
 * @returns {object} объект с методами init, onBeat, onHit, destroy
 */
export function create(id) {
  const entry = registry.get(id)
  if (!entry) {
    console.warn(`[LocationRegistry] Локация "${id}" не найдена, fallback на "${getDefaultId()}"`)
    const fallback = registry.get(getDefaultId())
    if (!fallback) {
      throw new Error('[LocationRegistry] Нет зарегистрированных локаций')
    }
    return fallback.createFn()
  }
  return entry.createFn()
}

/**
 * Режим показа реплик для указанной локации.
 * @param {string} id
 * @returns {SpeechMode}
 */
export function getSpeechMode(id) {
  const entry = registry.get(id)
  if (entry) return entry.speechMode

  const fallback = registry.get(getDefaultId())
  return fallback ? fallback.speechMode : 'overlay'
}

/**
 * @returns {string} id локации по умолчанию
 */
export function getDefaultId() {
  return 'runner'
}
