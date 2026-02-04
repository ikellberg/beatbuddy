# План реализации US-006: Визуальная обратная связь (анимация)

## Обзор
Создать визуальную обратную связь для ребёнка: зелёный = попадание в ритм, красный = промах. Анимация бегущих волн синхронизирована с метрономом.

## Критические файлы
- Создать: `src/web/js/Animator.js` — новый модуль анимации
- Изменить: `src/web/js/app.js` — добавить импорт и подключить Animator
- Изменить: `src/web/index.html:38-46` — добавить canvas для анимации
- Изменить: `src/web/styles/main.css` — добавить стили для canvas

## Детальный план

### 1. Создать `Animator.js` (новый файл)

**API модуля:**
```javascript
export class Animator {
  constructor(canvasElement, bpm)
  start()
  stop()   // <- должен очищать canvas при остановке
  onHit(result)  // result = {isHit, deviation, beatNumber}
}
```

**Реализация:**
- Canvas 2D для рисования волн
- `requestAnimationFrame` для плавной анимации
- **Бегущая волна в такт метроному:** волны расходятся от центра
  - Фаза вычисляется от `performance.now()` и BPM
  - Каждая волна — круг с радиусом, растущим от 0 до края canvas
  - Alpha-канал уменьшается по мере роста радиуса (затухание)
- **Реакция на удар:**
  - Попадание (`isHit=true`): добавляется зелёная волна с большим радиусом
  - Промах (`isHit=false`): добавляется красная волна, быстрее затухает
- Использовать существующие цвета:
  - Зелёный: `#4CAF50` (уже есть как `--primary-color`)
  - Красный: `#f44336` (уже есть как `.danger-button`)
  - Фоновый ритм: светло-серый `#CCCCCC`
- **Важно:** метод `stop()` должен очищать canvas (`ctx.clearRect`)

### 2. Изменить `index.html`

Добавить canvas в `#session-screen`:
```html
<div id="session-screen" style="display: none;">
  <canvas id="rhythm-canvas" width="800" height="400"></canvas>
  <h2>Занятие идёт</h2>
  ...
</div>
```

Canvas должен быть **первым** элементом (до h2) для позиционирования. Атрибуты width/height указаны для избежания размытия.

### 3. Изменить `app.js`

**Добавить импорт в начало файла:**
```javascript
import { Animator } from './Animator.js'
```

**Объявить переменную:**
```javascript
let animator = null
```

**В `onStartClick()` после создания RhythmAnalyzer:**
```javascript
// Инициализировать аниматор
const canvas = document.getElementById('rhythm-canvas')
animator = new Animator(canvas, settings.bpm)
animator.start()
```

**В обработчике `sensor.onHit()` после логирования:**
```javascript
// Передать результат в аниматор
if (animator) {
  animator.onHit(result)
}
```

**В `onStopClick()`:**
```javascript
if (animator) {
  animator.stop()
  animator = null
}
```

### 4. Изменить `main.css`

Добавить стили для canvas:
```css
#rhythm-canvas {
  display: block;
  width: 100%;
  height: 400px;
  margin-bottom: 20px;
}
```

`display: block` устраняет лишние отступы от inline-поведения canvas по умолчанию.

## Порядок реализации
1. Создать `Animator.js` с базовой волной в такт метроному
2. Добавить canvas в HTML и стили
3. Подключить Animator в app.js (импорт + инициализация)
4. Добавить реакцию на попадание (зелёная волна)
5. Добавить реакцию на промах (красная волна)
6. Тестировать в Dev Mode (пробел = удар)

## Верификация
1. Запустить приложение, нажать Старт
2. Должны бежати волны от центра в такт метроному
3. Нажать пробел в такт → зелёная волна
4. Нажать пробел мимо такта → красная волна
5. Анимация плавная, без лагов (60fps)
6. При Стоп анимация останавливается и canvas очищается

## Примечания
- Canvas выбран вместо CSS animations для более гибкой синхронизации с метрономом
- Animator сам вычисляет фазу волны от времени (как RhythmAnalyzer)
- Не требуется изменение MetronomeEngine — он продолжает только генерировать звук
