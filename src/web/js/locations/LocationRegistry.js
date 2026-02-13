/**
 * LocationRegistry — реестр доступных локаций.
 *
 * Простой объект-реестр (не класс). Локации регистрируются через register(),
 * UI получает список через getAll(), Animator создаёт экземпляр через create().
 */

/** @type {Map<string, {id: string, name: string, createFn: () => object}>} */
const registry = new Map()

/**
 * Зарегистрировать локацию.
 * @param {string} id - уникальный идентификатор
 * @param {string} name - отображаемое имя для UI
 * @param {() => object} createFn - фабрика, возвращающая объект локации
 */
export function register(id, name, createFn) {
  if (registry.has(id)) {
    console.warn(`[LocationRegistry] Локация "${id}" уже зарегистрирована, перезаписываем`)
  }
  registry.set(id, { id, name, createFn })
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
      throw new Error(`[LocationRegistry] Нет зарегистрированных локаций`)
    }
    return fallback.createFn()
  }
  return entry.createFn()
}

/**
 * @returns {string} id локации по умолчанию
 */
export function getDefaultId() {
  return 'default'
}
