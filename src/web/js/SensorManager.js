/**
 * SensorManager — фабрика для создания сенсоров
 *
 * Точка входа для работы с датчиками. Создаёт нужную реализацию
 * в зависимости от режима (dev/prod).
 */
import { KeyboardSensor } from './sensors/KeyboardSensor.js'
// import { MicrophoneSensor } from './sensors/MicrophoneSensor.js'  // US-004

export const SensorType = {
  KEYBOARD: 'keyboard',
  MICROPHONE: 'microphone'
}

export class SensorManager {
  /**
   * Создать сенсор заданного типа
   * @param {string} type - тип сенсора (SensorType.KEYBOARD | SensorType.MICROPHONE)
   * @returns {KeyboardSensor}
   */
  static create(type) {
    console.log(`[SensorManager] Creating sensor: ${type}`)

    if (type === SensorType.KEYBOARD) {
      return new KeyboardSensor()
    }

    if (type === SensorType.MICROPHONE) {
      // US-004: return new MicrophoneSensor()
      console.warn('[SensorManager] MicrophoneSensor not implemented yet, falling back to KeyboardSensor')
      return new KeyboardSensor()
    }

    throw new Error(`[SensorManager] Unknown sensor type: ${type}`)
  }

  /**
   * Определить тип сенсора по настройкам
   * @param {boolean} devMode - режим разработки
   * @returns {string}
   */
  static getTypeFromSettings(devMode) {
    return devMode ? SensorType.KEYBOARD : SensorType.MICROPHONE
  }
}
