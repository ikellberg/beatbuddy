/**
 * RhythmAnalyzer — анализ точности попадания в ритм
 *
 * Определяет, попал ли удар в такт метронома, и вычисляет статистику.
 * НЕ зависит от MetronomeEngine — вычисляет время битов по формуле.
 */
export class RhythmAnalyzer {
  /**
   * @param {number} startTime - время первого клика (секунды, performance.now())
   * @param {number} bpm - темп метронома
   * @param {number} thresholdMs - порог точности (мс), по умолчанию ±100ms
   */
  constructor(startTime, bpm, thresholdMs = 100) {
    this.startTime = startTime
    this.bpm = bpm
    this.thresholdMs = thresholdMs

    // Статистика
    this.totalStrikes = 0
    this.accurateHits = 0
    this.misses = 0
  }

  /**
   * Обработать удар от сенсора
   * @param {number} hitTime - время удара в секундах (performance.now() / 1000)
   * @returns {{isHit: boolean, deviation: number, beatNumber: number}}
   */
  recordHit(hitTime) {
    if (!this.startTime) {
      console.warn('[RhythmAnalyzer] startTime не установлен, невозможно обработать удар')
      return { isHit: false, deviation: 0, beatNumber: 0 }
    }

    // Номер ближайшего бита (может быть отрицательным для ударов до первого клика)
    const beatNumber = Math.round((hitTime - this.startTime) * this.bpm / 60)

    // Ожидаемое время этого бита
    const expectedBeatTime = this.startTime + (beatNumber * 60 / this.bpm)

    // Отклонение в миллисекундах (положительное = поздно, отрицательное = рано)
    const deviation = (hitTime - expectedBeatTime) * 1000

    // Попадание, если отклонение в пределах порога
    const isHit = Math.abs(deviation) <= this.thresholdMs

    // Обновить статистику
    this.totalStrikes++
    if (isHit) {
      this.accurateHits++
    } else {
      this.misses++
    }

    return { isHit, deviation, beatNumber }
  }

  /**
   * Получить текущую статистику
   * @returns {{totalStrikes: number, accurateHits: number, misses: number, accuracyPercent: string}}
   */
  getAccuracy() {
    const accuracyPercent = this.totalStrikes > 0
      ? (this.accurateHits / this.totalStrikes * 100).toFixed(1)
      : '0.0'

    return {
      totalStrikes: this.totalStrikes,
      accurateHits: this.accurateHits,
      misses: this.misses,
      accuracyPercent
    }
  }

  /**
   * Сбросить статистику
   */
  reset() {
    this.totalStrikes = 0
    this.accurateHits = 0
    this.misses = 0
  }
}
