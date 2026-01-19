# Python Project Template

Шаблон для Python-проектов с настроенным линтером и структурой для агентов.

## Использование

1. Нажми "Use this template" на GitHub
2. Переименуй `src/project_name/` под свой проект
3. Обнови `pyproject.toml` (name, description, author)
4. Обнови `.claude/CLAUDE.md` под свой проект

## Структура

```
├── src/project_name/    # Код проекта
│   ├── agents/          # Агенты
│   └── main.py          # Точка входа
├── tests/               # Тесты
├── data/                # Данные для разработки
├── .claude/             # Правила для Claude
└── .cursor/rules/       # Правила для Cursor
```

## Команды

```bash
# Установка зависимостей
pip install -e ".[dev]"

# Линтер
ruff check src/

# Тесты
pytest
```
