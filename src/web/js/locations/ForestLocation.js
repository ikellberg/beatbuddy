/**
 * ForestLocation — сказочная лесная локация.
 *
 * Тёплый мультяшный лес: солнце с лучами, пушистые облака, многослойные холмы,
 * деревья с объёмными кронами, яркие цветы, грибы, бабочки, травинки.
 * Всё покачивается в такт метроному. Удары вызывают магические эффекты.
 */

import { register } from './LocationRegistry.js'

// --- Палитра ---

// Небо: тёплый градиент от голубого к персиковому у горизонта (12 полос для плавности).
const SKY_BANDS = [
  0x5BC8F5, 0x6ECEF3, 0x80D4F0, 0x93DAED,
  0xA5E0EA, 0xB8E5E0, 0xC8E8D4, 0xD6EBC8,
  0xE3EEBB, 0xEEF0B0, 0xF5E8B0, 0xFCE4B5
]

const SUN_COLOR = 0xFFF176
const SUN_GLOW = 0xFFF9C4
const CLOUD_COLOR = 0xFFFFFF

// Холмы (дальний → ближний).
const HILL_FAR = 0x81C784
const HILL_MID = 0x66BB6A
const HILL_NEAR = 0x4CAF50

// Земля.
const GROUND_TOP = 0x43A047
const GROUND_BOTTOM = 0x2E7D32
const GRASS_COLOR = 0x66BB6A
const GRASS_DARK = 0x388E3C

// Деревья.
const TRUNK_COLORS = [0x795548, 0x6D4C41, 0x8D6E63]
const CROWN_BASE = [0x2E7D32, 0x388E3C, 0x43A047, 0x338033]
const CROWN_LIGHT = [0x4CAF50, 0x56B84F, 0x66BB6A, 0x5CB860]

// Цветы.
const FLOWER_COLORS = [0xFF80AB, 0xFFD54F, 0xFF8A65, 0xCE93D8, 0x81D4FA, 0xF48FB1]
const FLOWER_CENTER = 0xFFF176
const STEM_COLOR = 0x558B2F

// Грибы.
const MUSH_CAP = [0xEF5350, 0xFF7043]
const MUSH_DOTS = 0xFFFFFF
const MUSH_STEM = 0xFFF8E1

// Бабочки.
const BUTTERFLY_WINGS = [0xFF80AB, 0xFFD54F, 0x81D4FA]
const BUTTERFLY_SPOTS = [0xF48FB1, 0xFFE082, 0x4FC3F7]
const BUTTERFLY_BODY = 0x5D4037

const MAX_EFFECTS = 3
const MAX_PARTICLES = 8

/**
 * Фабрика: создаёт экземпляр ForestLocation.
 * @returns {{init: Function, onBeat: Function, onHit: Function, destroy: Function}}
 */
function createForestLocation() {
  let graphics = null
  let container = null
  let width = 0
  let height = 0

  let trees = []
  let flowers = []
  let butterflies = []
  let mushrooms = []
  let grassBlades = []
  let clouds = []

  let effects = []
  let particles = []
  let hitState = null

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

      const m = Math.min(w, h)
      const groundY = h * 0.72

      // Облака (3 шт) — массивы кругов.
      clouds = [
        { x: w * 0.15, y: h * 0.12, scale: m * 0.001 },
        { x: w * 0.55, y: h * 0.08, scale: m * 0.0013 },
        { x: w * 0.85, y: h * 0.15, scale: m * 0.0009 }
      ]

      // Деревья (5 шт) — разные размеры для глубины.
      trees = [
        { x: w * 0.05, y: groundY, trunkH: m * 0.20, trunkW: m * 0.028, crownR: m * 0.085, color: 0, light: 0 },
        { x: w * 0.25, y: groundY, trunkH: m * 0.30, trunkW: m * 0.035, crownR: m * 0.12, color: 1, light: 1 },
        { x: w * 0.50, y: groundY, trunkH: m * 0.34, trunkW: m * 0.040, crownR: m * 0.14, color: 2, light: 2 },
        { x: w * 0.73, y: groundY, trunkH: m * 0.26, trunkW: m * 0.032, crownR: m * 0.10, color: 3, light: 3 },
        { x: w * 0.93, y: groundY, trunkH: m * 0.22, trunkW: m * 0.026, crownR: m * 0.08, color: 0, light: 0 }
      ]

      // Грибы (3 шт).
      mushrooms = [
        { x: w * 0.18, y: groundY, capR: m * 0.022, stemH: m * 0.025, capColor: 0 },
        { x: w * 0.60, y: groundY, capR: m * 0.018, stemH: m * 0.020, capColor: 1 },
        { x: w * 0.82, y: groundY, capR: m * 0.020, stemH: m * 0.022, capColor: 0 }
      ]

      // Цветы (7 шт) — крупнее, ярче.
      flowers = [
        { x: w * 0.07, y: groundY, petalR: m * 0.024, color: FLOWER_COLORS[0], stemH: m * 0.08 },
        { x: w * 0.16, y: groundY, petalR: m * 0.020, color: FLOWER_COLORS[1], stemH: m * 0.065 },
        { x: w * 0.35, y: groundY, petalR: m * 0.028, color: FLOWER_COLORS[2], stemH: m * 0.09 },
        { x: w * 0.47, y: groundY, petalR: m * 0.022, color: FLOWER_COLORS[3], stemH: m * 0.07 },
        { x: w * 0.63, y: groundY, petalR: m * 0.026, color: FLOWER_COLORS[4], stemH: m * 0.085 },
        { x: w * 0.78, y: groundY, petalR: m * 0.020, color: FLOWER_COLORS[5], stemH: m * 0.06 },
        { x: w * 0.92, y: groundY, petalR: m * 0.024, color: FLOWER_COLORS[1], stemH: m * 0.075 }
      ]

      // Травинки (18 шт) — вдоль линии земли.
      grassBlades = []
      for (let i = 0; i < 18; i++) {
        grassBlades.push({
          x: w * (i / 18 + 0.02),
          y: groundY,
          h: m * (0.03 + (i % 3) * 0.012),
          lean: (i % 2 === 0 ? 1 : -1) * m * 0.008
        })
      }

      // Бабочки (3 шт).
      butterflies = [
        { baseX: w * 0.28, baseY: h * 0.32, size: m * 0.028, speed: 1.1, offset: 0, colorIdx: 0 },
        { baseX: w * 0.58, baseY: h * 0.25, size: m * 0.024, speed: 0.8, offset: 2.1, colorIdx: 1 },
        { baseX: w * 0.80, baseY: h * 0.38, size: m * 0.026, speed: 0.95, offset: 4.2, colorIdx: 2 }
      ]

      // Pre-allocate effects.
      effects = []
      for (let i = 0; i < MAX_EFFECTS; i++) {
        effects.push({ active: false, type: '', start: 0, durationMs: 0, zone: '' })
      }

      // Pre-allocate particles.
      particles = []
      for (let i = 0; i < MAX_PARTICLES; i++) {
        particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, start: 0, durationMs: 0, size: 0, color: 0 })
      }

      hitState = null
    },

    /**
     * @param {number} phase - 0..1, фаза текущего бита
     */
    onBeat(phase) {
      if (!graphics) return

      const g = graphics
      const w = width
      const h = height
      const m = Math.min(w, h)
      const now = performance.now()
      const groundY = h * 0.72

      g.clear()

      // ========== НЕБО ==========
      const skyH = groundY
      const bandH = skyH / SKY_BANDS.length
      for (let i = 0; i < SKY_BANDS.length; i++) {
        g.beginFill(SKY_BANDS[i])
        g.drawRect(0, i * bandH, w, bandH + 1)
        g.endFill()
      }

      // ========== СОЛНЦЕ ==========
      const sunX = w * 0.82
      const sunY = h * 0.13
      const sunR = m * 0.07
      const pulse = (Math.cos(phase * Math.PI * 2) + 1) / 2

      // Мягкое свечение (3 слоя).
      g.beginFill(SUN_GLOW, 0.08 + pulse * 0.04)
      g.drawCircle(sunX, sunY, sunR * 3.5)
      g.endFill()

      g.beginFill(SUN_GLOW, 0.15 + pulse * 0.06)
      g.drawCircle(sunX, sunY, sunR * 2.2)
      g.endFill()

      g.beginFill(SUN_GLOW, 0.25 + pulse * 0.08)
      g.drawCircle(sunX, sunY, sunR * 1.5)
      g.endFill()

      // Солнечный диск.
      g.beginFill(SUN_COLOR)
      g.drawCircle(sunX, sunY, sunR)
      g.endFill()

      // Лучи (8 шт) — прямоугольники с поворотом через смещение.
      const rayLen = m * 0.04 + pulse * m * 0.015
      const rayW = m * 0.006
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + phase * 0.3
        const rx = sunX + Math.cos(angle) * (sunR * 1.3)
        const ry = sunY + Math.sin(angle) * (sunR * 1.3)
        const ex = sunX + Math.cos(angle) * (sunR * 1.3 + rayLen)
        const ey = sunY + Math.sin(angle) * (sunR * 1.3 + rayLen)

        g.lineStyle(rayW, SUN_COLOR, 0.5 + pulse * 0.2)
        g.moveTo(rx, ry)
        g.lineTo(ex, ey)
      }
      g.lineStyle(0)

      // ========== ОБЛАКА ==========
      const sway = Math.sin(phase * Math.PI * 2) * m * 0.02

      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i]
        const s = c.scale
        const cx = c.x + sway * 0.3 * (i + 1)

        // Каждое облако = 5 перекрывающихся кругов.
        g.beginFill(CLOUD_COLOR, 0.85)
        g.drawEllipse(cx, c.y, s * 40, s * 20)
        g.drawEllipse(cx - s * 25, c.y + s * 5, s * 28, s * 18)
        g.drawEllipse(cx + s * 25, c.y + s * 3, s * 30, s * 16)
        g.drawEllipse(cx - s * 10, c.y - s * 10, s * 25, s * 16)
        g.drawEllipse(cx + s * 12, c.y - s * 8, s * 22, s * 14)
        g.endFill()
      }

      // ========== ХОЛМЫ (3 слоя для глубины) ==========

      // Дальний слой.
      g.beginFill(HILL_FAR, 0.6)
      g.moveTo(0, groundY - m * 0.05)
      g.bezierCurveTo(w * 0.15, groundY - m * 0.15, w * 0.3, groundY - m * 0.12, w * 0.45, groundY - m * 0.06)
      g.bezierCurveTo(w * 0.6, groundY - m * 0.01, w * 0.75, groundY - m * 0.10, w, groundY - m * 0.04)
      g.lineTo(w, groundY)
      g.lineTo(0, groundY)
      g.closePath()
      g.endFill()

      // Средний слой.
      g.beginFill(HILL_MID, 0.7)
      g.moveTo(0, groundY)
      g.bezierCurveTo(w * 0.2, groundY - m * 0.08, w * 0.4, groundY - m * 0.04, w * 0.55, groundY - m * 0.02)
      g.bezierCurveTo(w * 0.7, groundY, w * 0.85, groundY - m * 0.06, w, groundY - m * 0.01)
      g.lineTo(w, groundY + m * 0.02)
      g.lineTo(0, groundY + m * 0.02)
      g.closePath()
      g.endFill()

      // ========== ЗЕМЛЯ ==========
      g.beginFill(GROUND_TOP)
      g.drawRect(0, groundY, w, h * 0.12)
      g.endFill()

      g.beginFill(GROUND_BOTTOM)
      g.drawRect(0, groundY + h * 0.12, w, h - groundY - h * 0.12)
      g.endFill()

      // Волнистая граница земли.
      g.beginFill(HILL_NEAR)
      g.moveTo(0, groundY)
      g.bezierCurveTo(w * 0.1, groundY - m * 0.02, w * 0.2, groundY + m * 0.01, w * 0.35, groundY)
      g.bezierCurveTo(w * 0.5, groundY - m * 0.015, w * 0.65, groundY + m * 0.01, w * 0.8, groundY - m * 0.005)
      g.bezierCurveTo(w * 0.9, groundY + m * 0.01, w * 0.95, groundY - m * 0.005, w, groundY)
      g.lineTo(w, groundY + m * 0.03)
      g.lineTo(0, groundY + m * 0.03)
      g.closePath()
      g.endFill()

      // ========== ДЕРЕВЬЯ ==========
      const treeSway = Math.sin(phase * Math.PI * 2) * m * 0.02

      for (let i = 0; i < trees.length; i++) {
        const t = trees[i]
        const ci = t.color % CROWN_BASE.length
        const li = t.light % CROWN_LIGHT.length

        // Ствол — скруглённый прямоугольник.
        const tw = t.trunkW
        const th = t.trunkH
        g.beginFill(TRUNK_COLORS[ci % TRUNK_COLORS.length])
        g.drawRoundedRect(t.x - tw / 2, t.y - th, tw, th, tw * 0.3)
        g.endFill()

        // Тёмная полоса на стволе (текстура).
        g.beginFill(0x4E342E, 0.25)
        g.drawRoundedRect(t.x - tw * 0.15, t.y - th * 0.8, tw * 0.12, th * 0.5, tw * 0.1)
        g.endFill()

        // Крона (покачивается) — 7 перекрывающихся кругов.
        const sx = treeSway * (0.5 + i * 0.12)
        const crX = t.x + sx
        const crY = t.y - th
        const r = t.crownR

        // Тень кроны.
        g.beginFill(0x1B5E20, 0.2)
        g.drawCircle(crX + r * 0.05, crY + r * 0.15, r * 1.05)
        g.endFill()

        // Основной объём (5 кругов).
        g.beginFill(CROWN_BASE[ci])
        g.drawCircle(crX, crY, r)
        g.drawCircle(crX - r * 0.55, crY + r * 0.25, r * 0.7)
        g.drawCircle(crX + r * 0.55, crY + r * 0.25, r * 0.7)
        g.drawCircle(crX - r * 0.3, crY - r * 0.35, r * 0.6)
        g.drawCircle(crX + r * 0.3, crY - r * 0.35, r * 0.6)
        g.endFill()

        // Светлые блики сверху (3 круга).
        g.beginFill(CROWN_LIGHT[li], 0.55)
        g.drawCircle(crX - r * 0.15, crY - r * 0.3, r * 0.45)
        g.drawCircle(crX + r * 0.2, crY - r * 0.2, r * 0.35)
        g.drawCircle(crX, crY - r * 0.5, r * 0.3)
        g.endFill()
      }

      // ========== ГРИБЫ ==========
      for (let i = 0; i < mushrooms.length; i++) {
        const mu = mushrooms[i]
        const mushroomSway = treeSway * 0.2

        // Ножка.
        const stemW = mu.capR * 0.6
        g.beginFill(MUSH_STEM)
        g.drawRoundedRect(
          mu.x - stemW / 2 + mushroomSway * 0.5,
          mu.y - mu.stemH,
          stemW, mu.stemH,
          stemW * 0.3
        )
        g.endFill()

        // Шляпка — полукруг (эллипс, нижняя часть перекрыта ножкой).
        const capY = mu.y - mu.stemH
        g.beginFill(MUSH_CAP[mu.capColor])
        g.drawEllipse(mu.x + mushroomSway * 0.5, capY, mu.capR, mu.capR * 0.6)
        g.endFill()

        // Белые точки на шляпке.
        g.beginFill(MUSH_DOTS, 0.85)
        g.drawCircle(mu.x + mushroomSway * 0.5 - mu.capR * 0.35, capY - mu.capR * 0.1, mu.capR * 0.12)
        g.drawCircle(mu.x + mushroomSway * 0.5 + mu.capR * 0.25, capY - mu.capR * 0.15, mu.capR * 0.1)
        g.drawCircle(mu.x + mushroomSway * 0.5, capY - mu.capR * 0.3, mu.capR * 0.09)
        g.endFill()
      }

      // ========== ЦВЕТЫ ==========
      let flowerScale = 1
      if (hitState) {
        const elapsed = now - hitState.start
        if (elapsed < hitState.durationMs) {
          const fade = 1 - elapsed / hitState.durationMs
          if (hitState.zone === 'perfect') {
            flowerScale = 1 + 0.5 * fade
          } else if (hitState.zone === 'good') {
            flowerScale = 1 + 0.25 * fade
          }
        } else {
          hitState = null
        }
      }

      for (let i = 0; i < flowers.length; i++) {
        const f = flowers[i]
        const stemSway = treeSway * 0.4 * (0.7 + i * 0.08)
        const topX = f.x + stemSway
        const topY = f.y - f.stemH

        // Стебель (толще).
        g.lineStyle(m * 0.004, STEM_COLOR, 1)
        g.moveTo(f.x, f.y)
        // Изогнутый стебель.
        g.bezierCurveTo(
          f.x + stemSway * 0.3, f.y - f.stemH * 0.4,
          topX - stemSway * 0.2, f.y - f.stemH * 0.7,
          topX, topY
        )
        g.lineStyle(0)

        // Листик на стебле.
        const leafX = f.x + stemSway * 0.2
        const leafY = f.y - f.stemH * 0.4
        g.beginFill(STEM_COLOR, 0.8)
        g.drawEllipse(leafX + m * 0.01, leafY, m * 0.012, m * 0.005)
        g.endFill()

        // Лепестки (6 шт вокруг центра).
        const pr = f.petalR * flowerScale
        for (let p = 0; p < 6; p++) {
          const angle = (p / 6) * Math.PI * 2
          const px = topX + Math.cos(angle) * pr
          const py = topY + Math.sin(angle) * pr
          g.beginFill(f.color, 0.9)
          g.drawEllipse(px, py, pr * 0.85, pr * 1.1)
          g.endFill()
        }

        // Серединка (двухцветная).
        g.beginFill(FLOWER_CENTER)
        g.drawCircle(topX, topY, pr * 0.45)
        g.endFill()
        g.beginFill(0xFFB300, 0.5)
        g.drawCircle(topX - pr * 0.1, topY - pr * 0.1, pr * 0.2)
        g.endFill()
      }

      // ========== ТРАВИНКИ ==========
      for (let i = 0; i < grassBlades.length; i++) {
        const gb = grassBlades[i]
        const grassSway = treeSway * 0.3 * ((i % 3) * 0.3 + 0.5)
        const tipX = gb.x + gb.lean + grassSway
        const tipY = gb.y - gb.h

        const color = i % 2 === 0 ? GRASS_COLOR : GRASS_DARK
        g.lineStyle(m * 0.003, color, 0.8)
        g.moveTo(gb.x, gb.y)
        g.bezierCurveTo(
          gb.x + gb.lean * 0.3, gb.y - gb.h * 0.5,
          tipX - gb.lean * 0.2, gb.y - gb.h * 0.8,
          tipX, tipY
        )
      }
      g.lineStyle(0)

      // ========== БАБОЧКИ ==========
      const timeSec = now / 1000
      for (let i = 0; i < butterflies.length; i++) {
        const b = butterflies[i]
        const ci = b.colorIdx
        const t = timeSec * b.speed + b.offset
        const bx = b.baseX + Math.sin(t) * m * 0.07
        const by = b.baseY + Math.cos(t * 0.7) * m * 0.035

        // Крылья «хлопают» — привязаны к phase для синхронности с ритмом.
        const wingFlap = 0.35 + Math.abs(Math.sin(phase * Math.PI)) * 0.65
        const wingW = b.size * 1.6 * wingFlap
        const wingH = b.size * 1.3

        // Задние крылья (чуть меньше, чуть ниже).
        g.beginFill(BUTTERFLY_WINGS[ci], 0.6)
        g.drawEllipse(bx - wingW * 0.4, by + b.size * 0.3, wingW * 0.7, wingH * 0.65)
        g.drawEllipse(bx + wingW * 0.4, by + b.size * 0.3, wingW * 0.7, wingH * 0.65)
        g.endFill()

        // Передние крылья.
        g.beginFill(BUTTERFLY_WINGS[ci], 0.85)
        g.drawEllipse(bx - wingW * 0.55, by, wingW, wingH)
        g.drawEllipse(bx + wingW * 0.55, by, wingW, wingH)
        g.endFill()

        // Пятнышки на крыльях.
        g.beginFill(BUTTERFLY_SPOTS[ci], 0.5)
        g.drawCircle(bx - wingW * 0.55, by, wingW * 0.3)
        g.drawCircle(bx + wingW * 0.55, by, wingW * 0.3)
        g.endFill()

        // Тело.
        g.beginFill(BUTTERFLY_BODY)
        g.drawEllipse(bx, by, b.size * 0.12, b.size * 0.55)
        g.endFill()

        // Усики.
        g.lineStyle(m * 0.002, BUTTERFLY_BODY, 0.7)
        g.moveTo(bx, by - b.size * 0.4)
        g.lineTo(bx - b.size * 0.3, by - b.size * 0.8)
        g.moveTo(bx, by - b.size * 0.4)
        g.lineTo(bx + b.size * 0.3, by - b.size * 0.8)
        g.lineStyle(0)

        // Кончики усиков.
        g.beginFill(BUTTERFLY_BODY, 0.7)
        g.drawCircle(bx - b.size * 0.3, by - b.size * 0.8, m * 0.003)
        g.drawCircle(bx + b.size * 0.3, by - b.size * 0.8, m * 0.003)
        g.endFill()
      }

      // ========== ЭФФЕКТЫ ==========
      for (let i = 0; i < effects.length; i++) {
        const e = effects[i]
        if (!e.active) continue

        const elapsed = now - e.start
        if (elapsed >= e.durationMs) {
          e.active = false
          continue
        }

        const progress = elapsed / e.durationMs
        const fade = 1 - progress

        if (e.type === 'glow') {
          const color = e.zone === 'perfect' ? 0x4CAF50 : 0xFFC107
          const maxAlpha = e.zone === 'perfect' ? 0.25 : 0.18

          // Мягкий многослойный ореол.
          g.beginFill(color, maxAlpha * fade * 0.3)
          g.drawCircle(w / 2, groundY * 0.7, m * 0.35 * (0.8 + progress * 0.4))
          g.endFill()

          g.beginFill(color, maxAlpha * fade * 0.6)
          g.drawCircle(w / 2, groundY * 0.7, m * 0.22 * (0.8 + progress * 0.3))
          g.endFill()

          g.beginFill(color, maxAlpha * fade)
          g.drawCircle(w / 2, groundY * 0.7, m * 0.12 * (0.9 + progress * 0.2))
          g.endFill()
        } else if (e.type === 'overlay') {
          // Мягкое потемнение сверху вниз.
          g.beginFill(0x1B5E20, 0.2 * fade)
          g.drawRect(0, 0, w, h)
          g.endFill()
        }
      }

      // ========== ЧАСТИЦЫ ==========
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        if (!p.active) continue

        const elapsed = now - p.start
        if (elapsed >= p.durationMs) {
          p.active = false
          continue
        }

        const progress = elapsed / p.durationMs
        const fade = 1 - progress
        const eased = 1 - (1 - progress) * (1 - progress) // easeOut

        const px = p.x + p.vx * eased
        const py = p.y + p.vy * eased

        // Блёстка с ореолом.
        g.beginFill(p.color, fade * 0.3)
        g.drawCircle(px, py, p.size * 2 * fade)
        g.endFill()

        g.beginFill(p.color, fade * 0.85)
        g.drawCircle(px, py, p.size * (0.4 + fade * 0.6))
        g.endFill()
      }
    },

    /**
     * @param {'perfect' | 'good' | 'miss'} zone
     */
    onHit(zone) {
      if (!graphics) return

      const now = performance.now()
      const w = width
      const h = height
      const m = Math.min(w, h)
      const groundY = h * 0.72

      if (zone === 'perfect') {
        hitState = { zone: 'perfect', start: now, durationMs: 350 }
        _addEffect('glow', now, 500, 'perfect')

        // Золотые блёстки от центра.
        const cx = w / 2
        const cy = groundY * 0.65
        for (let i = 0; i < 7; i++) {
          const angle = (i / 7) * Math.PI * 2 + 0.2
          const speed = m * 0.25
          _addParticle(cx, cy,
            Math.cos(angle) * speed, Math.sin(angle) * speed,
            now, 500, m * 0.014, 0xFFD54F
          )
        }
      } else if (zone === 'good') {
        hitState = { zone: 'good', start: now, durationMs: 250 }
        _addEffect('glow', now, 350, 'good')

        // Мягкие частицы.
        const cx = w / 2
        const cy = groundY * 0.65
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + 0.5
          _addParticle(cx, cy,
            Math.cos(angle) * m * 0.15, Math.sin(angle) * m * 0.15,
            now, 400, m * 0.01, 0xFFF176
          )
        }
      } else {
        // Падающие листья — коричнево-рыжие.
        for (let i = 0; i < 4; i++) {
          const startX = w * (0.15 + i * 0.2)
          _addParticle(
            startX, h * 0.1,
            (i % 2 === 0 ? 1 : -1) * m * 0.08,
            m * 0.45,
            now, 600,
            m * 0.018,
            i % 2 === 0 ? 0x8D6E63 : 0xA1887F
          )
        }

        _addEffect('overlay', now, 250, 'miss')
      }
    },

    destroy() {
      if (graphics && container) {
        container.removeChild(graphics)
        graphics.destroy()
      }
      graphics = null
      container = null
      trees = []
      flowers = []
      butterflies = []
      mushrooms = []
      grassBlades = []
      clouds = []
      effects = []
      particles = []
      width = 0
      height = 0
      hitState = null
    }
  }

  function _addEffect(type, start, durationMs, zone) {
    let slot = -1
    let oldestTime = Infinity
    for (let i = 0; i < effects.length; i++) {
      if (!effects[i].active) { slot = i; break }
      if (effects[i].start < oldestTime) { oldestTime = effects[i].start; slot = i }
    }
    const e = effects[slot]
    e.active = true
    e.type = type
    e.start = start
    e.durationMs = durationMs
    e.zone = zone
  }

  function _addParticle(x, y, vx, vy, start, durationMs, size, color) {
    let slot = -1
    let oldestTime = Infinity
    for (let i = 0; i < particles.length; i++) {
      if (!particles[i].active) { slot = i; break }
      if (particles[i].start < oldestTime) { oldestTime = particles[i].start; slot = i }
    }
    const p = particles[slot]
    p.active = true
    p.x = x
    p.y = y
    p.vx = vx
    p.vy = vy
    p.start = start
    p.durationMs = durationMs
    p.size = size
    p.color = color
  }
}

// Автоматическая регистрация при импорте модуля.
register('forest', 'Лес', createForestLocation)
