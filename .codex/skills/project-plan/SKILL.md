---
name: project-plan
description: >
  Нарезка user stories из PRD и настройка структуры проекта.
  Работает и для старта нового проекта, и для нового этапа существующего.
  Триггеры: "/project-plan", "нарезай стори", "новый этап проекта", "следующий этап проекта".
---

# Project Plan

Извлекает user stories из PRD, создаёт (или дополняет) структуру управления проектом.

## Два сценария

### A. Новый проект (файлов нет)

1. Проверить `docs/prd.md` — если нет, вызвать `/prd`
2. Извлечь user stories из PRD → создать `docs/user_stories.json`
3. Создать `project_state.md` (формат из CLAUDE.md, раздел «project_state.md»)
4. Создать `docs/plans/` и `docs/reviews/`

### B. Новый этап (файлы существуют)

1. Прочитать текущие `docs/prd.md`, `docs/user_stories.json`, `project_state.md`
2. Спросить пользователя: что нового? (новые требования, изменения скоупа)
3. Обновить PRD если нужно
4. Извлечь **новые** stories → **добавить** в существующий `user_stories.json` (не перезаписать!)
5. Нумерация продолжает существующую (если US-009 последняя → новые с US-010)
6. Обновить `project_state.md`: Backlog, Architecture (если изменилась)

## Структура файлов

```
docs/
├── prd.md                 # Product Requirements Document
├── user_stories.json      # User Stories (source of truth)
├── plans/                 # Планы для каждой story (US-XXX-название.md)
└── reviews/               # Ревью планов и кода (US-XXX-plan-review.md, US-XXX-code-review.md)
project_state.md           # Слепок состояния (формат из CLAUDE.md)
```

## Формат user_stories.json

```json
{
  "project": "Название проекта",
  "version": "1.0.0",
  "last_updated": "YYYY-MM-DD",
  "branchName": "main",
  "userStories": [
    {
      "id": "US-001",
      "title": "Название story",
      "description": "Как <роль> я хочу <действие>, чтобы <цель>",
      "acceptanceCriteria": ["Критерий 1", "Критерий 2"],
      "priority": 1,
      "passes": false,
      "technicalNotes": "Технические детали",
      "relatedFiles": ["путь/к/файлу.js"]
    }
  ]
}
```

## Правила извлечения stories

- Каждая story = один вертикальный слайс пользовательской ценности
- Формат описания: "Как <роль> я хочу <действие>, чтобы <цель>"
- Acceptance criteria включают Definition of Done
- `passes: false` по умолчанию

## Финализация

- Показать что создано/обновлено
- Предложить начать с первой story из бэклога

## Зависимости

- Skill `/prd` — для создания PRD, если его нет
