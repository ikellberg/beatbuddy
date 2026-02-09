import { MetronomeEngine } from './MetronomeEngine.js'
import { SensorManager } from './SensorManager.js'
import { RhythmAnalyzer } from './RhythmAnalyzer.js'
import { Animator } from './Animator.js'
import { DINO_PHRASES, pickPhraseWithoutImmediateRepeat } from './DinoPhrases.js'
import * as LocationRegistry from './locations/LocationRegistry.js'

// Ключи localStorage
const SETTINGS_KEY = 'beatBuddySettings'

// Настройки по умолчанию
const DEFAULT_SETTINGS = {
  bpm: 60,
  duration: 5,
  devMode: false,
  locationId: LocationRegistry.getDefaultId(),
  dinoSpeechEnabled: true
}

// Элементы UI
let bpmSlider
let bpmValue
let durationInput
let devModeCheckbox
let locationSelect
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

// Stats Screen
let statsScreen = null
let statsPerfect = null
let statsGood = null
let statsMiss = null
let statsDuration = null
let statsBestStreak = null
let sessionStartTimestamp = null

// Streak display
let streakDisplay = null
let streakValue = null
let streakBestValue = null
let committedBestStreak = 0

// Dino speech bubble
let dinoSpeech = null
let dinoSpeechText = null
let dinoSpeechEnabled = DEFAULT_SETTINGS.dinoSpeechEnabled
let dinoSpeechLastShownAt = 0
let dinoSpeechLastByGroup = { positive: '', miss: '' }
let dinoSpeechFadeTimeout = null
let dinoSpeechHideTimeout = null

const DINO_SPEECH_COOLDOWN_MS = 420
const DINO_SPEECH_TTL_MS = 1100
const DINO_SPEECH_FADE_MS = 220

// Таймер занятия
let timerDisplay = null
let sessionTimerInterval = null
let sessionDurationMs = 0
let countdownInterval = null
let countdownAborted = false
let isStopping = false

/**
 * Инициализация приложения
 */
function init() {
  // Получить элементы Setup Screen
  bpmSlider = document.getElementById('bpm-slider')
  bpmValue = document.getElementById('bpm-value')
  durationInput = document.getElementById('duration-input')
  devModeCheckbox = document.getElementById('dev-mode-checkbox')
  locationSelect = document.getElementById('location-select')
  startButton = document.getElementById('start-button')

  // Заполнить select локациями из реестра
  populateLocationSelect()

  // Получить элементы Session Screen
  sessionScreen = document.getElementById('session-screen')
  setupScreen = document.getElementById('setup-screen')
  stopButton = document.getElementById('stop-button')
  metronomeStatus = document.getElementById('metronome-status')

  // Получить элементы Stats Screen
  statsScreen = document.getElementById('stats-screen')
  statsPerfect = document.getElementById('stats-perfect')
  statsGood = document.getElementById('stats-good')
  statsMiss = document.getElementById('stats-miss')
  statsDuration = document.getElementById('stats-duration')
  statsBestStreak = document.getElementById('stats-best-streak')
  document.getElementById('new-session-button').addEventListener('click', onNewSessionClick)

  // Streak display
  streakDisplay = document.getElementById('streak-display')
  streakValue = document.getElementById('streak-value')
  streakBestValue = document.getElementById('streak-best-value')
  dinoSpeech = document.getElementById('dino-speech')
  dinoSpeechText = document.getElementById('dino-speech-text')

  // Получить элемент таймера
  timerDisplay = document.getElementById('timer-display')

  // Загрузить настройки
  loadSettings()

  // Установить обработчики событий
  bpmSlider.addEventListener('input', onBpmChange)
  durationInput.addEventListener('change', onDurationChange)
  devModeCheckbox.addEventListener('change', onDevModeChange)
  locationSelect.addEventListener('change', onLocationChange)
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
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) }
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
  if (locationSelect) {
    locationSelect.value = settings.locationId || LocationRegistry.getDefaultId()
  }
  // Default-on behavior for backward compatibility with old localStorage shape.
  dinoSpeechEnabled = settings.dinoSpeechEnabled !== false

  console.log('[App] Настройки загружены:', settings)
}

/**
 * Сохранить настройки в localStorage
 */
function saveSettings() {
  const settings = {
    bpm: parseInt(bpmSlider.value, 10),
    duration: parseInt(durationInput.value, 10),
    devMode: devModeCheckbox.checked,
    locationId: locationSelect ? locationSelect.value : LocationRegistry.getDefaultId(),
    dinoSpeechEnabled
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
  if (bpm < 50 || bpm > 70) {
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
 * Обработчик изменения локации
 */
function onLocationChange() {
  saveSettings()
}

/**
 * Заполнить select локациями из LocationRegistry
 */
function populateLocationSelect() {
  if (!locationSelect) return

  const locations = LocationRegistry.getAll()
  locationSelect.innerHTML = ''

  for (const loc of locations) {
    const option = document.createElement('option')
    option.value = loc.id
    option.textContent = loc.name
    locationSelect.appendChild(option)
  }
}

/**
 * Обратный отсчёт перед началом занятия
 * @param {number} seconds - количество секунд
 * @returns {Promise<boolean>} - true если завершился, false если прерван
 */
function countdown(seconds) {
  return new Promise((resolve) => {
    countdownAborted = false
    let remaining = seconds
    timerDisplay.textContent = remaining

    countdownInterval = setInterval(() => {
      if (countdownAborted) {
        clearInterval(countdownInterval)
        countdownInterval = null
        resolve(false)
        return
      }

      remaining--
      if (remaining <= 0) {
        clearInterval(countdownInterval)
        countdownInterval = null
        resolve(true)
      } else {
        timerDisplay.textContent = remaining
      }
    }, 1000)
  })
}

/**
 * Прервать обратный отсчёт (если он идёт)
 */
function abortCountdown() {
  if (countdownInterval) {
    countdownAborted = true
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

/**
 * Обновить отображение таймера
 * @param {number} ms - оставшееся время в миллисекундах
 */
function updateTimerDisplay(ms) {
  if (!timerDisplay) return

  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Обработчик тика таймера (каждую секунду)
 */
function onTimerTick() {
  if (isStopping) return

  const elapsedMs = performance.now() - sessionStartTimestamp
  const remainingMs = sessionDurationMs - elapsedMs

  if (remainingMs <= 0) {
    onStopClick()
    return
  }

  updateTimerDisplay(remainingMs)
}

/** Пороги streak для визуальных эффектов */
const STREAK_THRESHOLDS = [20, 10, 5]

function clearDinoSpeechTimers() {
  if (dinoSpeechFadeTimeout) {
    clearTimeout(dinoSpeechFadeTimeout)
    dinoSpeechFadeTimeout = null
  }
  if (dinoSpeechHideTimeout) {
    clearTimeout(dinoSpeechHideTimeout)
    dinoSpeechHideTimeout = null
  }
}

function resetDinoSpeech() {
  clearDinoSpeechTimers()
  dinoSpeechLastShownAt = 0
  if (!dinoSpeech || !dinoSpeechText) return
  dinoSpeechText.textContent = ''
  dinoSpeech.classList.remove('dino-speech--positive', 'dino-speech--miss', 'dino-speech--fade-out')
  dinoSpeech.classList.add('dino-speech--hidden')
}

function pickDinoPhrase(group) {
  const phrases = DINO_PHRASES[group]
  if (!phrases || phrases.length === 0) return ''
  const next = pickPhraseWithoutImmediateRepeat(phrases, dinoSpeechLastByGroup[group] || '')
  dinoSpeechLastByGroup[group] = next
  return next
}

function showDinoSpeech(zone) {
  if (!dinoSpeechEnabled || !dinoSpeech || !dinoSpeechText) return

  const now = performance.now()
  if (now - dinoSpeechLastShownAt < DINO_SPEECH_COOLDOWN_MS) return
  dinoSpeechLastShownAt = now

  const group = zone === 'miss' ? 'miss' : 'positive'
  const text = pickDinoPhrase(group)
  if (!text) return

  clearDinoSpeechTimers()
  dinoSpeechText.textContent = text
  dinoSpeech.classList.remove('dino-speech--hidden', 'dino-speech--fade-out', 'dino-speech--positive', 'dino-speech--miss')
  dinoSpeech.classList.add(group === 'miss' ? 'dino-speech--miss' : 'dino-speech--positive')

  dinoSpeechFadeTimeout = setTimeout(() => {
    dinoSpeech?.classList.add('dino-speech--fade-out')
  }, DINO_SPEECH_TTL_MS - DINO_SPEECH_FADE_MS)

  dinoSpeechHideTimeout = setTimeout(() => {
    if (!dinoSpeech || !dinoSpeechText) return
    dinoSpeech.classList.add('dino-speech--hidden')
    dinoSpeech.classList.remove('dino-speech--fade-out', 'dino-speech--positive', 'dino-speech--miss')
    dinoSpeechText.textContent = ''
  }, DINO_SPEECH_TTL_MS)
}

/**
 * Обновить streak-дисплей на Session Screen
 * @param {number} streak - текущий streak
 * @param {number} bestStreak - лучший streak за сессию
 * @param {number} misses - количество miss
 */
function updateStreakDisplay(streak, bestStreak = 0, misses = 0) {
  if (!streakDisplay || !streakValue || !streakBestValue) return

  streakValue.textContent = streak
  streakBestValue.textContent = bestStreak
  const shouldShowBest = bestStreak > 0 && misses > 0
  streakBestValue.parentElement?.classList.toggle('streak-best--hidden', !shouldShowBest)

  // Скрыть только когда нет ни текущей, ни лучшей серии
  if (streak === 0 && bestStreak === 0) {
    streakDisplay.classList.remove('streak--visible')
    streakDisplay.classList.add('streak--hidden')
  } else {
    streakDisplay.classList.remove('streak--hidden')
    streakDisplay.classList.add('streak--visible')

    // Bump-анимация при каждом инкременте
    streakDisplay.classList.remove('streak--bump')
    // Force reflow для перезапуска анимации
    void streakDisplay.offsetWidth
    streakDisplay.classList.add('streak--bump')
  }

  // Снять все пороговые классы, поставить актуальный
  for (const t of STREAK_THRESHOLDS) {
    streakDisplay.classList.remove(`streak-${t}`)
  }
  for (const t of STREAK_THRESHOLDS) {
    if (streak >= t) {
      streakDisplay.classList.add(`streak-${t}`)
      break
    }
  }
}

/**
 * Обработчик клика на кнопку Старт
 */
async function onStartClick() {
  const settings = {
    bpm: parseInt(bpmSlider.value, 10),
    duration: parseInt(durationInput.value, 10),
    devMode: devModeCheckbox.checked,
    locationId: locationSelect ? locationSelect.value : LocationRegistry.getDefaultId()
  }

  console.log('[App] Старт занятия с настройками:', settings)

  // Сбросить флаг остановки
  isStopping = false

  // Переключить экраны: скрыть Setup, показать Session
  setupScreen.style.display = 'none'
  sessionScreen.style.display = 'block'
  committedBestStreak = 0
  updateStreakDisplay(0, 0)
  resetDinoSpeech()

  // === ОБРАТНЫЙ ОТСЧЁТ 3-2-1 ===
  const countdownCompleted = await countdown(3)

  // Если отсчёт был прерван (нажали Stop), выходим
  if (!countdownCompleted) {
    console.log('[App] Обратный отсчёт прерван')
    timerDisplay.textContent = ''
    return
  }

  // === НАЧАЛО ЗАНЯТИЯ ===
  // Запомнить время старта ПОСЛЕ обратного отсчёта
  sessionStartTimestamp = performance.now()

  // Создать и запустить метроном
  metronome = new MetronomeEngine()
  metronome.start(settings.bpm)

  // Обновить индикатор статуса
  metronomeStatus.textContent = `Метроном: ▶️ Работает (${settings.bpm} BPM)`
  const metronomeIndicator = document.getElementById('metronome-indicator')
  if (metronomeIndicator) {
    metronomeIndicator.style.display = 'none'
  }

  console.log(`[App] Метроном запущен: BPM=${settings.bpm}, интервал=${(60/settings.bpm).toFixed(3)}s`)

  // Синхронизируем анализатор с первым СЛЫШИМЫМ кликом метронома.
  const fallbackFirstBeatTime = (performance.now() / 1000) + (60 / settings.bpm)
  const firstBeatTime = metronome.getFirstClickPerformanceTime() ?? fallbackFirstBeatTime
  rhythmAnalyzer = new RhythmAnalyzer(firstBeatTime, settings.bpm)

  console.log(`[App] RhythmAnalyzer создан: startTime=${firstBeatTime.toFixed(3)}s, thresholds: perfect=±75ms, good=±150ms`)

  // Создать и запустить аниматор
  const canvas = document.getElementById('rhythm-canvas')
  if (!canvas) {
    console.error('[App] Canvas не найден')
    return
  }
  animator = new Animator(canvas, settings.bpm, firstBeatTime, settings.locationId)
  animator.start()
  window.__debugAnimator = settings.devMode ? animator : null
  const animatorStatus = typeof animator.getStatus === 'function'
    ? animator.getStatus()
    : { ok: true, message: 'Animator status unknown' }
  if (!animatorStatus.ok) {
    metronomeStatus.textContent = animatorStatus.message || 'Анимация недоступна'
    if (metronomeIndicator) {
      metronomeIndicator.style.display = 'block'
    }
    console.warn('[App] Animator fallback:', animatorStatus)
  } else {
    console.log('[App] Animator запущен')
  }

  // Создать и подключить сенсор
  const sensorType = SensorManager.getTypeFromSettings(settings.devMode)
  sensor = SensorManager.create(sensorType)

  sensor.onHit((event) => {
    console.log(`[App] Hit received: ${event.timestamp.toFixed(2)}ms from ${event.source}`)

    // Передать удар в анализатор
    if (rhythmAnalyzer) {
      const result = rhythmAnalyzer.recordHit(event.timestamp / 1000)

      // Логирование с эмодзи по зоне
      const icons = { perfect: '🟢 PERFECT', good: '🟡 GOOD', miss: '🔴 MISS' }
      const deviationText = result.deviation >= 0
        ? `+${result.deviation.toFixed(0)}ms`
        : `${result.deviation.toFixed(0)}ms`

      console.log(`[App] ${icons[result.zone]} | beat=${result.beatNumber} | deviation=${deviationText}`)

      // Передать результат в аниматор
      if (animator) {
        animator.onHit(result)
      }

      // Обновить streak UI
      const stats = rhythmAnalyzer.getAccuracy()
      if (result.zone === 'miss') {
        committedBestStreak = Math.max(committedBestStreak, stats.bestStreak)
      }
      updateStreakDisplay(stats.streak, committedBestStreak, stats.misses)
      // Runner draws in-canvas speech near the hero; overlay speech is for other locations.
      // `settings.locationId` is fixed for the current session lifecycle.
      if (settings.locationId !== 'runner') {
        showDinoSpeech(result.zone)
      }

      // Логировать текущую статистику каждые 10 ударов
      if (stats.totalStrikes % 10 === 0) {
        console.log(`[App] Stats: P=${stats.perfectHits} G=${stats.goodHits} M=${stats.misses} streak=${stats.streak} best=${stats.bestStreak} (total=${stats.totalStrikes})`)
      }
    }
  })

  try {
    await sensor.connect()
    console.log('[App] Sensor connected:', sensor.getStatus())
  } catch (error) {
    console.error('[App] Failed to connect sensor:', error)
  }

  // === ЗАПУСТИТЬ ТАЙМЕР ЗАНЯТИЯ ===
  sessionDurationMs = settings.duration * 60 * 1000
  updateTimerDisplay(sessionDurationMs)
  sessionTimerInterval = setInterval(onTimerTick, 1000)

  console.log('[App] Session Screen активирован')
}

/**
 * Обработчик клика на кнопку Стоп
 */
function onStopClick() {
  // Защита от повторных вызовов
  if (isStopping) {
    console.log('[App] onStopClick() уже выполняется, пропускаем')
    return
  }
  isStopping = true

  console.log('[App] Остановка занятия')

  // Прервать обратный отсчёт (если он ещё идёт)
  abortCountdown()

  // Остановить таймер занятия
  if (sessionTimerInterval) {
    clearInterval(sessionTimerInterval)
    sessionTimerInterval = null
  }
  resetDinoSpeech()

  // Собрать статистику ДО обнуления rhythmAnalyzer
  let stats = { totalStrikes: 0, perfectHits: 0, goodHits: 0, misses: 0, streak: 0, bestStreak: 0 }
  if (rhythmAnalyzer) {
    stats = rhythmAnalyzer.getAccuracy()
    console.log(`[App] Final stats: P=${stats.perfectHits} G=${stats.goodHits} M=${stats.misses} best_streak=${stats.bestStreak} (total=${stats.totalStrikes})`)
    rhythmAnalyzer = null
  }

  // Вычислить время занятия (если sessionStartTimestamp не установлен — показать 0:00)
  const elapsedMs = sessionStartTimestamp ? performance.now() - sessionStartTimestamp : 0
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`

  // Остановить аниматор
  if (animator) {
    animator.stop()
    animator = null
  }
  window.__debugAnimator = null

  // Вывести статистику метронома и остановить
  if (metronome) {
    console.log(`[App] Total clicks: ${metronome.clickCount}`)
    metronome.stop()
    metronome = null
  }

  // Отключить сенсор
  if (sensor) {
    sensor.disconnect()
    sensor = null
  }

  // Сбросить sessionStartTimestamp для следующего занятия
  sessionStartTimestamp = null
  metronomeStatus.textContent = 'Метроном: ⏸️ Остановлен'
  const metronomeIndicator = document.getElementById('metronome-indicator')
  if (metronomeIndicator) {
    metronomeIndicator.style.display = 'none'
  }

  // Переключить экраны: показать Stats, скрыть Session
  sessionScreen.style.display = 'none'
  statsScreen.style.display = 'block'

  // Заполнить данные статистики
  statsPerfect.textContent = stats.perfectHits
  statsGood.textContent = stats.goodHits
  statsMiss.textContent = stats.misses
  statsDuration.textContent = durationText
  statsBestStreak.textContent = stats.bestStreak

  console.log('[App] Stats Screen активирован')
}

/**
 * Обработчик клика на кнопку "Новое занятие"
 */
function onNewSessionClick() {
  resetDinoSpeech()
  statsScreen.style.display = 'none'
  setupScreen.style.display = 'block'
  console.log('[App] Возврат в Setup Screen')
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', init)
