# План US-004: Регистрация ударов с реального датчика

## Цель
Реализовать MicrophoneSensor для работы с пьезодатчиком через мини-джек.

## Файлы для создания/изменения

| Файл | Действие |
|------|----------|
| `src/web/js/sensors/MicrophoneSensor.js` | Создать |
| `src/web/js/SensorManager.js` | Раскомментировать импорт, убрать fallback |

---

## Slice 1: MicrophoneSensor.js

### Структура класса

```javascript
export class MicrophoneSensor {
  constructor(options = {}) {
    // Состояние
    this.connected = false
    this.error = null
    this.hitCallback = null

    // Web Audio API
    this.audioContext = null
    this.mediaStream = null
    this.sourceNode = null
    this.analyserNode = null
    this.processorInterval = null
    this.dataArray = null

    // Настройки детекции (TBD при тестировании)
    this.threshold = options.threshold ?? 0.3
    this.cooldownMs = options.cooldownMs ?? 50
    this.lastHitTime = 0
  }

  // Публичный API (полностью совместим с KeyboardSensor)
  async connect() { ... }
  disconnect() { ... }
  onHit(callback) { ... }
  getStatus() { ... }
  getType() { ... }
}
```

### Алгоритм connect()

1. Guard: если уже подключён — return
2. Логировать: `[MicrophoneSensor] Step 1/5: Starting connection...`
3. `getUserMedia({audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}})`
4. Проверить: если `mediaStream` null — throw Error
5. Создать `AudioContext`, вызвать `resume()` если suspended
6. Создать `MediaStreamSource` → `AnalyserNode` (fftSize=256, smoothing=0)
7. Инициализировать `dataArray = new Uint8Array(analyserNode.fftSize)`
8. Подписаться на событие `ended` на mediaStream (для отзыва разрешения)
9. Запустить `setInterval(_processAudio, 5ms)`
10. Логировать КАЖДЫЙ шаг

### Алгоритм disconnect()

1. Guard: если не подключён — return
2. Логировать: `[MicrophoneSensor] Disconnecting...`
3. `clearInterval(this.processorInterval)`
4. Остановить все треки: `this.mediaStream.getTracks().forEach(track => track.stop())`
5. Закрыть audioContext: `this.audioContext.close()` (если state !== 'closed')
6. Сбросить все ссылки: `mediaStream`, `sourceNode`, `analyserNode`, `dataArray` → null
7. Установить `this.connected = false`
8. Логировать: `[MicrophoneSensor] Disconnected`

### Алгоритм _processAudio()

```javascript
_processAudio() {
  // Guard clauses
  if (!this.connected || !this.analyserNode) return
  if (!this.hitCallback) return
  if (this.audioContext.state !== 'running') return

  try {
    this.analyserNode.getByteTimeDomainData(this.dataArray)
    // dataArray: 0-255, где 128 = тишина
    // Найти max отклонение от 128, нормализовать к 0-1
    const maxAmplitude = this._getMaxAmplitude()

    const now = performance.now()
    if (maxAmplitude >= this.threshold && now - this.lastHitTime >= this.cooldownMs) {
      this.lastHitTime = now
      this.hitCallback({ timestamp: now, source: 'microphone' })
      console.log(`[MicrophoneSensor] Hit detected at ${now.toFixed(2)}ms`)
    }
  } catch (err) {
    console.error('[MicrophoneSensor] Error in _processAudio:', err)
  }
}
```

### Алгоритм getStatus()

```javascript
getStatus() {
  return {
    connected: this.connected,
    type: 'microphone',
    error: this.error
  }
}
```

### Алгоритм getType()

```javascript
getType() {
  return 'microphone'
}
```

### Обработка отзыва разрешения

В connect() после получения mediaStream:
```javascript
this.mediaStream.getTracks()[0].addEventListener('ended', () => {
  console.warn('[MicrophoneSensor] Media stream ended (permission revoked?)')
  this.error = 'Permission revoked'
  this.disconnect()
})
```

### Обработка ошибок

| Ошибка | Сообщение |
|--------|-----------|
| NotAllowedError | Доступ к микрофону запрещён |
| NotFoundError | Микрофон не найден |
| NotReadableError | Микрофон занят другим приложением |

---

## Slice 2: Интеграция с SensorManager

```javascript
// Раскомментировать:
import { MicrophoneSensor } from './sensors/MicrophoneSensor.js'

// В create():
if (type === SensorType.MICROPHONE) {
  return new MicrophoneSensor(options)
}
// Удалить fallback на KeyboardSensor и console.warn
```

---

## Slice 3: Тестирование на реальном датчике

1. Выключить Dev Mode
2. Нажать Старт
3. Разрешить доступ к микрофону
4. Постучать по датчику
5. Смотреть консоль — должны быть логи `[MicrophoneSensor] Hit detected`

### Подбор параметров

- `threshold`: начать с 0.3, увеличить если ложные срабатывания
- `cooldownMs`: начать с 50ms, увеличить если дребезг

---

## Параметры детекции

| Параметр | Значение | Назначение |
|----------|----------|------------|
| threshold | 0.3 | Порог амплитуды (0-1). TBD |
| cooldownMs | 50ms | Минимальный интервал между ударами |
| fftSize | 256 | Размер буфера анализа |
| processingInterval | 5ms | Частота опроса (~200 Hz) |

---

## Диагностика проблемы "работает с 5-й попытки"

Решения в плане:
- Явная проверка `audioContext.state` и вызов `resume()`
- Детальное логирование каждого шага
- Правильный `async/await` без гонок

---

## Верификация

После реализации:
1. `Dev Mode = ON` → KeyboardSensor (пробел работает)
2. `Dev Mode = OFF` → MicrophoneSensor (датчик работает)
3. Консоль показывает все логи подключения
4. Удары регистрируются, нет дребезга
5. При отзыве разрешения — корректное отключение
6. Анимация и статистика работают как раньше
