# Project State

Обновляется после каждой завершённой стори.

## Architecture

```
MetronomeEngine → (beatTimes) → RhythmAnalyzer
SensorManager → (hitTime) → RhythmAnalyzer → (zone) → Animator
app.js — координатор: связывает модули, управляет экранами

Animator (владеет PixiJS App, ticker, lifecycle)
  └── location = LocationRegistry.create(id)
        └── { init(container, w, h), onBeat(phase, beatsFromStart), onHit(zone), destroy() }

LocationRegistry — реестр локаций (register/getAll/create)
DefaultLocation — пульс + flash (бывший визуал из Animator)
ForestLocation — лесная сцена (деревья, цветы, бабочки, эффекты ударов)
RunnerLocation (V2.1) — side-scrolling ритм-раннер без obstacle-driven фидбека: прыжок только на perfect/good, спотыкание только на miss
RunnerAssets — манифест + кэш текстур для RunnerLocation (shared, не уничтожаются при stop/start)
DinoPhrases — общий словарь реплик и helper выбора без мгновенного повтора (используется в app overlay и Runner thought-bubble)

Экраны: Setup (+ выбор локации) → [Countdown] → Session → Stats → Setup
```

## Current Sprint

- US-019: Полноэкранные edge-вспышки по зонам точности

## Backlog

- US-019: Полноэкранные edge-вспышки по зонам точности

## Done

MVP (US-001..US-009) — завершён 2026-02-05
US-010: Редизайн UI — игровой стиль, Nunito, градиенты, карточки
US-011: Интеграция PixiJS для анимаций — завершён 2026-02-07
US-012: Система локаций — LocationRegistry, DefaultLocation, UI выбора
US-013: Локация «Лес/Природа» — процедурная лесная сцена с реакцией на удары
US-014: RunnerLocation — side-scrolling ритм-раннер с прыжками, спотыканием, авто-спотыканием
US-015: RunnerLocation — переход на спрайты (AnimatedSprite дино, TilingSprite фон/земля, Sprite препятствия)
US-016: Runner без препятствий как основного фокуса — завершён 2026-02-09
US-017: Streak-счётчик (текущий + лучший) с пороговыми CSS-эффектами
US-018: Короткие реплики динозавра на события ритма — завершён 2026-02-09

## Gotchas

- Датчик работал с 5-й попытки — проблема в нашем коде, не в железе. Изолировано в SensorManager
- BPM 50-70 — подтверждено педагогом, не расширять без обсуждения
- Боевое окружение — Windows 7 + Chrome (больница)
- Пороги: Perfect ≤75ms, Good ≤150ms — подобраны вручную
- Стек V2: PixiJS для анимаций, vanilla JS + CSS для UI
- WebGL на Windows 7 может тормозить — предусмотреть fallback/тестирование
- Для точного анализа ритма используем время первого слышимого клика (AudioContext→performance sync), иначе возникает фазовый сдвиг между звуком и оценкой
- При недоступном WebGL показываем явный fallback-статус, сессия продолжает работать без анимации
- Новая локация = модуль с `register()` + side-effect импорт в Animator.js. DefaultLocation — эталон интерфейса
- onBeat получает `(phase, beatsFromStart)` — второй аргумент для локаций, которым нужен абсолютный счётчик битов
- `window.__debugAnimator` доступен в консоли во время сессии для тестирования onHit
- RunnerAssets: текстуры shared, кэшируются на уровне модуля. При stop/start — переиспользуются. clearCache() только при полном уничтожении
- Ассеты GameArt2D (CC0) в src/web/assets/runner/ — лицензия в LICENSE.txt
- Для V2.1 упрощаем сцену раннера: фидбек должен идти от качества попадания в бит, а не от препятствий
- В RunnerLocation ритм-фидбек должен применяться даже во время recovery: perfect/good не блокируются предыдущим stumble
- Для RunnerLocation реплики показываем реже (случайно раз в 2-5 событий), чтобы не перегружать сцену при частых hit
