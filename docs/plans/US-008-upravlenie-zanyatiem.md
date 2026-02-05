# План US-008: Управление занятием (таймер + обратный отсчёт)

## Что нужно сделать

US-008 требует:
1. ✅ Кнопка Старт запускает метроном, датчик и таймер — **уже есть**
2. ✅ Кнопка Стоп останавливает всё и показывает статистику — **уже есть**
3. ❌ **Таймер показывает оставшееся время** — нужно добавить
4. ❌ **По истечении времени автоматически переход к статистике** — нужно добавить
5. ❌ **Обратный отсчёт 3-2-1 перед началом** — нужно добавить (запрос пользователя)

## Текущая проблема

Сейчас метроном начинает бить сразу после нажатия "Старт". Ребёнок не успевает подготовиться и пропускает первые удары.

---

## План реализации

### 1. Добавить элемент таймера в HTML

**Файл:** `src/web/index.html`

**Место вставки:** Внутри `#session-screen`, после `<canvas>`, перед `<h2>`:

```html
<!-- Session Screen -->
<div id="session-screen" style="display: none;">
  <canvas id="rhythm-canvas" width="800" height="400"></canvas>
  <div id="timer-display" class="timer"></div>  <!-- ДОБАВИТЬ (без начального значения) -->
  <h2>Занятие идёт</h2>
  ...
</div>
```

**Примечание:** Начальное значение не указываем — оно будет установлено в коде при показе экрана.

---

### 2. Добавить стили для таймера

**Файл:** `src/web/styles/main.css`

```css
/* Таймер на Session Screen */
.timer {
  font-size: 96px;
  font-weight: bold;
  color: var(--secondary-color);
  text-align: center;
  margin: 20px 0;
}
```

---

### 3. Реализовать логику в app.js

**Файл:** `src/web/js/app.js`

#### 3.1 Новые переменные (в начале файла, после существующих)

```js
// Таймер занятия
let timerDisplay = null
let sessionTimerInterval = null
let sessionDurationMs = 0
let countdownInterval = null  // Для возможности прерывания отсчёта
let countdownAborted = false  // Флаг для прерывания Promise
let isStopping = false  // Защита от повторных вызовов onStopClick()
```

#### 3.2 Инициализация в init()

Добавить получение элемента таймера:

```js
function init() {
  // ... существующий код ...

  // Получить элемент таймера
  timerDisplay = document.getElementById('timer-display')

  // ... остальной код ...
}
```

#### 3.3 Функция countdown() с возможностью прерывания

**ВАЖНО:** Promise должен проверять флаг `countdownAborted` на каждом тике интервала, иначе после вызова `abortCountdown()` Promise всё равно resolve(true) через секунду, и занятие запустится даже после прерывания.

```js
/**
 * Обратный отсчёт перед началом занятия
 * @param {number} seconds - количество секунд
 * @returns {Promise<boolean>} - true если завершился, false если прерван
 */
function countdown(seconds) {
  return new Promise((resolve) => {
    countdownAborted = false  // Сбросить флаг
    let remaining = seconds
    timerDisplay.textContent = remaining  // Показать "3" сразу

    countdownInterval = setInterval(() => {
      // Проверить флаг прерывания ПЕРЕД обработкой тика
      if (countdownAborted) {
        clearInterval(countdownInterval)
        countdownInterval = null
        resolve(false)  // Прерван
        return
      }

      remaining--
      if (remaining <= 0) {
        clearInterval(countdownInterval)
        countdownInterval = null
        resolve(true)  // Завершился успешно
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
    countdownAborted = true  // Установить флаг для прерывания Promise
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}
```

#### 3.4 Функции для таймера занятия

```js
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
  // Защита от вызова во время остановки
  if (isStopping) return

  const elapsedMs = performance.now() - sessionStartTimestamp
  const remainingMs = sessionDurationMs - elapsedMs

  if (remainingMs <= 0) {
    // Время вышло — автоматический стоп
    onStopClick()
    return
  }

  updateTimerDisplay(remainingMs)
}
```

#### 3.5 Изменения в onStartClick()

**Полный код функции с явным перечислением всех шагов:**

```js
async function onStartClick() {
  const settings = {
    bpm: parseInt(bpmSlider.value, 10),
    duration: parseInt(durationInput.value, 10),
    devMode: devModeCheckbox.checked
  }

  console.log('[App] Старт занятия с настройками:', settings)

  // Сбросить флаг остановки
  isStopping = false

  // Переключить экраны: скрыть Setup, показать Session
  setupScreen.style.display = 'none'
  sessionScreen.style.display = 'block'

  // === ОБРАТНЫЙ ОТСЧЁТ 3-2-1 ===
  const countdownCompleted = await countdown(3)

  // Если отсчёт был прерван (нажали Stop), выходим
  // (onStopClick уже переключил экраны и показал Stats)
  if (!countdownCompleted) {
    console.log('[App] Обратный отсчёт прерван')
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

  // === ЗАПУСТИТЬ ТАЙМЕР ЗАНЯТИЯ ===
  sessionDurationMs = settings.duration * 60 * 1000
  updateTimerDisplay(sessionDurationMs)
  sessionTimerInterval = setInterval(onTimerTick, 1000)

  console.log('[App] Session Screen активирован')
}
```

#### 3.6 Изменения в onStopClick()

**Полный код функции с защитой от повторных вызовов:**

```js
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

  // Собрать статистику ДО обнуления rhythmAnalyzer
  let stats = { totalStrikes: 0, accurateHits: 0, misses: 0, accuracyPercent: '0.0' }
  if (rhythmAnalyzer) {
    stats = rhythmAnalyzer.getAccuracy()
    console.log(`[App] Final accuracy: ${stats.accurateHits}/${stats.totalStrikes} (${stats.accuracyPercent}%)`)
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

  // Переключить экраны: показать Stats, скрыть Session
  sessionScreen.style.display = 'none'
  statsScreen.style.display = 'block'

  // Заполнить данные статистики
  statsAccuracy.textContent = `${stats.accuracyPercent}%`
  statsHits.textContent = stats.totalStrikes
  statsDuration.textContent = durationText

  console.log('[App] Stats Screen активирован')
}
```

---

## Файлы для изменения

1. **src/web/index.html** — добавить `<div id="timer-display" class="timer"></div>` внутри `#session-screen`
2. **src/web/styles/main.css** — стили `.timer`
3. **src/web/js/app.js**:
   - Новые переменные: `timerDisplay`, `sessionTimerInterval`, `sessionDurationMs`, `countdownInterval`, `countdownAborted`, `isStopping`
   - В `init()`: получение `timerDisplay`
   - Новые функции: `countdown()`, `abortCountdown()`, `updateTimerDisplay()`, `onTimerTick()`
   - Изменения в `onStartClick()`: обратный отсчёт перед запуском, сброс `isStopping`
   - Изменения в `onStopClick()`: защита от повторных вызовов, очистка таймеров

---

## Edge Cases

| Сценарий | Ожидаемое поведение |
|----------|---------------------|
| Stop во время обратного отсчёта | Отсчёт прерывается, переход на Stats с нулевой статистикой |
| Время занятия = 0 | Валидация не пропустит (min=1 в HTML) |
| Stop сразу после старта | Корректная остановка, короткое время занятия |
| Повторный вызов onStopClick() | Игнорируется благодаря флагу `isStopping` |
| onTimerTick() во время остановки | Игнорируется благодаря проверке `isStopping` |

---

## Верификация

1. Запустить приложение
2. Установить время занятия **1 минута**
3. Нажать **Старт**
4. ✅ Показывается "3", через секунду "2", затем "1"
5. ✅ После "1" — начинается метроном и таймер показывает "1:00"
6. ✅ Таймер идёт: 0:59, 0:58, ...
7. ✅ Дождаться окончания — автоматический переход на Stats
8. ✅ Проверить досрочный Стоп — всё останавливается корректно
9. ✅ **Тест прерывания:** Нажать Stop во время обратного отсчёта (на "2" или "3") — отсчёт прерывается, переход на Stats с нулевой статистикой (0%, 0 ударов, 0:00)
10. ✅ **Тест повторного Stop:** Быстро нажать Stop дважды — второй клик игнорируется
