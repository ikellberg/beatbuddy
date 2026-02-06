# Project State

Обновляется после каждой завершённой стори.

## Architecture

```
MetronomeEngine → (beatTimes) → RhythmAnalyzer
SensorManager → (hitTime) → RhythmAnalyzer → (zone) → Animator
app.js — координатор: связывает модули, управляет экранами

Экраны: Setup → [Countdown] → Session → Stats → Setup
```

## Current Sprint

Нет активных задач.

## Backlog

Приоритет сверху вниз:

1. US-010: Редизайн UI
2. US-011: Интеграция PixiJS
3. US-012: Локация «Лес»
4. US-013: Система локаций
5. US-014: Адаптивные пороги
6. US-015: История занятий

## Done

MVP (US-001..US-009) — завершён 2026-02-05

## Gotchas

- Датчик работал с 5-й попытки — проблема в нашем коде, не в железе. Изолировано в SensorManager
- BPM 50-70 — подтверждено педагогом, не расширять без обсуждения
- Боевое окружение — Windows 7 + Chrome (больница)
- Пороги: Perfect ≤75ms, Good ≤150ms — подобраны вручную
- Стек V2: PixiJS для анимаций, vanilla JS + CSS для UI
