# RunnerLocation — Side-Scrolling Rhythm Runner

## Context

Beat Buddy имеет систему локаций (Default + Forest). Нужна третья локация — ритм-раннер в стиле Super Mario, где персонаж бежит вправо и перепрыгивает препятствия в такт метроному. Это принципиально другой тип визуализации: вместо статичной сцены — скроллер с геймплейной обратной связью.

## Файлы

- **Создать:** `src/web/js/locations/RunnerLocation.js`
- **Изменить:** `src/web/js/Animator.js` — добавить side-effect import + передавать `beatsFromStart` в `onBeat`
- **Изменить:** `src/web/js/app.js` — debug-хук `window.__debugAnimator`

---

## Архитектура

Фабрика `createRunnerLocation()` → `{init, onBeat, onHit, destroy}`.
Регистрация: `register('runner', 'Бегун', createRunnerLocation)`.

### Направление движения

Персонаж находится в **левой** части экрана (`charX = w * 0.2`), **лицом вправо**. Мир скроллится **влево**. Препятствия появляются у **правого** края экрана и движутся влево к персонажу. Стандартная механика side-scroller'а.

### Детерминированный beatCount (исправление: без phase wrap)

**Проблема:** определение бита через `prevPhase > 0.7 && phase < 0.3` ненадёжно — при просадке FPS кадр с переходом может быть пропущен.

**Решение:** расширить вызов `onBeat` в Animator:

```js
// Animator._tick() — было:
this.location.onBeat(phase)

// Стало:
this.location.onBeat(phase, beatsFromStart)
```

`beatsFromStart` — float, уже вычисляется в `_tick()` (строка 204). Передаём вторым аргументом. Существующие локации (Default, Forest) игнорируют лишний аргумент — **обратная совместимость**.

В RunnerLocation:
```js
onBeat(phase, beatsFromStart = 0) {
  const beatCount = Math.floor(beatsFromStart)  // детерминированно, не зависит от FPS
}
```

---

## Слайс 1: Сцена + бег + препятствия + прыжок

### Мир и скроллинг

- `OBSTACLE_SPACING = w * 0.25` — расстояние между препятствиями
- `worldOffset = beatsFromStart * OBSTACLE_SPACING` — позиция мира (из beatsFromStart, не из beatCount + phase)
- Препятствие `i` на экране: `screenX = charX + (i - beatsFromStart) * OBSTACLE_SPACING`
- Препятствие приходит к персонажу ровно на бит `i`
- `LEAD_IN_BEATS = 3` — первые 3 бита без препятствий (ребёнок входит в ритм)
- Реальные препятствия начинаются с индекса `LEAD_IN_BEATS`

### Фон (параллакс)

1. **Небо** — 8 цветных полос, статичное (верхние 75%)
2. **Дальние холмы** — параллакс 0.15x, bezier-кривые, бесконечный тайлинг
3. **Ближние холмы** — параллакс 0.3x
4. **Земля** — коричневая полоса + зелёная линия травы, полная скорость скроллинга
5. **Травинки** — 12 шт, скроллятся с землёй

### Препятствия (пул 8 шт, pre-allocated)

4 типа, детерминированный выбор по `(beatIndex * 7 + 3) % 4`:
- 0: Камень (серый эллипс)
- 1: Пенёк (коричневый прямоугольник)
- 2: Куст (3 зелёных круга)
- 3: Гриб (ножка + красная шляпка)

### Персонаж (милый человечек)

Фиксированная позиция `charX = w * 0.2`, ноги на `groundY = h * 0.75`.

Рисуем снизу вверх:
1. **Ноги** — 2 линии от бёдер, угол качается по `sin(phase * 2PI)`. Красные ботинки (круги)
2. **Тело** — округлый прямоугольник (ярко-синяя рубашка)
3. **Руки** — 2 линии от плеч, качаются в противофазе с ногами
4. **Голова** — круг (цвет кожи), волосы (полукруг сверху), глаза (2 точки), улыбка (дуга)

### Состояния персонажа

```
running  →[onHit('perfect')]→  jumping (высоко, h*0.18)
running  →[onHit('good')]→     jumping (средне, h*0.10)
jumping  →[500ms]→             running
```

**Бег:** ноги/руки качаются по phase, лёгкий вертикальный боб.
**Прыжок:** параболическая дуга `jumpY = height * 4 * t * (1-t)`, ноги поджаты, руки вверх.

### Эффекты

- **Perfect:** 6 золотых частиц-блёсток от центра персонажа
- **Good:** 3 мягкие частицы
- Пулы: MAX_PARTICLES=8, MAX_EFFECTS=3

### AC слайса 1

- Выбрать "Бегун" на Setup → скроллящийся мир, персонаж бежит в такт
- Препятствия появляются **справа**, приходят к персонажу на каждый бит
- Первые 3 бита без препятствий
- `window.__debugAnimator.onHit({zone:'perfect'})` → высокий прыжок + блёстки
- `window.__debugAnimator.onHit({zone:'good'})` → средний прыжок
- Start/stop 5 раз — нет артефактов
- Default и Forest работают без регрессий
- При отсутствии WebGL — сессия запускается без падений, Animator показывает fallback-статус

---

## Слайс 2: Спотыкание + авто-спотыкание

### Спотыкание (600ms)

3 фазы: наклон вперёд (0-40%) → удержание + махание руками (40-70%) → восстановление (70-100%). Комичное, не фрустрирующее.

### Авто-спотыкание

Детерминированная проверка на каждом кадре: сравниваем `prevBeatCount` с текущим `beatCount = Math.floor(beatsFromStart)`. Если `beatCount > prevBeatCount` → новый бит.

Если `hitThisBeat === false` и `beatCount > LEAD_IN_BEATS` и `charState === 'running'` → триггерим спотыкание.

Флаг `hitThisBeat` сбрасывается при смене бита.

**Важно:** авто-спотыкание — **чисто визуальный эффект**. Оно НЕ влияет на статистику RhythmAnalyzer. Статистика считает только реальные удары по датчику. Визуальная и статистическая обратная связь — независимые системы.

### Пыль при спотыкании

3-4 коричневые частицы у ног, разлетаются низко.

### Edge cases

- Hit во время прыжка/спотыкания — игнорируется визуально, но `hitThisBeat = true` (предотвращает авто-спотыкание)
- Внешний `onHit('miss')` устанавливает `hitThisBeat = true` → авто-спотыкание не дублирует
- Первые LEAD_IN_BEATS — авто-спотыкание отключено

### AC слайса 2

- `window.__debugAnimator.onHit({zone:'miss'})` → комичное спотыкание + пыль
- Не нажимать ничего → авто-спотыкание на каждом бите (после lead-in)
- Спотыкание не вызывает фрустрацию (быстрое восстановление)
- Нет двойного спотыкания
- Авто-спотыкание НЕ отражается в Stats Screen

---

## destroy() — чеклист очистки

```js
destroy() {
  // 1. Графика
  if (graphics && container) {
    container.removeChild(graphics)
    graphics.destroy()
  }
  graphics = null
  container = null

  // 2. Размеры
  width = 0
  height = 0

  // 3. Пулы
  obstacles = []
  particles = []
  effects = []
  grassTufts = []

  // 4. Состояние персонажа
  charState = 'running'
  charStateStart = 0
  charJumpHeight = 0

  // 5. Счётчики и флаги
  prevBeatCount = -1
  hitThisBeat = false
}
```

---

## Debug-хук для тестирования

В `app.js` после создания `animator` (строка ~349):
```js
window.__debugAnimator = animator
```

Обнуление при stop:
```js
window.__debugAnimator = null
```

Тестирование из консоли:
```js
window.__debugAnimator.onHit({zone: 'perfect'})
window.__debugAnimator.onHit({zone: 'good'})
window.__debugAnimator.onHit({zone: 'miss'})
```

---

## Константы

```
LEAD_IN_BEATS = 3
MAX_OBSTACLES = 8, MAX_PARTICLES = 8, MAX_EFFECTS = 3
JUMP_DURATION_MS = 500, STUMBLE_DURATION_MS = 600
PERFECT_JUMP_HEIGHT = 0.18, GOOD_JUMP_HEIGHT = 0.10
GRASS_TUFT_COUNT = 12
```

## Проверка

1. Запустить, выбрать "Бегун", начать сессию
2. Визуально: мир скроллится, персонаж бежит, препятствия синхронны с битами
3. Консоль: `window.__debugAnimator.onHit({zone:'perfect'})` / `good` / `miss`
4. Не нажимать ничего — авто-спотыкание работает (после 3 lead-in битов)
5. Start/stop 5 раз — чисто
6. Переключить на Default/Forest — работают
7. При отсутствии WebGL — сессия не падает
