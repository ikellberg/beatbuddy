# Beat Buddy — Web Application

Веб-приложение для тренировки чувства ритма у детей 3-15 лет.

## Структура

```
src/web/
├── index.html              # Главная страница (будет создана при разработке)
├── styles/
│   └── main.css           # Стили приложения (будет создан при разработке)
└── js/
    ├── app.js             # Главный модуль приложения (координация)
    ├── MetronomeEngine.js # Метроном с Web Audio API
    ├── SensorManager.js   # Управление датчиками (KeyboardSensor, MicrophoneSensor)
    ├── RhythmAnalyzer.js  # Анализ точности попадания в ритм
    ├── Animator.js        # Визуальная обратная связь (анимация)
    └── sensors/
        ├── KeyboardSensor.js     # Dev-режим: пробел = удар
        └── MicrophoneSensor.js   # Prod-режим: реальный датчик через мини-джек
```

## Технологии

- **Чистый HTML/CSS/JS** (без фреймворков)
- **Web Audio API** для метронома и чтения датчика
- **Canvas или CSS Animations** для визуальной обратной связи
- **localStorage** для сохранения настроек

## Запуск

Откройте `index.html` в браузере. Всё работает локально, сервер не требуется.

## Процесс разработки

Файлы будут создаваться последовательно в процессе реализации User Stories из [prd.json](../../prd.json).

Текущий статус разработки: см. [project_state.md](../../project_state.md)
