# Project State

Обновляется после каждой завершённой стори.

## Architecture

```
MetronomeEngine → (beatTimes) → RhythmAnalyzer
SensorManager → (hitTime) → RhythmAnalyzer → (zone) → Animator
app.js — координатор: связывает модули, управляет экранами

Animator (владеет PixiJS App, ticker, lifecycle)
  └── location = LocationRegistry.create(id)
        └── { init(container, w, h), onBeat(phase), onHit(zone), destroy() }

LocationRegistry — реестр локаций (register/getAll/create)
DefaultLocation — пульс + flash (бывший визуал из Animator)

Экраны: Setup (+ выбор локации) → [Countdown] → Session → Stats → Setup
```

## Current Sprint

US-013: Локация «Лес/Природа»

## Backlog

Приоритет сверху вниз:

1. US-013: Локация «Лес/Природа»

## Done

MVP (US-001..US-009) — завершён 2026-02-05
US-010: Редизайн UI — игровой стиль, Nunito, градиенты, карточки
US-011: Интеграция PixiJS для анимаций — завершён 2026-02-07
US-012: Система локаций — LocationRegistry, DefaultLocation, UI выбора

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
