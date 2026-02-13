import { GAME_PHRASES, pickPhraseWithoutImmediateRepeat } from './GamePhrases.js'

const DEFAULT_COOLDOWN_MS = 420
const DEFAULT_TTL_MS = 1100
const DEFAULT_FADE_MS = 220
const DEFAULT_MIN_SKIP = 12
const DEFAULT_MAX_SKIP = 25

export class SpeechService {
  constructor({
    bubbleEl = null,
    textEl = null,
    enabled = true,
    cooldownMs = DEFAULT_COOLDOWN_MS,
    ttlMs = DEFAULT_TTL_MS,
    fadeMs = DEFAULT_FADE_MS,
    minSkip = DEFAULT_MIN_SKIP,
    maxSkip = DEFAULT_MAX_SKIP
  } = {}) {
    this.bubbleEl = bubbleEl
    this.textEl = textEl
    this.enabled = enabled
    this.cooldownMs = cooldownMs
    this.ttlMs = ttlMs
    this.fadeMs = fadeMs
    this.minSkip = minSkip
    this.maxSkip = maxSkip

    this.lastShownAt = 0
    this.lastByGroup = { positive: '', miss: '' }
    this.fadeTimeout = null
    this.hideTimeout = null
    this._callsUntilNext = this._randomSkip()
  }

  setEnabled(enabled) {
    this.enabled = enabled !== false
  }

  showForZone(zone) {
    if (!this.enabled || !this.bubbleEl || !this.textEl) return

    if (--this._callsUntilNext > 0) return
    this._callsUntilNext = this._randomSkip()

    const now = performance.now()
    if (now - this.lastShownAt < this.cooldownMs) return
    this.lastShownAt = now

    const group = zone === 'miss' ? 'miss' : 'positive'
    const text = this._pickPhrase(group)
    if (!text) return

    this._clearTimers()
    this.textEl.textContent = text
    this.bubbleEl.classList.remove('speech-bubble--hidden', 'speech-bubble--fade-out', 'speech-bubble--positive', 'speech-bubble--miss')
    this.bubbleEl.classList.add(group === 'miss' ? 'speech-bubble--miss' : 'speech-bubble--positive')

    this.fadeTimeout = setTimeout(() => {
      this.bubbleEl?.classList.add('speech-bubble--fade-out')
    }, this.ttlMs - this.fadeMs)

    this.hideTimeout = setTimeout(() => {
      if (!this.bubbleEl || !this.textEl) return
      this.bubbleEl.classList.add('speech-bubble--hidden')
      this.bubbleEl.classList.remove('speech-bubble--fade-out', 'speech-bubble--positive', 'speech-bubble--miss')
      this.textEl.textContent = ''
    }, this.ttlMs)
  }

  reset() {
    this._clearTimers()
    this.lastShownAt = 0
    this.lastByGroup = { positive: '', miss: '' }
    this._callsUntilNext = this._randomSkip()
    if (!this.bubbleEl || !this.textEl) return
    this.textEl.textContent = ''
    this.bubbleEl.classList.remove('speech-bubble--positive', 'speech-bubble--miss', 'speech-bubble--fade-out')
    this.bubbleEl.classList.add('speech-bubble--hidden')
  }

  _pickPhrase(group) {
    const phrases = GAME_PHRASES[group]
    if (!phrases || phrases.length === 0) return ''
    const next = pickPhraseWithoutImmediateRepeat(phrases, this.lastByGroup[group] || '')
    this.lastByGroup[group] = next
    return next
  }

  _randomSkip() {
    return this.minSkip + Math.floor(Math.random() * (this.maxSkip - this.minSkip + 1))
  }

  _clearTimers() {
    if (this.fadeTimeout) {
      clearTimeout(this.fadeTimeout)
      this.fadeTimeout = null
    }
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout)
      this.hideTimeout = null
    }
  }
}
