## Код-ревью: US-018 — Короткие реплики динозавра на события ритма

### Вердикт: Готов к коммиту

### Невыполненные Acceptance Criteria

Нет. Все AC выполнены.

### Проверка AC

1. **AC: "При successful hit (perfect/good) показывается позитивная реплика"** — реализовано. `app.js:showDinoSpeech()` (DOM overlay для не-runner) + `RunnerLocation.js:_showSpeech('positive', ...)` (in-canvas для runner).
2. **AC: "При miss показывается отдельная реплика поддержки/реакции"** — реализовано. Отдельный словарь `miss` в `DinoPhrases.js`, группа выбирается по `zone === 'miss'`.
3. **AC: "Реплики выбираются случайно из набора, без повторов подряд"** — реализовано. `pickPhraseWithoutImmediateRepeat()` гарантирует отсутствие повтора (при совпадении с `last` сдвигает индекс на `1 + random(0..length-2)`).
4. **AC: "Реплика читаема и не перекрывает критичный UI"** — реализовано. `pointer-events: none`, элемент между streak и canvas в DOM-потоке, высокий контраст стилей.
5. **AC: "Показ реплики имеет короткий TTL и плавное исчезновение"** — реализовано. TTL 1100ms (app.js) / 2200ms (runner, с комментарием о причине), CSS transitions + PixiJS alpha fade.
6. **AC: "Реплики можно отключить флагом/конфигом"** — реализовано. `dinoSpeechEnabled` в localStorage, default `true`, backward compatible через `!== false`.

### Замечания к коду

1. **[ЗАМЕЧАНИЕ]** **app.js, `resetDinoSpeech()` (строка 335)**: Функция не сбрасывает `dinoSpeechLastByGroup`. В `RunnerLocation._resetState()` (строка 422) аналогичный `speechLastByGroup` сбрасывается в `{ positive: '', miss: '' }`. Из-за этого в app.js "no repeat" трекинг сохраняется между сессиями, а в runner — нет. Это не баг (скорее даже плюс — больше разнообразия), но стоит быть в курсе различия.
   - Сейчас: `resetDinoSpeech()` не трогает `dinoSpeechLastByGroup`
   - Нужно: Либо добавить `dinoSpeechLastByGroup = { positive: '', miss: '' }` в `resetDinoSpeech()` для консистентности, либо оставить как есть и добавить комментарий
   - Причина: Консистентность поведения между реализациями

### Что было исправлено после первого ревью

1. Дублирование словарей устранено — создан общий модуль `DinoPhrases.js`
2. Алгоритм `pickPhraseWithoutImmediateRepeat` стал детерминистично корректным (вместо retry-loop с фиксированным лимитом итераций)
3. Добавлены комментарии к различиям констант (`RunnerLocation.js:25` — "Runner bubble lives inside dense Pixi scene near the hero, so keep it longer")
4. Добавлены комментарии к различию логики показа (`RunnerLocation.js:443-444` — "intentionally show speech less frequently to avoid visual overload")
5. Добавлен комментарий к backward compatibility (`app.js:160` — "Default-on behavior for backward compatibility")
6. Добавлен комментарий к условию runner/non-runner (`app.js:530-531`)

### Положительные моменты

1. Чистая архитектура — общий модуль `DinoPhrases.js` для словарей и алгоритма
2. Корректная обработка edge cases (пустые списки, единственная фраза, `Array.isArray` guard)
3. Правильная очистка таймеров при остановке сессии (`clearDinoSpeechTimers` в `resetDinoSpeech`, вызов в `onStopClick`/`onNewSessionClick`/`onStartClick`)
4. Поддержка accessibility (`aria-live="polite"`, `prefers-reduced-motion` fallback)
5. Разделение реализации для разных контекстов (DOM overlay для обычных локаций, PixiJS bubble для runner)
6. Корректная работа с localStorage и backward compatibility
7. Защита от спама через cooldown + event gap (runner)
8. Плавные анимации (CSS transitions для overlay, PixiJS alpha + cubic ease для runner)
9. `pointer-events: none` предотвращает блокировку кликов
10. Ресурсы PixiJS корректно уничтожаются в `destroy()` (`speechGraphics.destroy()`, `speechText.destroy()`)
