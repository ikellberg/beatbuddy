/**
 * RhythmAnalyzer — анализ точности попадания в ритм
 *
 * Определяет зону точности удара (perfect/good/miss) и вычисляет статистику.
 * НЕ зависит от MetronomeEngine — вычисляет время битов по формуле.
 */
export class RhythmAnalyzer {
  static PERFECT_THRESHOLD_MS = 75
  static GOOD_THRESHOLD_MS = 150

  /**
   * @param {number} startTime - время первого клика (секунды, performance.now())
   * @param {number} bpm - темп метронома
   */
  constructor(startTime, bpm) {
    this.startTime = startTime
    this.bpm = bpm

    // Статистика по зонам
    this.totalStrikes = 0
    this.perfectHits = 0
    this.goodHits = 0
    this.misses = 0

    // Streak
    this.streak = 0
    this.bestStreak = 0
  }

  /**
   * Обработать удар от сенсора
   * @param {number} hitTime - время удара в секундах (performance.now() / 1000)
   * @returns {{zone: 'perfect' | 'good' | 'miss', deviation: number, beatNumber: number}}
   */
  recordHit(hitTime) {
    if (!this.startTime) {
      console.warn('[RhythmAnalyzer] startTime не установлен, невозможно обработать удар')
      return { zone: 'miss', deviation: 0, beatNumber: 0 }
    }

    // Номер ближайшего бита (может быть отрицательным для ударов до первого клика)
    const beatNumber = Math.round((hitTime - this.startTime) * this.bpm / 60)

    // Ожидаемое время этого бита
    const expectedBeatTime = this.startTime + (beatNumber * 60 / this.bpm)

    // Отклонение в миллисекундах (положительное = поздно, отрицательное = рано)
    const deviation = (hitTime - expectedBeatTime) * 1000

    // Определение зоны по отклонению
    const absDeviation = Math.abs(deviation)
    let zone
    if (absDeviation <= RhythmAnalyzer.PERFECT_THRESHOLD_MS) {
      zone = 'perfect'
      this.perfectHits++
      this.streak++
    } else if (absDeviation <= RhythmAnalyzer.GOOD_THRESHOLD_MS) {
      zone = 'good'
      this.goodHits++
      this.streak++
    } else {
      zone = 'miss'
      this.misses++
      this.streak = 0
    }

    this.bestStreak = Math.max(this.bestStreak, this.streak)

    this.totalStrikes++

    return { zone, deviation, beatNumber }
  }

  /**
   * Получить текущую статистику
   * @returns {{totalStrikes: number, perfectHits: number, goodHits: number, misses: number, streak: number, bestStreak: number}}
   */
  getAccuracy() {
    return {
      totalStrikes: this.totalStrikes,
      perfectHits: this.perfectHits,
      goodHits: this.goodHits,
      misses: this.misses,
      streak: this.streak,
      bestStreak: this.bestStreak
    }
  }

  /**
   * Сбросить статистику
   */
  reset() {
    this.totalStrikes = 0
    this.perfectHits = 0
    this.goodHits = 0
    this.misses = 0
    this.streak = 0
    this.bestStreak = 0
  }
}
