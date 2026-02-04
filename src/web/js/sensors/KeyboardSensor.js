/**
 * KeyboardSensor — эмуляция датчика через клавиатуру
 *
 * Для разработки и тестирования без физического датчика.
 * Нажатие пробела = удар.
 */

export class KeyboardSensor {
  constructor() {
    this.connected = false
    this.hitCallback = null
    this.boundKeyHandler = null

    console.log('[KeyboardSensor] Instance created')
  }

  /**
   * Подключить сенсор (начать слушать клавиатуру)
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected) {
      console.warn('[KeyboardSensor] Already connected')
      return
    }

    console.log('[KeyboardSensor] Connecting...')

    this.boundKeyHandler = (event) => this._handleKeyDown(event)
    document.addEventListener('keydown', this.boundKeyHandler)

    this.connected = true
    console.log('[KeyboardSensor] Connected successfully')
  }

  /**
   * Отключить сенсор
   */
  disconnect() {
    if (!this.connected) {
      console.warn('[KeyboardSensor] Already disconnected')
      return
    }

    console.log('[KeyboardSensor] Disconnecting...')

    document.removeEventListener('keydown', this.boundKeyHandler)
    this.boundKeyHandler = null
    this.connected = false

    console.log('[KeyboardSensor] Disconnected')
  }

  /**
   * Подписаться на события удара
   * @param {function} callback - функция, вызываемая при ударе
   */
  onHit(callback) {
    this.hitCallback = callback
    console.log('[KeyboardSensor] Hit callback registered')
  }

  /**
   * Получить текущий статус сенсора
   * @returns {{connected: boolean, type: string, error: string|null}}
   */
  getStatus() {
    return {
      connected: this.connected,
      type: 'keyboard',
      error: null
    }
  }

  /**
   * Получить тип сенсора
   * @returns {string}
   */
  getType() {
    return 'keyboard'
  }

  /**
   * Обработчик нажатия клавиши
   * @param {KeyboardEvent} event
   * @private
   */
  _handleKeyDown(event) {
    if (event.code !== 'Space') {
      return
    }

    if (event.repeat) {
      return
    }

    event.preventDefault()

    const hitEvent = {
      timestamp: performance.now(),
      source: 'keyboard'
    }

    console.log(`[KeyboardSensor] Hit detected at ${hitEvent.timestamp.toFixed(2)}ms`)

    if (!this.hitCallback) {
      console.warn('[KeyboardSensor] No hit callback registered')
      return
    }

    this.hitCallback(hitEvent)
  }
}
