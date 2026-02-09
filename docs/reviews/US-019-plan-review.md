## Ревью плана: US-019 — Полноэкранные edge-вспышки по зонам точности

### Вердикт: Готов к реализации

### Статус предыдущих замечаний

Все 7 замечаний из первого ревью учтены:

1. ~~Конфликт shake + edge-flash на miss~~ → Slice 1, шаг 3: shake-overlay явно заменяется на edge-вспышку.
2. ~~Z-order не определён~~ → Slice 1, шаг 1: `edgeFlashGraphics` после `effectsGraphics`, до `speechGraphics`/`speechText`.
3. ~~Gradient нетривиален~~ → Технические детали п.2: 3-4 вложенных `drawRect` с убывающей alpha, без shader/filter.
4. ~~Затрагиваемые файлы раздуты~~ → Только `RunnerLocation.js`.
5. ~~destroy() не в шагах~~ → Slice 1, шаг 4: cleanup `edgeFlashGraphics` и `activeEdgeFlash`.
6. ~~Стратегия наложения размыта~~ → Slice 2, шаг 2: перезапуск с `max(currentAlpha, peakAlpha)`, без очереди.
7. ~~Источник delta time~~ → Slice 3, шаг 1: `performance.now()` delta между вызовами `onBeat`.

### Соответствие архитектуре (project_state.md)

- План работает только внутри `RunnerLocation.js`, не трогает контракт `Animator.onHit(result)` и внешние API — соответствует архитектуре.
- Использует существующий `PALETTE.perfect/good/miss` — без дублирования.
- `edgeFlashGraphics` вписан в существующее дерево контейнеров RunnerLocation с правильным z-order.
- FPS-монитор локализован в RunnerLocation, не затрагивает Animator — корректный scope.

### Пробелы в плане

Критических пробелов нет. Одно наблюдение:

- **Scope ограничен RunnerLocation** — edge-вспышки не появятся в DefaultLocation и ForestLocation. Для текущего этапа (v2.1, Runner — основная локация) это приемлемо, но стоит зафиксировать как осознанное решение, если в будущем edge-flash понадобится для всех локаций.

### Конфликты с существующей архитектурой

Конфликтов не обнаружено. Замена shake-overlay на edge-flash для miss (Slice 1, шаг 3) устраняет ранее выявленный конфликт двойного красного эффекта.

### Рекомендации (некритичные)

1. **Slice 1, шаг 3**: При замене shake-overlay убедиться, что dust-burst (`_burstDust`) для miss сохраняется — в плане это подразумевается («прыжок/спотыкание/частицы сохраняются»), но стоит проверить при реализации.
2. **Чек-лист**: Можно добавить пункт проверки на Windows 7 + Chrome (из gotchas в project_state.md: «WebGL на Windows 7 может тормозить»), особенно актуально для degrade-режима.
