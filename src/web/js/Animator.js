/**
 * Animator — визуальная обратная связь для ритма
 *
 * Рисует бегущие волны от центра canvas в такт метроному.
 * При попадании — зелёная волна, при промахе — красная.
 */
export class Animator {
  // Константы анимации
  static HIT_WAVE_SPEED = 3
  static MISS_WAVE_SPEED = 5
  static MAX_WAVES = 20
  static ALPHA_DECAY = 0.02

  /**
   * @param {HTMLCanvasElement} canvasElement - canvas для рисования
   * @param {number} bpm - темп метронома
   */
  constructor(canvasElement, bpm) {
    this.canvas = canvasElement
    this.ctx = this.canvas.getContext('2d')
    this.bpm = bpm

    // Состояние анимации
    this.running = false
    this.animationId = null
    this.startTime = null

    // Волны от ударов (массив объектов {radius, color, alpha, speed})
    this.hitWaves = []

    // Цвета (совпадают с CSS переменными)
    this.colors = {
      hit: '#4CAF50',      // зелёный --primary-color
      miss: '#f44336',     // красный .danger-button
      rhythm: '#CCCCCC'    // светло-серый для фоновых волн
    }

    console.log(`[Animator] Создан: BPM=${bpm}`)
  }

  /**
   * Запустить анимацию
   */
  start() {
    if (this.running) {
      console.warn('[Animator] Уже запущен')
      return
    }

    this.running = true
    this.startTime = performance.now()
    console.log('[Animator] Запущен')

    this._animate()
  }

  /**
   * Остановить анимацию и очистить canvas
   */
  stop() {
    if (!this.running) {
      return
    }

    this.running = false

    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }

    // Очистить canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    console.log('[Animator] Остановлен')
  }

  /**
   * Обработать удар — добавить визуальную волну
   * @param {{isHit: boolean, deviation: number, beatNumber: number}} result
   */
  onHit(result) {
    if (!this.running) {
      return
    }

    const color = result.isHit ? this.colors.hit : this.colors.miss
    const speed = result.isHit ? Animator.HIT_WAVE_SPEED : Animator.MISS_WAVE_SPEED

    this.hitWaves.push({
      radius: 0,
      color,
      alpha: 1.0,
      speed
    })

    // Ограничить количество волн для производительности
    if (this.hitWaves.length > Animator.MAX_WAVES) {
      this.hitWaves.shift()
    }

    console.log(`[Animator] Волна: ${result.isHit ? 'ПОПАДАНИЕ' : 'ПРОМАХ'}, deviation=${result.deviation.toFixed(0)}ms`)
  }

  /**
   * Основной цикл анимации
   * @private
   */
  _animate() {
    if (!this.running) {
      return
    }

    this._draw()
    this.animationId = requestAnimationFrame(() => this._animate())
  }

  /**
   * Нарисовать кадр
   * @private
   */
  _draw() {
    const { width, height } = this.canvas
    const centerX = width / 2
    const centerY = height / 2
    const maxRadius = Math.max(width, height) / 2

    // Очистить canvas
    this.ctx.clearRect(0, 0, width, height)

    const currentTime = performance.now()
    const elapsedSeconds = (currentTime - this.startTime) / 1000

    // Фоновая волна в такт метроному
    this._drawRhythmWave(centerX, centerY, maxRadius, elapsedSeconds)

    // Волны от ударов
    this._drawHitWaves(centerX, centerY, maxRadius)
  }

  /**
   * Нарисовать фоновую волну в такт метроному
   * @private
   */
  _drawRhythmWave(centerX, centerY, maxRadius, elapsedSeconds) {
    // Количество волн, прошедших с начала
    const beatsPassed = elapsedSeconds * this.bpm / 60

    // Радиус текущей волны (0..1)
    const wavePhase = beatsPassed % 1  // дробная часть
    const radius = wavePhase * maxRadius

    // Alpha уменьшается по мере роста радиуса
    const alpha = 1 - wavePhase

    if (alpha > 0) {
      this.ctx.beginPath()
      this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
      this.ctx.strokeStyle = `rgba(204, 204, 204, ${alpha * 0.5})`  // серый с прозрачностью
      this.ctx.lineWidth = 3
      this.ctx.stroke()
    }
  }

  /**
   * Нарисовать волны от ударов
   * @private
   */
  _drawHitWaves(centerX, centerY, maxRadius) {
    // Обновить и нарисовать каждую волну
    for (let i = this.hitWaves.length - 1; i >= 0; i--) {
      const wave = this.hitWaves[i]

      // Увеличить радиус
      wave.radius += wave.speed

      // Уменьшить прозрачность
      wave.alpha -= Animator.ALPHA_DECAY

      // Удалить waves, которые исчезли
      if (wave.alpha <= 0 || wave.radius > maxRadius) {
        this.hitWaves.splice(i, 1)
        continue
      }

      // Нарисовать волну
      this.ctx.beginPath()
      this.ctx.arc(centerX, centerY, wave.radius, 0, Math.PI * 2)
      this.ctx.strokeStyle = this._hexToRgba(wave.color, wave.alpha)
      this.ctx.lineWidth = 5
      this.ctx.stroke()
    }
  }

  /**
   * Конвертировать hex цвет в rgba с alpha
   * @private
   */
  _hexToRgba(hex, alpha) {
    // Убрать # если есть
    hex = hex.replace('#', '')

    // Парсить RGB
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)

    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
}
