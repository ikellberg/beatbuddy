/**
 * Animator — минимальная PixiJS анимация для ритма (без волн).
 *
 * Публичный API сохранён для app.js: start(), stop(), onHit(result).
 * Визуал: центральный пульс в BPM + короткая подсветка зоны при ударе.
 */
export class Animator {
  /**
   * @param {HTMLCanvasElement} canvasElement
   * @param {number} bpm
   * @param {number|null} firstBeatTimeSec - время первого бита в шкале performance.now()/1000
   */
  constructor(canvasElement, bpm, firstBeatTimeSec = null) {
    this.canvas = canvasElement
    this.bpm = bpm
    this.firstBeatTimeSec = Number.isFinite(firstBeatTimeSec) ? firstBeatTimeSec : null

    this.running = false
    this.startTime = 0

    this.pixiApp = null
    this.graphics = null

    this.hitFlash = null

    this.colors = {
      base: 0xDDE6FF,
      perfect: 0x4CAF50,
      good: 0xFFC107,
      miss: 0xF44336
    }

    this.status = {
      ok: true,
      mode: 'pixi',
      message: 'Animator готов к запуску'
    }

    this._tick = this._tick.bind(this)
    console.log(`[Animator] Создан (PixiJS, minimal): BPM=${bpm}`)
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

    if (this.pixiApp) {
      this.pixiApp.ticker.remove(this._tick)
      this.pixiApp.stage.removeChildren()
      // Не удаляем shared текстуры Pixi, чтобы не ловить артефакты при повторном старте.
      this.pixiApp.destroy(false, {
        children: true,
        texture: false,
        baseTexture: false
      })
    }

    this.pixiApp = null
    this.graphics = null
    this.hitFlash = null

    console.log('[Animator] Остановлен')
  }

  /**
   * @param {{zone: 'perfect' | 'good' | 'miss'}} result
   */
  onHit(result) {
    if (!this.running || !this.graphics) {
      return
    }

    const zone = result.zone === 'perfect' || result.zone === 'good' || result.zone === 'miss'
      ? result.zone
      : 'miss'

    const flashMs = zone === 'perfect' ? 320 : zone === 'good' ? 240 : 180
    const maxAlpha = zone === 'perfect' ? 0.55 : zone === 'good' ? 0.45 : 0.35

    this.hitFlash = {
      zone,
      start: performance.now(),
      durationMs: flashMs,
      maxAlpha
    }
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

      this.graphics = new pixi.Graphics()
      this.pixiApp.stage.addChild(this.graphics)

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
        message: 'Анимация недоступна: не удалось инициализировать PixiJS'
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
    if (!this.running || !this.pixiApp || !this.graphics) {
      return
    }

    const width = this.pixiApp.screen.width
    const height = this.pixiApp.screen.height
    const centerX = width / 2
    const centerY = height / 2
    const minSide = Math.min(width, height)

    const nowSec = performance.now() / 1000
    const beatStartSec = this.firstBeatTimeSec ?? (this.startTime / 1000)
    const beatsFromStart = ((nowSec - beatStartSec) * this.bpm) / 60
    const phase = ((beatsFromStart % 1) + 1) % 1

    // Пик пульса на самом бите (phase=0,1,2...), минимум в середине интервала.
    const pulse = (Math.cos(phase * Math.PI * 2) + 1) / 2

    const baseRadius = minSide * 0.12
    const pulseRadius = baseRadius + pulse * (minSide * 0.05)

    this.graphics.clear()

    // Базовая мягкая подсветка в такт.
    this.graphics.beginFill(this.colors.base, 0.16 + pulse * 0.18)
    this.graphics.drawCircle(centerX, centerY, pulseRadius * 1.8)
    this.graphics.endFill()

    this.graphics.beginFill(this.colors.base, 0.36 + pulse * 0.22)
    this.graphics.drawCircle(centerX, centerY, pulseRadius)
    this.graphics.endFill()

    // Короткая цветовая подсветка зоны попадания.
    if (this.hitFlash) {
      const now = performance.now()
      const progress = (now - this.hitFlash.start) / this.hitFlash.durationMs

      if (progress >= 1) {
        this.hitFlash = null
      } else {
        const fade = 1 - progress
        const color = this.colors[this.hitFlash.zone]
        const alpha = this.hitFlash.maxAlpha * fade

        this.graphics.beginFill(color, alpha * 0.22)
        this.graphics.drawCircle(centerX, centerY, pulseRadius * 2.3)
        this.graphics.endFill()

        this.graphics.lineStyle(8, color, alpha)
        this.graphics.drawCircle(centerX, centerY, pulseRadius * 1.25)
      }
    }
  }
}
