/**
 * Animator — владеет PixiJS Application, ticker и lifecycle.
 *
 * Рисование делегируется текущей локации (LocationRegistry).
 * Публичный API сохранён для app.js: start(), stop(), onHit(result).
 */
import * as LocationRegistry from './locations/LocationRegistry.js'
// Импорт DefaultLocation для side-effect: регистрация в реестре.
import './locations/DefaultLocation.js'
import './locations/ForestLocation.js'
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

    this.status = {
      ok: true,
      mode: 'pixi',
      message: 'Animator готов к запуску'
    }

    this._tick = this._tick.bind(this)
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

    if (!this._initPixi()) {
      console.error('[Animator] Не удалось инициализировать PixiJS')
      return
    }

    // Создать и инициализировать локацию.
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
    console.log('[Animator] Запущен')
  }

  stop() {
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

  _initPixi() {
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

    if (!this._isWebGLAvailable()) {
      this.status = {
        ok: false,
        mode: 'fallback',
        message: 'Анимация недоступна: WebGL не поддерживается в этом браузере'
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

      this.status = {
        ok: true,
        mode: 'pixi',
        message: 'Animator работает через PixiJS'
      }
      return true
    } catch (error) {
      console.error('[Animator] Ошибка инициализации PixiJS:', error)
      this.status = {
        ok: false,
        mode: 'fallback',
        message: `Анимация недоступна: ${error.message || 'не удалось инициализировать PixiJS'}`
      }
      return false
    }
  }

  _isWebGLAvailable() {
    try {
      const testCanvas = document.createElement('canvas')
      const gl = testCanvas.getContext('webgl2')
        || testCanvas.getContext('webgl')
        || testCanvas.getContext('experimental-webgl')
      return Boolean(gl)
    } catch (_error) {
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

  _destroyPixiApp() {
    if (!this.pixiApp) return
    this.pixiApp.ticker.remove(this._tick)
    this.pixiApp.stage.removeChildren()
    this.pixiApp.destroy(false, {
      children: true,
      texture: false,
      baseTexture: false
    })
    this.pixiApp = null
  }
}
