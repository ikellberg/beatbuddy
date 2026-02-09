---
name: web-setup
description: Добавление веб-структуры в Python-проект. Используй когда нужно добавить фронтенд, статику, шаблоны или API.
---

# Web Setup

Добавляет структуру для веб-приложения в существующий Python-проект.

## Когда использовать

- Нужен веб-интерфейс (HTML/CSS/JS)
- Добавляется API (FastAPI, Flask)
- Нужна статика или шаблоны

## Структура для добавления

```
src/project_name/
├── api/                  # API endpoints (если FastAPI/Flask)
│   ├── __init__.py
│   └── routes.py
├── templates/            # Jinja2 шаблоны
│   └── base.html
└── static/
    ├── css/
    │   └── styles.css
    ├── js/
    │   └── app.js
    └── img/
```

## Файлы конфигурации

Создать в корне проекта:
- `.editorconfig` — единый стиль для всей команды
- `.stylelintrc.json` — линтер CSS (если много стилей)

---

# HTML Standards

## Базовые правила

- Имена файлов: lowercase с дефисами (`my-page.html`)
- Атрибуты в двойных кавычках
- Без trailing slash на self-closing (`<br>`, не `<br />`)
- Всегда закрывающие теги
- Отступы: 4 пробела

## Шаблон base.html

```html
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}{% endblock %}</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/styles.css') }}">
</head>
<body>
    {% block content %}{% endblock %}
    <script src="{{ url_for('static', filename='js/app.js') }}"></script>
</body>
</html>
```

## Порядок атрибутов

1. `src`, `for`, `type`, `href`, `value`
2. `class`
3. `id`, `name`
4. `title`, `alt`
5. `role`, `aria-*`
6. `data-*`

## Доступность (a11y)

- `alt` для всех `<img>` (декоративные: `alt=""`)
- `<label>` для всех полей форм
- Логичная иерархия заголовков H1-H6
- SVG: `<title>` + `aria-hidden="true"` для декоративных

---

# CSS/SCSS Standards

## Организация файлов

```
static/css/
├── _variables.scss      # Переменные
├── _base.scss           # Базовые стили
├── _components.scss     # Компоненты
└── styles.scss          # Главный файл (импорты)
```

## Форматирование

```css
/* Хорошо */
.component {
    display: flex;
    margin: 0;
    padding: 1rem;
}

/* Плохо */
.component{display:flex;margin:0;padding:1rem}
```

## Правила

- Селекторы на отдельных строках
- Пробел перед `{`
- Каждое свойство на отдельной строке
- Точка с запятой после каждого свойства
- Пустая строка между блоками
- Максимум 3 уровня вложенности

## Значения

- Без ведущего нуля: `.5` не `0.5`
- Hex в нижнем регистре: `#fff`
- Короткий hex: `#fff` не `#ffffff`
- Без единиц для нуля: `margin: 0`
- Одинарные кавычки: `content: ''`

## BEM именование

```css
.block { }           /* Компонент */
.block__element { }  /* Часть компонента */
.block--modifier { } /* Вариация */
```

Пример:
```css
.card { }
.card__title { }
.card__body { }
.card--featured { }
```

## JavaScript интеграция

- НЕ используй классы/ID для JS — используй `data-*`
- Состояния: классы с префиксом `.is-*`

```html
<!-- Хорошо -->
<button data-action="toggle" class="btn is-active">Menu</button>

<!-- Плохо -->
<button id="toggle-btn" class="btn active">Menu</button>
```

---

# .editorconfig

```ini
root = true

[*]
indent_style = space
indent_size = 4
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[*.{json,yml,yaml}]
indent_size = 2

[*.{html,css,scss,js}]
indent_size = 2
```

---

# Производительность

- Скрипты перед `</body>` или с `defer`
- Оптимизировать изображения (ImageOptim, SVGOMG)
- CSS/JS минификация в production
- SVG вместо PNG где возможно

---

# Чеклист перед коммитом

- [ ] HTML валиден
- [ ] Все `<img>` имеют `alt`
- [ ] Нет inline стилей
- [ ] CSS без `!important`
- [ ] JS использует `data-*`, не классы
- [ ] Файлы в lowercase с дефисами
