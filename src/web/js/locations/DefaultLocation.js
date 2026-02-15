/**
 * DefaultLocation — локация по умолчанию.
 *
 * 1:1 копия визуала из Animator: пульсирующий круг + цветовой flash при ударе.
 * Реализует интерфейс локации: init, onBeat, onHit, destroy.
 */

import { register } from './LocationRegistry.js'

const COLORS = {
  base: 0xDDE6FF,
  perfect: 0x4CAF50,
  good: 0xFFC107,
  miss: 0xF44336
}

/**
 * Фабрика: создаёт экземпляр DefaultLocation.
 * @returns {{init: Function, onBeat: Function, onHit: Function, destroy: Function}}
 */
function createDefaultLocation() {
  let graphics = null
  let container = null
  let width = 0
  let height = 0
  let hitFlash = null

  return {
    /**
     * @param {PIXI.Container} pixiContainer
     * @param {number} w
     * @param {number} h
     */
    init(pixiContainer, w, h) {
      container = pixiContainer
      width = w
      height = h

      const pixi = globalThis.PIXI
      graphics = new pixi.Graphics()
      container.addChild(graphics)
    },

    /**
     * @param {number} phase - 0..1, фаза текущего бита
     */
    onBeat(phase) {
      if (!graphics) return

      const centerX = width / 2
      const centerY = height / 2
      const minSide = Math.min(width, height)

      const pulse = (Math.cos(phase * Math.PI * 2) + 1) / 2

      const baseRadius = minSide * 0.12
      const pulseRadius = baseRadius + pulse * (minSide * 0.05)

      graphics.clear()

      // Базовая мягкая подсветка в такт.
      graphics.beginFill(COLORS.base, 0.16 + pulse * 0.18)
      graphics.drawCircle(centerX, centerY, pulseRadius * 1.8)
      graphics.endFill()

      graphics.beginFill(COLORS.base, 0.36 + pulse * 0.22)
      graphics.drawCircle(centerX, centerY, pulseRadius)
      graphics.endFill()

      // Короткая цветовая подсветка зоны попадания.
      if (hitFlash) {
        const now = performance.now()
        const progress = (now - hitFlash.start) / hitFlash.durationMs

        if (progress >= 1) {
          hitFlash = null
        } else {
          const fade = 1 - progress
          const color = COLORS[hitFlash.zone]
          const alpha = hitFlash.maxAlpha * fade

          graphics.beginFill(color, alpha * 0.22)
          graphics.drawCircle(centerX, centerY, pulseRadius * 2.3)
          graphics.endFill()

          graphics.lineStyle(8, color, alpha)
          graphics.drawCircle(centerX, centerY, pulseRadius * 1.25)
        }
      }
    },

    /**
     * @param {'perfect' | 'good' | 'miss'} zone
     */
    onHit(zone) {
      const flashMs = zone === 'perfect' ? 320 : zone === 'good' ? 240 : 180
      const maxAlpha = zone === 'perfect' ? 0.55 : zone === 'good' ? 0.45 : 0.35

      hitFlash = {
        zone,
        start: performance.now(),
        durationMs: flashMs,
        maxAlpha
      }
    },

    destroy() {
      if (graphics && container) {
        container.removeChild(graphics)
        graphics.destroy()
      }
      graphics = null
      container = null
      hitFlash = null
    }
  }
}

// Скрыта из UI — оставлена как fallback (не регистрируем в реестре).
// register('default', 'По умолчанию', createDefaultLocation)
