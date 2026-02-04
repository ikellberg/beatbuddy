# План US-003: Регистрация ударов (dev-режим с клавиатурой)

## Цель
Реализовать эмуляцию ударов по датчику через клавиатуру (пробел) для тестирования без физического датчика.

## Acceptance Criteria
- [x] Нажатие пробела регистрируется как удар
- [x] События ударов логируются
- [x] Переключение между KeyboardSensor и MicrophoneSensor через UI
- [x] Чёткий API: connect(), disconnect(), onHit(callback)
- [x] KeyboardSensor реализован
- [x] Можно переключить режим (dev/prod)
- [x] События ударов ловятся корректно
- [x] Код в изолированном модуле (SensorManager.js)
- [x] Модуль логирует все события подключения

---

## Архитектура

```
src/web/js/
├── app.js                    # Интеграция (модификация)
├── MetronomeEngine.js        # Существует
├── SensorManager.js          # НОВЫЙ: фабрика сенсоров
└── sensors/
    └── KeyboardSensor.js     # НОВЫЙ: dev-режим (Space = удар)
```

### Поток данных
```
Keyboard (Space) → KeyboardSensor._handleKeyDown() → hitCallback → app.js
```

---

## Шаги реализации

### Slice 1: SensorManager.js (фабрика)
**Файл:** `src/web/js/SensorManager.js`

Создать фабрику для сенсоров:
- `SensorType` — константы типов ('keyboard', 'microphone')
- `SensorManager.create(type)` — создаёт сенсор нужного типа
- `SensorManager.getTypeFromSettings(devMode)` — определяет тип по настройкам

### Slice 2: KeyboardSensor.js
**Файл:** `src/web/js/sensors/KeyboardSensor.js`

Реализовать сенсор с API:
- `connect()` — addEventListener('keydown')
- `disconnect()` — removeEventListener
- `onHit(callback)` — регистрация обработчика
- `getStatus()` — {connected, type, error}
- `getType()` — 'keyboard'
- `_handleKeyDown(event)` — обработка Space, создание HitEvent

Guard clauses:
- Игнорировать не-Space
- Игнорировать event.repeat (зажатая клавиша)
- Предотвратить скролл (preventDefault)

### Slice 3: Интеграция в app.js
**Файл:** `src/web/js/app.js`

Изменения:
1. Импорт: `import { SensorManager } from './SensorManager.js'`
2. Переменная: `let sensor = null`
3. `onStartClick()`:
   - Создать сенсор по devMode
   - Зарегистрировать onHit callback (логирование)
   - Вызвать connect()
4. `onStopClick()`:
   - Вызвать sensor.disconnect()
   - sensor = null

---

## Тестирование

1. Открыть приложение в браузере
2. Убедиться что Dev Mode включён (чекбокс)
3. Нажать "Старт"
4. Открыть DevTools → Console
5. Нажать пробел несколько раз
6. Проверить логи:
   ```
   [SensorManager] Creating sensor: keyboard
   [KeyboardSensor] Connecting...
   [KeyboardSensor] Connected successfully
   [KeyboardSensor] Hit detected at 12345.67ms
   [App] Hit received: 12345.67ms from keyboard
   ```
7. Нажать "Стоп"
8. Проверить лог отключения

---

## Критические файлы

| Файл | Действие |
|------|----------|
| `src/web/js/SensorManager.js` | Создать |
| `src/web/js/sensors/KeyboardSensor.js` | Создать |
| `src/web/js/app.js` | Модифицировать |

---

## Learnings

1. **План нужно сохранять ДО реализации** — в этой story план был составлен, но не сохранён в файл до начала кодинга. Это нарушение процесса.

2. **ES6 modules работают** — архитектура с import/export хорошо подходит для изоляции модулей.

3. **Guard clauses важны** — в KeyboardSensor используются для:
   - Проверки повторных подключений
   - Фильтрации не-Space клавиш
   - Игнорирования event.repeat

4. **Bound handler для removeEventListener** — нужно сохранять ссылку на `this.boundKeyHandler` чтобы корректно отписаться от события.
