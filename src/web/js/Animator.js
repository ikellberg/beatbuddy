/**
 * Animator — владеет PixiJS Application, ticker и lifecycle.
 *
 * Рисование делегируется текущей локации (LocationRegistry).
 * Публичный API сохранён для app.js: start(), stop(), onHit(result).
 */
import * as LocationRegistry from './locations/LocationRegistry.js'
// Импорт DefaultLocation для side-effect: регистрация в реестре.
import './locations/DefaultLocation.js'
import './locations/RunnerLocation.js'

export class Animator {
  /**
   * @param {HTMLCanvasElement} canvasElement
   * @param {number} bpm
   * @param {number|null} firstBeatTimeSec - время первого бита в шкале performance.now()/1000
   * @param {string} locationId - id локации из LocationRegistry
   */
  constructor(canvasElement, bpm, firstBeatTimeSec = null, locationId = LocationRegistry.getDefaultId()) {
    this.canvas = canvasElement
    this.bpm = bpm
    this.firstBeatTimeSec = Number.isFinite(firstBeatTimeSec) ? firstBeatTimeSec : null
    this.locationId = locationId

    this.running = false
    this.startTime = 0

    this.pixiApp = null
    this.location = null

    this._initRetries = 0
    this._retryTimer = null
    this._stopped = false

    this.status = {
      ok: true,
      mode: 'pixi',
      message: 'Animator готов к запуску'
    }

    this._tick = this._tick.bind(this)
    this._onContextLost = this._onContextLost.bind(this)
    this._onContextRestored = this._onContextRestored.bind(this)
    console.log(`[Animator] Создан (PixiJS): BPM=${bpm}, location="${locationId}"`)
  }

  getStatus() {
    return { ...this.status }
  }

  start() {
    if (this.running) {
      console.warn('[Animator] Уже запущен')
      return
    }

    this._stopped = false

    if (!this._initPixi()) {
      console.error('[Animator] Не удалось инициализировать PixiJS')
      return
    }

    this._startLocation()
  }

  _startLocation() {
    const container = this.pixiApp.stage
    const w = this.pixiApp.screen.width
    const h = this.pixiApp.screen.height

    try {
      this.location = LocationRegistry.create(this.locationId)
      this.location.init(container, w, h)
    } catch (error) {
      console.error('[Animator] Ошибка инициализации локации:', error)
      this._destroyPixiApp()
      this.location = null
      this.status = {
        ok: false,
        mode: 'fallback',
        message: `Анимация недоступна: ошибка локации — ${error.message}`
      }
      return
    }

    this.running = true
    this.startTime = performance.now()
    this.pixiApp.ticker.add(this._tick)
    this._initRetries = 0
    console.log('[Animator] Запущен')
  }

  stop() {
    if (this._retryTimer) {
      clearTimeout(this._retryTimer)
      this._retryTimer = null
    }

    this._stopped = true

    if (!this.running && !this.pixiApp) {
      return
    }

    this.running = false

    // Уничтожить локацию до PixiJS App.
    if (this.location) {
      this.location.destroy()
      this.location = null
    }

    if (this.pixiApp) {
      this._destroyPixiApp()
    }

    this.pixiApp = null

    console.log('[Animator] Остановлен')
  }

  /**
   * @param {{zone: 'perfect' | 'good' | 'miss'}} result
   */
  onHit(result) {
    if (!this.running || !this.location) {
      return
    }

    const zone = result.zone === 'perfect' || result.zone === 'good' || result.zone === 'miss'
      ? result.zone
      : 'miss'

    this.location.onHit(zone)
  }
  /** @param {number} maxRetries */
  _initPixi(maxRetries = 2) {
    if (this.pixiApp) {
      return true
    }

    if (!this.canvas) {
      this.status = {
        ok: false,
        mode: 'fallback',
        message: 'Анимация недоступна: canvas не найден'
      }
      return false
    }

    const renderWidth = Math.max(1, Math.floor(this.canvas.clientWidth || this.canvas.width))
    const renderHeight = Math.max(1, Math.floor(this.canvas.clientHeight || this.canvas.height))
    if (renderWidth <= 0 || renderHeight <= 0) {
      this.status = {
        ok: false,
        mode: 'fallback',
        message: 'Анимация недоступна: невалидный размер canvas'
      }
      return false
    }

    const pixi = globalThis.PIXI
    if (!pixi || !pixi.Application || !pixi.Graphics) {
      this.status = {
        ok: false,
        mode: 'fallback',
        message: 'Анимация недоступна: PixiJS не загружен'
      }
      return false
    }

    try {
      this.pixiApp = new pixi.Application({
        view: this.canvas,
        width: renderWidth,
        height: renderHeight,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(globalThis.devicePixelRatio || 1, 2)
      })

      this.canvas.addEventListener('webglcontextlost', this._onContextLost)
      this.canvas.addEventListener('webglcontextrestored', this._onContextRestored)

      this.status = {
        ok: true,
        mode: 'pixi',
        message: 'Animator работает через PixiJS'
      }
      return true
    } catch (error) {
      console.error(`[Animator] Ошибка инициализации PixiJS (попытка ${this._initRetries + 1}):`, error)

      // Конструктор мог создать WebGL контекст до падения — освободить слот.
      this._loseWebGLContext()

      if (this._initRetries < maxRetries) {
        this._initRetries++
        const delayMs = this._initRetries * 500
        console.log(`[Animator] Повторная попытка через ${delayMs}ms...`)
        this._retryTimer = setTimeout(() => {
          this._retryTimer = null
          if (this._stopped || this.running || this.pixiApp) return
          if (this._initPixi(maxRetries)) {
            this._startLocation()
          }
        }, delayMs)
      }

      this.status = {
        ok: false,
        mode: 'fallback',
        message: `Анимация недоступна: ${error.message || 'не удалось инициализировать PixiJS'}`
      }
      return false
    }
  }

  _tick() {
    if (!this.running || !this.pixiApp || !this.location) {
      return
    }

    const nowSec = performance.now() / 1000
    const beatStartSec = this.firstBeatTimeSec ?? (this.startTime / 1000)
    const beatsFromStart = ((nowSec - beatStartSec) * this.bpm) / 60
    const phase = ((beatsFromStart % 1) + 1) % 1

    this.location.onBeat(phase, beatsFromStart)
  }

  _onContextLost(event) {
    event.preventDefault()
    console.warn('[Animator] WebGL контекст потерян, анимация приостановлена')
    this.running = false
  }

  _onContextRestored() {
    if (this._stopped || !this.pixiApp) {
      console.log('[Animator] WebGL контекст восстановлен, но Animator остановлен — игнорируем')
      return
    }
    console.log('[Animator] WebGL контекст восстановлен, перезапуск анимации')
    this.running = true
    this.startTime = performance.now()
  }

  _destroyPixiApp() {
    if (!this.pixiApp) return
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this._onContextLost)
      this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored)
    }
    this.pixiApp.ticker.remove(this._tick)
    this.pixiApp.stage.removeChildren()
    this.pixiApp.destroy(false, {
      children: true,
      texture: false,
      baseTexture: false
    })
    this.pixiApp = null

    // Явно освободить WebGL контекст, чтобы не исчерпать лимит браузера (~8-16).
    this._loseWebGLContext()
  }

  /**
   * Принудительно освобождает WebGL контекст на canvas.
   * Без этого браузер может не переиспользовать слот,
   * и после нескольких start/stop gl.getParameter() начнёт возвращать 0.
   */
  _loseWebGLContext() {
    if (!this.canvas) return
    const gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl')
    if (!gl) return
    const ext = gl.getExtension('WEBGL_lose_context')
    if (ext) {
      ext.loseContext()
      console.log('[Animator] WebGL контекст явно освобождён')
    }
  }
}
