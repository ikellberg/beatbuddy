import { MetronomeEngine } from './MetronomeEngine.js'
import { SensorManager } from './SensorManager.js'
import { RhythmAnalyzer } from './RhythmAnalyzer.js'
import { Animator } from './Animator.js'

// Ключи localStorage
const SETTINGS_KEY = 'beatBuddySettings'

// Настройки по умолчанию
const DEFAULT_SETTINGS = {
  bpm: 120,
  duration: 5,
  devMode: false
}

// Элементы UI
let bpmSlider
let bpmValue
let durationInput
let devModeCheckbox
let startButton

// Session Screen
let sessionScreen
let setupScreen
let stopButton
let metronomeStatus

// Метроном
let metronome = null

// Сенсор ударов
let sensor = null

// Анализатор ритма
let rhythmAnalyzer = null

// Аниматор
let animator = null

/**
 * Инициализация приложения
 */
function init() {
  // Получить элементы Setup Screen
  bpmSlider = document.getElementById('bpm-slider')
  bpmValue = document.getElementById('bpm-value')
  durationInput = document.getElementById('duration-input')
  devModeCheckbox = document.getElementById('dev-mode-checkbox')
  startButton = document.getElementById('start-button')

  // Получить элементы Session Screen
  sessionScreen = document.getElementById('session-screen')
  setupScreen = document.getElementById('setup-screen')
  stopButton = document.getElementById('stop-button')
  metronomeStatus = document.getElementById('metronome-status')

  // Загрузить настройки
  loadSettings()

  // Установить обработчики событий
  bpmSlider.addEventListener('input', onBpmChange)
  durationInput.addEventListener('change', onDurationChange)
  devModeCheckbox.addEventListener('change', onDevModeChange)
  startButton.addEventListener('click', onStartClick)
  stopButton.addEventListener('click', onStopClick)

  console.log('[App] Инициализация завершена')
}

/**
 * Загрузить настройки из localStorage
 */
function loadSettings() {
  let settings = DEFAULT_SETTINGS

  try {
    const savedSettings = localStorage.getItem(SETTINGS_KEY)
    if (savedSettings) {
      settings = JSON.parse(savedSettings)
    }
  } catch (error) {
    console.warn('[App] Ошибка загрузки настроек:', error)
    settings = DEFAULT_SETTINGS
  }

  // Применить настройки к UI
  bpmSlider.value = settings.bpm
  bpmValue.textContent = settings.bpm
  durationInput.value = settings.duration
  devModeCheckbox.checked = settings.devMode

  console.log('[App] Настройки загружены:', settings)
}

/**
 * Сохранить настройки в localStorage
 */
function saveSettings() {
  const settings = {
    bpm: parseInt(bpmSlider.value, 10),
    duration: parseInt(durationInput.value, 10),
    devMode: devModeCheckbox.checked
  }

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  console.log('[App] Настройки сохранены:', settings)
}

/**
 * Обработчик изменения BPM
 */
function onBpmChange() {
  const bpm = parseInt(bpmSlider.value, 10)

  // Валидация
  if (bpm < 40 || bpm > 200) {
    console.warn(`[App] BPM вне диапазона: ${bpm}`)
    return
  }

  bpmValue.textContent = bpm
  saveSettings()
}

/**
 * Обработчик изменения времени занятия
 */
function onDurationChange() {
  const duration = parseInt(durationInput.value, 10)

  // Валидация
  if (duration < 1) {
    console.warn(`[App] Время занятия < 1: ${duration}`)
    durationInput.value = 1
  }

  if (duration > 60) {
    console.warn(`[App] Время занятия > 60: ${duration}`)
    durationInput.value = 60
  }

  saveSettings()
}

/**
 * Обработчик изменения Dev Mode
 */
function onDevModeChange() {
  saveSettings()
}

/**
 * Обработчик клика на кнопку Старт
 */
async function onStartClick() {
  const settings = {
    bpm: parseInt(bpmSlider.value, 10),
    duration: parseInt(durationInput.value, 10),
    devMode: devModeCheckbox.checked
  }

  console.log('[App] Старт занятия с настройками:', settings)

  // Переключить экраны: скрыть Setup, показать Session
  setupScreen.style.display = 'none'
  sessionScreen.style.display = 'block'

  // Создать и запустить метроном
  metronome = new MetronomeEngine()
  metronome.start(settings.bpm)

  // Обновить индикатор статуса
  metronomeStatus.textContent = `Метроном: ▶️ Работает (${settings.bpm} BPM)`

  console.log(`[App] Метроном запущен: BPM=${settings.bpm}, интервал=${(60/settings.bpm).toFixed(3)}s`)

  // Создать анализатор ритма (учитываем задержку первого клика = 60/bpm)
  const sessionStartTime = performance.now() / 1000
  const firstBeatDelay = 60 / settings.bpm
  rhythmAnalyzer = new RhythmAnalyzer(sessionStartTime + firstBeatDelay, settings.bpm, 100)

  console.log(`[App] RhythmAnalyzer создан: startTime=${(sessionStartTime + firstBeatDelay).toFixed(3)}s, threshold=±100ms`)

  // Создать и запустить аниматор
  const canvas = document.getElementById('rhythm-canvas')
  if (!canvas) {
    console.error('[App] Canvas не найден')
    return
  }
  animator = new Animator(canvas, settings.bpm)
  animator.start()
  console.log('[App] Animator запущен')

  // Создать и подключить сенсор
  const sensorType = SensorManager.getTypeFromSettings(settings.devMode)
  sensor = SensorManager.create(sensorType)

  sensor.onHit((event) => {
    console.log(`[App] Hit received: ${event.timestamp.toFixed(2)}ms from ${event.source}`)

    // Передать удар в анализатор
    if (rhythmAnalyzer) {
      const result = rhythmAnalyzer.recordHit(event.timestamp / 1000)

      const statusIcon = result.isHit ? '✅ HIT' : '❌ MISS'
      const deviationText = result.deviation >= 0
        ? `+${result.deviation.toFixed(0)}ms`
        : `${result.deviation.toFixed(0)}ms`

      console.log(`[App] ${statusIcon} | beat=${result.beatNumber} | deviation=${deviationText}`)

      // Передать результат в аниматор
      if (animator) {
        animator.onHit(result)
      }

      // Логировать текущую статистику каждые 10 ударов
      const stats = rhythmAnalyzer.getAccuracy()
      if (stats.totalStrikes % 10 === 0) {
        console.log(`[App] Stats: ${stats.accurateHits}/${stats.totalStrikes} (${stats.accuracyPercent}%)`)
      }
    }
  })

  try {
    await sensor.connect()
    console.log('[App] Sensor connected:', sensor.getStatus())
  } catch (error) {
    console.error('[App] Failed to connect sensor:', error)
  }

  console.log('[App] Session Screen активирован')
}

/**
 * Обработчик клика на кнопку Стоп
 */
function onStopClick() {
  console.log('[App] Остановка занятия')

  // Вывести финальную статистику ритма
  if (rhythmAnalyzer) {
    const stats = rhythmAnalyzer.getAccuracy()
    console.log(`[App] Final accuracy: ${stats.accurateHits}/${stats.totalStrikes} (${stats.accuracyPercent}%)`)
    rhythmAnalyzer = null
  }

  // Остановить аниматор
  if (animator) {
    animator.stop()
    animator = null
  }

  // Вывести статистику метронома
  if (metronome) {
    console.log(`[App] Total clicks: ${metronome.clickCount}`)

    // Остановить метроном
    metronome.stop()
    metronome = null
  }

  // Отключить сенсор
  if (sensor) {
    sensor.disconnect()
    sensor = null
  }

  // Переключить экраны: показать Setup, скрыть Session
  sessionScreen.style.display = 'none'
  setupScreen.style.display = 'block'

  console.log('[App] Возврат в Setup Screen')
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', init)
