# US-007: Экран статистики после занятия

## Цель
Показать результаты занятия после нажатия Стоп или завершения таймера.

## Acceptance Criteria
- [ ] Показывается после нажатия Стоп (таймер в US-008)
- [ ] Отображает: процент точности, количество ударов, время занятия
- [ ] Большие цифры, понятные детям
- [ ] Кнопка "Новое занятие" для возврата в меню
- [ ] UI читаемый и яркий
- [ ] Данные корректны (сверены с логами)

## Изменения

### 1. index.html — добавить Stats Screen

Добавить новый экран после `session-screen`:

```html
<!-- Stats Screen -->
<div id="stats-screen" style="display: none;">
  <h1>🎉 Результаты</h1>

  <div class="stats-container">
    <div class="stat-item">
      <div class="stat-value" id="stats-accuracy">0%</div>
      <div class="stat-label">Точность</div>
    </div>

    <div class="stat-item">
      <div class="stat-value" id="stats-hits">0</div>
      <div class="stat-label">Ударов</div>
    </div>

    <div class="stat-item">
      <div class="stat-value" id="stats-duration">0:00</div>
      <div class="stat-label">Время</div>
    </div>
  </div>

  <button id="new-session-button" class="primary-button">Новое занятие</button>
</div>
```

### 2. main.css — стили для Stats Screen

```css
/* Stats Screen */
#stats-screen {
  max-width: 500px;
  margin: 0 auto;
  text-align: center;
}

.stats-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
  margin: 40px 0;
}

.stat-item {
  background-color: #f0f0f0;
  border-radius: 16px;
  padding: 30px;
}

.stat-value {
  font-size: 72px;
  font-weight: bold;
  color: var(--primary-color);
}

.stat-label {
  font-size: 24px;
  color: #666;
  margin-top: 10px;
}
```

### 3. app.js — логика перехода на Stats Screen

**Новые переменные (инициализировать как null):**
```javascript
let statsScreen = null
let sessionStartTimestamp = null // performance.now() для консистентности с RhythmAnalyzer
```

**В init() добавить:**
```javascript
statsScreen = document.getElementById('stats-screen')
document.getElementById('new-session-button').addEventListener('click', onNewSessionClick)
```

**В onStartClick() добавить:**
```javascript
sessionStartTimestamp = performance.now() // НЕ Date.now() — для консистентности с RhythmAnalyzer
```

**Изменить onStopClick():**
```javascript
function onStopClick() {
  console.log('[App] Остановка занятия')

  // Guard clause: проверка sessionStartTimestamp
  if (!sessionStartTimestamp) {
    console.warn('[App] sessionStartTimestamp не установлен, невозможно вычислить длительность')
    return
  }

  // Собрать статистику ДО обнуления rhythmAnalyzer
  let stats = { totalStrikes: 0, accuracyPercent: '0.0' }
  if (rhythmAnalyzer) {
    stats = rhythmAnalyzer.getAccuracy()
    console.log(`[App] Final accuracy: ${stats.accurateHits}/${stats.totalStrikes} (${stats.accuracyPercent}%)`)
    rhythmAnalyzer = null
  }

  // Вычислить время занятия (performance.now() — согласовано с RhythmAnalyzer)
  const elapsedMs = performance.now() - sessionStartTimestamp
  const elapsedSeconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  const durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`

  // === СОХРАНИТЬ СУЩЕСТВУЮЩУЮ ЛОГИКУ ОСТАНОВКИ (строки 249-268 в app.js) ===
  // Остановить аниматор
  if (animator) {
    animator.stop()
    animator = null
  }

  // Вывести статистику метронома
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
  // === КОНЕЦ СУЩЕСТВУЮЩЕЙ ЛОГИКИ ОСТАНОВКИ ===

  // Сбросить sessionStartTimestamp для следующего занятия
  sessionStartTimestamp = null

  // Показать Stats Screen (вместо Setup)
  sessionScreen.style.display = 'none'
  statsScreen.style.display = 'block'

  // Заполнить данные
  document.getElementById('stats-accuracy').textContent = `${stats.accuracyPercent}%`
  document.getElementById('stats-hits').textContent = stats.totalStrikes
  document.getElementById('stats-duration').textContent = durationText

  console.log('[App] Stats Screen активирован')
}
```

**Новая функция:**
```javascript
function onNewSessionClick() {
  statsScreen.style.display = 'none'
  setupScreen.style.display = 'block'
  console.log('[App] Возврат в Setup Screen')
}
```

## Порядок выполнения

1. Добавить HTML разметку Stats Screen в `index.html`
2. Добавить стили в `main.css`
3. Изменить `app.js`:
   - Добавить переменные `statsScreen = null`, `sessionStartTimestamp = null`
   - В `init()` получить элементы и добавить обработчик
   - В `onStartClick()` сохранить `sessionStartTimestamp = performance.now()`
   - Изменить `onStopClick()`:
     - Guard clause для sessionStartTimestamp
     - Сохранить существующую логику остановки (метроном, аниматор, сенсор)
     - Сбросить sessionStartTimestamp после использования
     - Перейти на Stats Screen
   - Добавить `onNewSessionClick()`

## Верификация

1. Открыть приложение в браузере
2. Настроить BPM и время
3. Нажать "Старт"
4. Сделать несколько ударов (пробел в Dev Mode)
5. Нажать "Стоп"
6. Проверить:
   - Показался экран статистики
   - Процент точности соответствует логам в консоли
   - Количество ударов правильное
   - Время занятия правильное (формат M:SS)
7. Нажать "Новое занятие"
8. Убедиться, что вернулись в меню настроек
9. Повторить занятие — убедиться, что статистика сбрасывается

## Критичные файлы

- `src/web/index.html` — добавить Stats Screen
- `src/web/styles/main.css` — стили
- `src/web/js/app.js` — логика перехода

## Примечания

- Автоматическое завершение по таймеру — отдельная story (US-008)
- Используем `performance.now()` для времени (согласовано с RhythmAnalyzer)
