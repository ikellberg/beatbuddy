/**
 * MetronomeEngine — точный метроном с Web Audio API
 *
 * Использует look-ahead scheduling для точного тайминга без дрифта:
 * - AudioContext.currentTime — аппаратное время (не зависит от event loop)
 * - Планирование звука на 100ms вперёд
 * - setInterval ТОЛЬКО для вызова scheduler, НЕ для тайминга звука
 */
export class MetronomeEngine {
  constructor() {
    this.audioContext = null
    this.nextClickTime = 0
    this.scheduleInterval = null
    this.playing = false
    this.bpm = 60

    // Метрики для проверки drift
    this.clickCount = 0
    this.startTime = null
    this.firstClickTime = null
  }

  /**
   * Запустить метроном с заданным темпом
   * @param {number} bpm - темп в BPM (50-70)
   */
  start(bpm) {
    // Guard clause: проверка, что метроном уже не запущен
    if (this.playing) {
      console.warn('[MetronomeEngine] Метроном уже запущен')
      return
    }

    // Guard clause: валидация BPM
    if (bpm < 50 || bpm > 70) {
      console.error(`[MetronomeEngine] Invalid BPM: ${bpm} (допустимый диапазон: 50-70)`)
      return
    }

    this.bpm = bpm
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()

    // Первый клик планируется через один интервал, а не мгновенно
    const secondsPerBeat = 60.0 / bpm
    this.nextClickTime = this.audioContext.currentTime + secondsPerBeat
    this.startTime = this.nextClickTime
    this.firstClickTime = this.nextClickTime
    this.playing = true

    // Сбросить метрики
    this.clickCount = 0

    console.log(`[MetronomeEngine] Started at ${bpm} BPM (interval: ${(60/bpm).toFixed(3)}s)`)

    // Запустить scheduler
    this._schedule()
    this.scheduleInterval = setInterval(() => this._schedule(), 25) // проверка каждые 25ms
  }

  /**
   * Остановить метроном
   */
  stop() {
    // Guard clause: проверка, что метроном запущен
    if (!this.playing) {
      console.warn('[MetronomeEngine] Метроном уже остановлен')
      return
    }

    clearInterval(this.scheduleInterval)
    this.scheduleInterval = null
    this.playing = false

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    console.log('[MetronomeEngine] Stopped')
  }

  /**
   * Проверить, работает ли метроном
   * @returns {boolean}
   */
  isPlaying() {
    return this.playing
  }

  /**
   * Получить текущий темп
   * @returns {number}
   */
  getBpm() {
    return this.bpm
  }

  /**
   * Оценка задержки аудиовывода (секунды)
   * @returns {number}
   */
  getOutputLatencySeconds() {
    if (!this.audioContext) {
      return 0
    }

    const outputLatency = Number.isFinite(this.audioContext.outputLatency) ? this.audioContext.outputLatency : 0
    const baseLatency = Number.isFinite(this.audioContext.baseLatency) ? this.audioContext.baseLatency : 0

    return Math.max(0, outputLatency) + Math.max(0, baseLatency)
  }

  /**
   * Получить время первого клика в шкале performance.now() (секунды).
   * Используется для синхронизации анализатора и визуала с реально слышимым битом.
   * Вызывать сразу после start(): чем позже вызов, тем менее точной может быть fallback-оценка.
   * На старых браузерах без getOutputTimestamp/outputLatency/baseLatency точность ограничена.
   * @returns {number|null}
   */
  getFirstClickPerformanceTime() {
    if (!this.audioContext || !this.firstClickTime) {
      return null
    }

    if (typeof this.audioContext.getOutputTimestamp === 'function') {
      const ts = this.audioContext.getOutputTimestamp()
      // getOutputTimestamp возвращает {contextTime: 0, performanceTime: 0} до рендеринга
      // первого блока аудио (спецификация W3C). Нули — невалидные значения,
      // их использование даёт случайный фазовый сдвиг.
      if (
        ts &&
        ts.performanceTime > 0 &&
        ts.contextTime > 0 &&
        Number.isFinite(ts.performanceTime)
      ) {
        return (ts.performanceTime / 1000) + (this.firstClickTime - ts.contextTime)
      }
    }

    // Fallback: прямой расчёт через currentTime и performance.now().
    // Работает надёжно сразу после start(), пока getOutputTimestamp ещё не отдаёт данные.
    const untilFirstBeat = this.firstClickTime - this.audioContext.currentTime
    return (performance.now() / 1000) + Math.max(0, untilFirstBeat) + this.getOutputLatencySeconds()
  }

  /**
   * Look-ahead scheduler: планирует клики заранее на 100ms вперёд
   * @private
   */
  _schedule() {
    const scheduleAheadTime = 0.1 // планируем на 100ms вперёд
    const currentTime = this.audioContext.currentTime

    // Планируем все клики, которые должны произойти в следующие 100ms
    while (this.nextClickTime < currentTime + scheduleAheadTime) {
      this._scheduleClick(this.nextClickTime)

      // Вычисляем время следующего клика
      const secondsPerBeat = 60.0 / this.bpm
      this.nextClickTime += secondsPerBeat
    }
  }

  /**
   * Запланировать один клик метронома в заданное время
   * @param {number} time - время клика (AudioContext.currentTime)
   * @private
   */
  _scheduleClick(time) {
    this.clickCount++

    // Проверка drift (каждые 100 кликов)
    if (this.clickCount % 100 === 0) {
      const expectedTime = this.startTime + (this.clickCount * 60 / this.bpm)
      const actualTime = time
      const drift = (actualTime - expectedTime) * 1000

      console.log(`[MetronomeEngine] Drift check at click #${this.clickCount}: ${drift.toFixed(3)}ms`)
    }

    // Двухтональный клик: высокий (1200Hz) + низкий (800Hz)
    const highOsc = this.audioContext.createOscillator()
    const lowOsc = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()

    highOsc.connect(gainNode)
    lowOsc.connect(gainNode)
    gainNode.connect(this.audioContext.destination)

    // Частоты для приятного звука клика
    highOsc.frequency.value = 1200
    lowOsc.frequency.value = 800

    // Короткий звук с плавным затуханием
    gainNode.gain.setValueAtTime(0.3, time)
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.02)

    highOsc.start(time)
    highOsc.stop(time + 0.02)
    lowOsc.start(time)
    lowOsc.stop(time + 0.02)
  }

}
