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

/**
 * Инициализация приложения
 */
function init() {
  // Получить элементы
  bpmSlider = document.getElementById('bpm-slider')
  bpmValue = document.getElementById('bpm-value')
  durationInput = document.getElementById('duration-input')
  devModeCheckbox = document.getElementById('dev-mode-checkbox')
  startButton = document.getElementById('start-button')

  // Загрузить настройки
  loadSettings()

  // Установить обработчики событий
  bpmSlider.addEventListener('input', onBpmChange)
  durationInput.addEventListener('change', onDurationChange)
  devModeCheckbox.addEventListener('change', onDevModeChange)
  startButton.addEventListener('click', onStartClick)

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
function onStartClick() {
  const settings = {
    bpm: parseInt(bpmSlider.value, 10),
    duration: parseInt(durationInput.value, 10),
    devMode: devModeCheckbox.checked
  }

  console.log('[App] Старт занятия с настройками:', settings)

  // TODO (US-002): Запустить метроном, датчик, перейти на Session Screen
  alert(`Занятие запущено!\nBPM: ${settings.bpm}\nВремя: ${settings.duration} мин\nDev Mode: ${settings.devMode}`)
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', init)
