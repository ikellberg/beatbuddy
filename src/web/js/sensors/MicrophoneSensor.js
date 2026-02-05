/**
 * MicrophoneSensor — детекция ударов через пьезодатчик
 *
 * Датчик подключён через мини-джек как микрофон.
 * Реагирует только на прямой удар (нет фоновых шумов).
 */

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

    // Настройки детекции
    this.threshold = options.threshold ?? 0.3
    this.cooldownMs = options.cooldownMs ?? 500
    this.processingIntervalMs = options.processingIntervalMs ?? 5
    this.lastHitTime = 0
    this.dataArray = null

    console.log('[MicrophoneSensor] Instance created', {
      threshold: this.threshold,
      cooldownMs: this.cooldownMs,
      processingIntervalMs: this.processingIntervalMs
    })
  }

  /**
   * Подключить сенсор (запросить доступ к микрофону)
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connected) {
      console.warn('[MicrophoneSensor] Already connected')
      return
    }

    console.log('[MicrophoneSensor] Connecting...')

    try {
      // Шаг 1: Запрос доступа к микрофону
      console.log('[MicrophoneSensor] Step 1: Requesting microphone access...')
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })
      console.log('[MicrophoneSensor] Step 1: Microphone access granted')

      // Шаг 1.1: Подписка на событие ended (отзыв разрешения)
      this.mediaStream.getTracks()[0].addEventListener('ended', () => {
        console.warn('[MicrophoneSensor] Media stream ended (permission revoked?)')
        this.error = 'Разрешение на микрофон отозвано'
        this.disconnect()
      })
      console.log('[MicrophoneSensor] Step 1.1: Subscribed to track ended event')

      // Шаг 2: Создание AudioContext
      console.log('[MicrophoneSensor] Step 2: Creating AudioContext...')
      this.audioContext = new AudioContext()
      console.log('[MicrophoneSensor] Step 2: AudioContext created, state:', this.audioContext.state)

      // Шаг 3: Resume AudioContext если suspended
      if (this.audioContext.state === 'suspended') {
        console.log('[MicrophoneSensor] Step 3: AudioContext suspended, resuming...')
        await this.audioContext.resume()
        console.log('[MicrophoneSensor] Step 3: AudioContext resumed, state:', this.audioContext.state)
      } else {
        console.log('[MicrophoneSensor] Step 3: AudioContext already running')
      }

      // Шаг 4: Создание source node
      console.log('[MicrophoneSensor] Step 4: Creating MediaStreamSource...')
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)
      console.log('[MicrophoneSensor] Step 4: MediaStreamSource created')

      // Шаг 5: Создание analyser node
      console.log('[MicrophoneSensor] Step 5: Creating AnalyserNode...')
      this.analyserNode = this.audioContext.createAnalyser()
      this.analyserNode.fftSize = 256
      this.analyserNode.smoothingTimeConstant = 0
      console.log('[MicrophoneSensor] Step 5: AnalyserNode created, fftSize:', this.analyserNode.fftSize)

      // Шаг 6: Подключение графа
      console.log('[MicrophoneSensor] Step 6: Connecting audio graph...')
      this.sourceNode.connect(this.analyserNode)
      console.log('[MicrophoneSensor] Step 6: Audio graph connected')

      // Шаг 7: Создание буфера для данных
      console.log('[MicrophoneSensor] Step 7: Creating data buffer...')
      this.dataArray = new Uint8Array(this.analyserNode.frequencyBinCount)
      console.log('[MicrophoneSensor] Step 7: Data buffer created, size:', this.dataArray.length)

      // Шаг 8: Запуск обработки
      console.log('[MicrophoneSensor] Step 8: Starting audio processing...')
      this.processorInterval = setInterval(
        () => this._processAudio(),
        this.processingIntervalMs
      )
      console.log('[MicrophoneSensor] Step 8: Audio processing started')

      this.connected = true
      this.error = null
      console.log('[MicrophoneSensor] Connected successfully')

    } catch (err) {
      this.error = this._formatError(err)
      console.error('[MicrophoneSensor] Connection failed:', this.error)
      throw new Error(this.error)
    }
  }

  /**
   * Отключить сенсор
   */
  disconnect() {
    if (!this.connected) {
      console.warn('[MicrophoneSensor] Already disconnected')
      return
    }

    console.log('[MicrophoneSensor] Disconnecting...')

    // Остановить обработку
    if (this.processorInterval) {
      clearInterval(this.processorInterval)
      this.processorInterval = null
      console.log('[MicrophoneSensor] Audio processing stopped')
    }

    // Отключить audio nodes
    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
      console.log('[MicrophoneSensor] Source node disconnected')
    }

    // Закрыть AudioContext
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
      console.log('[MicrophoneSensor] AudioContext closed')
    }

    // Остановить медиа-поток
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop())
      this.mediaStream = null
      console.log('[MicrophoneSensor] Media stream stopped')
    }

    this.analyserNode = null
    this.dataArray = null
    this.connected = false

    console.log('[MicrophoneSensor] Disconnected')
  }

  /**
   * Подписаться на события удара
   * @param {function} callback - функция, вызываемая при ударе
   */
  onHit(callback) {
    this.hitCallback = callback
    console.log('[MicrophoneSensor] Hit callback registered')
  }

  /**
   * Получить текущий статус сенсора
   * @returns {{connected: boolean, type: string, error: string|null}}
   */
  getStatus() {
    return {
      connected: this.connected,
      type: 'microphone',
      error: this.error
    }
  }

  /**
   * Получить тип сенсора
   * @returns {string}
   */
  getType() {
    return 'microphone'
  }

  /**
   * Обработка аудио данных для детекции удара
   * @private
   */
  _processAudio() {
    if (!this.analyserNode || !this.dataArray) {
      return
    }

    if (this.audioContext && this.audioContext.state !== 'running') {
      return
    }

    try {
      this.analyserNode.getByteTimeDomainData(this.dataArray)

      // dataArray: 0-255, где 128 = тишина
      // Найти максимальное отклонение от 128
      let maxDeviation = 0
      for (let i = 0; i < this.dataArray.length; i++) {
        const deviation = Math.abs(this.dataArray[i] - 128)
        if (deviation > maxDeviation) {
          maxDeviation = deviation
        }
      }

      // Нормализовать к 0-1 (максимальное отклонение = 127)
      const amplitude = maxDeviation / 127

      const now = performance.now()

      // Проверка порога и cooldown
      if (amplitude >= this.threshold && now - this.lastHitTime >= this.cooldownMs) {
        this.lastHitTime = now

        const hitEvent = {
          timestamp: now,
          source: 'microphone',
          amplitude: amplitude
        }

        console.log(`[MicrophoneSensor] Hit detected at ${now.toFixed(2)}ms, amplitude: ${amplitude.toFixed(3)}`)

        if (!this.hitCallback) {
          console.warn('[MicrophoneSensor] No hit callback registered')
          return
        }

        this.hitCallback(hitEvent)
      }
    } catch (err) {
      console.error('[MicrophoneSensor] Error in _processAudio:', err)
    }
  }

  /**
   * Форматировать ошибку в понятное сообщение
   * @param {Error} err
   * @returns {string}
   * @private
   */
  _formatError(err) {
    const errorMessages = {
      NotAllowedError: 'Доступ к микрофону запрещён',
      NotFoundError: 'Микрофон не найден',
      NotReadableError: 'Микрофон занят другим приложением'
    }

    return errorMessages[err.name] || `Ошибка микрофона: ${err.message}`
  }
}
