# US-012: Система локаций (архитектура)

## Контекст

Сейчас `Animator.js` — монолитный класс, который сам создаёт PixiJS Application, рисует пульсирующий круг и обрабатывает flash при ударах. Для US-013+ нужно подключать разные "миры" (лес, космос и т.д.), каждый со своей графикой. US-012 вводит архитектуру локаций: Animator делегирует рендеринг текущей локации, а добавление новой = создание модуля + регистрация.

## Целевая архитектура

```
Animator (владеет PixiJS App, ticker, lifecycle)
  └── location: { init(container), onBeat(phase), onHit(zone), destroy() }

LocationRegistry — реестр доступных локаций
  └── { id, name, create() } для каждой

DefaultLocation — текущий визуал (пульс + flash), вынесен из Animator

Setup Screen — UI выбора локации (select/карточки)
```

## Слайсы

### Слайс 1: LocationRegistry + DefaultLocation + рефакторинг Animator

**Цель:** вынести рисующую логику из Animator в DefaultLocation, создать LocationRegistry, Animator делегирует вызовы.

**Файлы:**
- `src/web/js/locations/LocationRegistry.js` — **новый**, реестр локаций + регистрация DefaultLocation
- `src/web/js/locations/DefaultLocation.js` — **новый**, текущая анимация (пульс + flash)
- `src/web/js/Animator.js` — **рефакторинг**: убрать рисование, делегировать location

**LocationRegistry API:**
```js
register(id, name, createFn)  // регистрация локации
getAll()                       // [{id, name}, ...] для UI
create(id)                     // возвращает объект локации
getDefaultId()                 // 'default'
```

**Инициализация реестра:** DefaultLocation регистрируется при импорте `LocationRegistry.js` (внизу модуля вызов `register('default', 'По умолчанию', createDefaultLocation)`). Никакого bootstrap в app.js не нужно.

**Интерфейс локации:**
```js
{
  init(pixiContainer, width, height),  // создать спрайты, добавить в container
  onBeat(phase),                        // phase 0..1, вызывается каждый tick
  onHit(zone),                          // 'perfect' | 'good' | 'miss'
  destroy()                             // очистить ресурсы
}
```

**Изменения в Animator:**
- Конструктор принимает дополнительный параметр `locationId` (по умолчанию `'default'`)
- `start()`: после `_initPixi()` создаёт локацию через `LocationRegistry.create(locationId)` с fallback на `getDefaultId()` при ошибке (try/catch + console.warn)
- `_tick()`: вычисляет `phase` (как сейчас), вызывает `location.onBeat(phase)`
- `onHit(result)`: **публичный API не меняется** — принимает `result` от app.js, внутри вызывает `location.onHit(result.zone)`
- `stop()`: вызывает `location.destroy()` перед уничтожением PixiJS App

**DefaultLocation:** копия текущей рисующей логики из `Animator._tick()` — пульс, flash. Получает `container` (PIXI.Container) в `init()`, рисует в него.

**Проверка:** запустить сессию — визуал идентичен текущему (пульс + flash по зонам).

### Слайс 2: UI выбора локации на Setup Screen

**Цель:** добавить select/карточки на Setup Screen для выбора локации.

**Файлы:**
- `src/web/index.html` — добавить UI выбора
- `src/web/styles/main.css` — стили для нового элемента
- `src/web/js/app.js` — читать выбранную локацию, передавать в Animator

**Детали:**
- На Setup Screen — группа с выбором локации (как `setting-group`)
- Пока одна локация "По умолчанию", но UI готов для добавления (select заполняется из `LocationRegistry.getAll()`)
- Выбор сохраняется в localStorage как `locationId` в составе `SETTINGS_KEY`
- Backward-compatible чтение: `settings.locationId ?? LocationRegistry.getDefaultId()`
- `app.js` при старте: `new Animator(canvas, bpm, firstBeatTime, selectedLocationId)`

**Проверка:** на Setup Screen видна группа "Локация" с единственным вариантом. Выбор сохраняется. Сессия работает как раньше.

## Ключевые решения

1. **LocationRegistry — простой объект-реестр** (не класс, нет оверинжиниринга). Статические методы: register/getAll/create.
2. **Локация создаётся функцией-фабрикой** (`create()`), а не конструктором — проще, нет наследования.
3. **Animator остаётся владельцем PixiJS App** — локация получает только контейнер.
4. **DefaultLocation — 1:1 копия текущего визуала** — без улучшений, чтобы не сломать регрессию.
5. **Animator.onHit(result) совместим** — app.js передаёт `result`, Animator внутри маппит в `location.onHit(result.zone)`.

## Верификация

- Запустить приложение, проверить что Setup Screen показывает выбор локации
- Начать сессию — визуал идентичен текущему (пульс в такт, flash при ударе)
- Проверить fallback при отсутствии WebGL — поведение не изменилось
- Проверить что при остановке нет утечек (location.destroy() вызывается)
- Переключение без перезагрузки: выбрать локацию → запустить сессию → остановить → выбрать другую → запустить снова (без F5)
- Невалидный locationId в localStorage: вручную записать мусор → при старте должен fallback на default + warning в консоли
- Console: нет ошибок, логи LocationRegistry видны
