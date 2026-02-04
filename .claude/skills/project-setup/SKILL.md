# Project Setup Skill

Автоматизирует создание полной системы управления проектом с User Stories, планами и процессом разработки.

## Когда использовать

Используй этот skill в начале нового проекта для настройки:
- User Stories в структурированном формате (Ralph-based)
- Системы планирования (docs/plans/)
- Процесса разработки с Human-in-the-Loop
- Vertical slices подхода

## Что делает skill

1. **Проверяет наличие PRD:**
   - Если `docs/prd.md` существует → использует его
   - Если нет → вызывает `/prd` для создания

2. **Создаёт структуру управления:**
   ```
   docs/
   ├── prd.md                 # Product Requirements Document
   ├── user_stories.json      # User Stories (source of truth, формат Ralph)
   └── plans/                 # Планы для каждой story
   project_state.md           # Human-readable state
   ```

3. **Извлекает User Stories из PRD:**
   - Парсит PRD и формирует структурированные user stories
   - Формат Ralph: `passes`, `priority`, `acceptanceCriteria`
   - Сохраняет в `docs/user_stories.json`

4. **Создаёт project_state.md:**
   - Current Sprint (пусто в начале)
   - Backlog (все stories из user_stories.json)
   - Done (отмечает создание системы управления)
   - Процесс работы с Human-in-the-Loop checkpoints
   - Структура проекта

5. **Создаёт директорию docs/plans/:**
   - Планы будут сохраняться в формате `US-XXX-название.md`
   - Директория создаётся автоматически при первом плане

## Процесс выполнения

### Шаг 1: Проверка PRD

```
Если docs/prd.md существует:
  ✓ Использовать существующий PRD
Иначе:
  → Вызвать skill /prd
  → Дождаться завершения
```

### Шаг 2: Извлечение User Stories

Из PRD извлекаются user stories на основе:
- User Journey
- MVP Scope
- Acceptance Criteria

Каждая story содержит:
- `id`: "US-001", "US-002", ...
- `title`: Краткое название
- `description`: "Как <роль> я хочу <действие>, чтобы <цель>"
- `acceptanceCriteria`: Массив критериев (включая Definition of Done)
- `priority`: Число (1 = highest)
- `passes`: false (по умолчанию)
- `technicalNotes`: Технические детали
- `relatedFiles`: Массив путей к файлам

### Шаг 3: Создание структуры

1. **docs/user_stories.json** — JSON с user stories
2. **docs/plans/** — Директория для планов (создаётся автоматически)
3. **project_state.md** — Human-readable state с:
   - Описанием проекта
   - Current Sprint (пусто)
   - Backlog (все stories)
   - Done (система управления настроена)
   - Процессом работы
   - Структурой проекта

### Шаг 4: Финализация

- Показать созданную структуру
- Объяснить следующие шаги
- Предложить начать с первой story

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
      "acceptanceCriteria": [
        "Критерий 1",
        "Критерий 2"
      ],
      "priority": 1,
      "passes": false,
      "technicalNotes": "Технические детали",
      "relatedFiles": ["путь/к/файлу.js"]
    }
  ]
}
```

## Процесс работы после setup

После создания структуры:

1. **Выбери story** из Backlog (priority=1 = highest)
2. **Открой Plan Mode** для планирования story
3. **В Plan Mode:**
   - Claude исследует кодебазу
   - Предлагает декомпозицию на vertical slices
   - Пишет план в `docs/plans/US-XXX-название.md`
4. **Утверди план** (ExitPlanMode)
5. **Execution Mode:**
   - Claude реализует slice
   - **Ты тестируешь** в браузере
   - Если ОК → даёшь разрешение "ок, коммить"
   - Повторяется для каждого slice
6. **Завершение story:**
   - Проверяешь все acceptance criteria
   - Claude обновляет `user_stories.json` (`passes: true`)
   - Claude добавляет "## Learnings" в план story

## Human-in-the-Loop checkpoints

| Этап | Что делает Claude | Что делаешь ты |
|------|-------------------|----------------|
| **Начало story** | — | Запускаешь Plan Mode |
| **Планирование** | Предлагает slices | Утверждаешь план |
| **Реализация slice** | Пишет код | **Тестируешь** |
| **Коммит** | Коммитит код | **Даёшь разрешение** |
| **Завершение story** | Проверяет criteria | **Финальное тестирование** |

## Правила

1. **Каждая story начинается с новой сессии планирования** (EnterPlanMode)
2. Claude **НИКОГДА** не коммитит без твоего явного "ок"
3. После завершения story → новая сессия для следующей story
4. Планы сохраняются в `docs/plans/US-XXX-название.md`
5. Learnings добавляются в план story после завершения

## Пример использования

```
User: /project-setup

Claude:
1. Проверяю наличие docs/prd.md... Не найден.
2. Вызываю /prd для создания PRD...
3. [Процесс создания PRD через AskUserQuestion]
4. PRD создан. Извлекаю user stories...
5. Создаю структуру управления проектом...
6. ✓ docs/user_stories.json (8 stories)
7. ✓ docs/plans/ (директория создана)
8. ✓ project_state.md

Система управления проектом настроена!

Следующие шаги:
1. Выбери первую story (рекомендую US-001)
2. Скажи: "Давай возьмём в работу US-001"
3. Я войду в Plan Mode для планирования
```

## Зависимости

- Skill `/prd` — для создания PRD, если его нет

## Примечания

- User stories формируются автоматически из PRD
- Формат stories основан на Ralph подходе
- Learnings хранятся в планах (не в отдельном progress.txt)
- Планы сохраняются в `docs/plans/` с naming convention: `US-XXX-название.md`
