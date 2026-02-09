/**
 * RunnerLocation — side-scrolling rhythm runner со спрайтовым рендерингом.
 *
 * Герой — AnimatedSprite (дино), фон — TilingSprite с параллаксом,
 * земля — TilingSprite тайлов, препятствия — Sprite пул.
 * Игровая логика идентична процедурной версии: perfect→прыжок, miss→спотыкание,
 * auto-stumble при пропущенном бите.
 */

import { register } from './LocationRegistry.js'
import { getTextures, preloadAll } from './RunnerAssets.js'

const LEAD_IN_BEATS = 3
const MAX_OBSTACLES = 10
const MAX_PARTICLES = 20
const MAX_EFFECTS = 6

const JUMP_DURATION_MS = 500
const STUMBLE_DURATION_MS = 620
const PERFECT_JUMP_HEIGHT = 0.185
const GOOD_JUMP_HEIGHT = 0.11

const GRASS_TUFT_COUNT = 24
const CLOUD_COUNT = 5

const PALETTE = {
  skyTop: 0x87D8FF,
  skyMid: 0xBCEBFF,
  skyWarm: 0xFCE8BE,
  sunCore: 0xFFE36B,
  sunGlow: 0xFFF3B0,

  groundTop: 0x78BC4A,
  groundMain: 0x57963F,
  groundDark: 0x3D6F2C,
  dirt: 0x8E6541,

  perfect: 0x43D66E,
  good: 0xFFC94D,
  miss: 0xF06B6B,
  dust: 0x9A7A5D
}

/** Маппинг type → текстура-ключ, targetH-множитель. */
const OBSTACLE_MAP = [
  { key: 'stone', targetMul: 0.06 },
  { key: 'crate', targetMul: 0.08 },
  { key: 'bush', targetMul: 0.07 },
  { key: 'mushroom', targetMul: 0.07 }
]

function createRunnerLocation() {
  let container = null
  let width = 0
  let height = 0
  let minSide = 0

  let groundY = 0
  let charX = 0
  let obstacleSpacing = 0

  // Container tree
  let bgContainer = null
  let groundContainer = null
  let obstacleContainer = null
  let heroContainer = null

  // Graphics layers (redrawn each frame)
  let skyGraphics = null
  let cloudsGraphics = null
  let groundOverlay = null
  let effectsGraphics = null

  // Sprites
  let bgTiling = null
  let groundTiling = null
  let dirtTiling = null
  let heroSprite = null
  let heroShadow = null

  // Obstacle sprite pool
  let obstacleSprites = []
  let obstacleShadows = []

  // State pools
  let obstacles = []
  let particles = []
  let effects = []

  // Decor data
  let grassTufts = []
  let clouds = []

  // Character state machine
  let charState = 'running'
  let charStateStart = 0
  let charJumpHeight = 0
  let currentAnim = 'run'

  let prevBeatCount = -1
  let hitThisBeat = false

  // Asset readiness
  let assetsReady = false

  return {
    init(pixiContainer, w, h) {
      container = pixiContainer
      width = w
      height = h
      minSide = Math.min(w, h)

      groundY = h * 0.75
      charX = w * 0.2
      obstacleSpacing = w * 0.23

      const pixi = globalThis.PIXI
      const assets = getTextures()

      // --- Container tree ---
      bgContainer = new pixi.Container()
      groundContainer = new pixi.Container()
      obstacleContainer = new pixi.Container()
      heroContainer = new pixi.Container()

      container.addChild(bgContainer)
      container.addChild(groundContainer)
      container.addChild(obstacleContainer)
      container.addChild(heroContainer)

      // --- Sky (Graphics — gradient + sun) ---
      skyGraphics = new pixi.Graphics()
      bgContainer.addChild(skyGraphics)

      // --- BG TilingSprite (parallax 0.1x) ---
      // BG.png (1000x750) covers full sky area. Sky gradient shows through via alpha.
      bgTiling = new pixi.TilingSprite(assets.bg, w, groundY)
      const bgTexH = _getTextureHeight(assets.bg, 750)
      const bgScale = groundY / bgTexH
      bgTiling.tileScale.set(bgScale, bgScale)
      bgTiling.alpha = 0.85
      bgContainer.addChild(bgTiling)

      // --- Clouds (Graphics) ---
      cloudsGraphics = new pixi.Graphics()
      bgContainer.addChild(cloudsGraphics)

      // --- Ground TilingSprite ---
      const groundH = h - groundY
      groundTiling = new pixi.TilingSprite(assets.groundTop, w, 128)
      groundTiling.y = groundY
      const groundTexH = _getTextureHeight(assets.groundTop, 128)
      const groundScale = (minSide * 0.12) / groundTexH
      groundTiling.tileScale.set(groundScale, groundScale)
      groundTiling.height = minSide * 0.06
      groundContainer.addChild(groundTiling)

      // --- Dirt fill TilingSprite ---
      dirtTiling = new pixi.TilingSprite(assets.groundFill, w, groundH)
      dirtTiling.y = groundY + minSide * 0.06
      const dirtTexH = _getTextureHeight(assets.groundFill, 128)
      const dirtScale = (minSide * 0.12) / dirtTexH
      dirtTiling.tileScale.set(dirtScale, dirtScale)
      dirtTiling.height = groundH - minSide * 0.06
      groundContainer.addChild(dirtTiling)

      // --- Grass overlay (Graphics) ---
      groundOverlay = new pixi.Graphics()
      groundContainer.addChild(groundOverlay)

      // --- Obstacle sprite pool ---
      obstacleSprites = []
      obstacleShadows = []
      for (let i = 0; i < MAX_OBSTACLES; i++) {
        const shadow = new pixi.Graphics()
        shadow.visible = false
        obstacleContainer.addChild(shadow)
        obstacleShadows.push(shadow)

        const sprite = new pixi.Sprite()
        sprite.anchor.set(0.5, 1.0)
        sprite.visible = false
        obstacleContainer.addChild(sprite)
        obstacleSprites.push(sprite)
      }

      // --- Hero shadow ---
      heroShadow = new pixi.Graphics()
      heroContainer.addChild(heroShadow)

      // --- Hero AnimatedSprite ---
      heroSprite = new pixi.AnimatedSprite(assets.charTextures.run)
      heroSprite.anchor.set(0.5, 1.0)
      const heroTargetH = minSide * 0.22
      const heroScale = heroTargetH / 472
      heroSprite.scale.set(heroScale, heroScale)
      heroSprite.animationSpeed = 0.2
      heroSprite.play()
      heroSprite.x = charX
      heroSprite.y = groundY
      heroContainer.addChild(heroSprite)
      currentAnim = 'run'

      // --- Effects (Graphics) ---
      effectsGraphics = new pixi.Graphics()
      container.addChild(effectsGraphics)

      _seedWorldDecor()
      _initPools()
      _resetState()

      // Preload assets in background
      preloadAll()
        .then(() => {
          assetsReady = true
          _refreshTilingScales()
        })
        .catch(err => console.warn('[RunnerLocation] Asset preload failed:', err))
    },

    onBeat(phase, beatsFromStart = 0) {
      if (!container) return

      const now = performance.now()
      const beatCount = Math.floor(beatsFromStart)

      // Auto-stumble logic
      if (beatCount > prevBeatCount && prevBeatCount >= 0) {
        if (!hitThisBeat && beatCount > LEAD_IN_BEATS && charState === 'running') {
          _startStumble(now)
        }
        hitThisBeat = false
      }
      prevBeatCount = beatCount

      _updateCharacterState(now)

      const worldOffset = beatsFromStart * obstacleSpacing

      // --- Update TilingSprites (no clear/redraw needed) ---
      if (bgTiling) {
        bgTiling.tilePosition.x = -worldOffset * 0.1
      }
      if (groundTiling) {
        groundTiling.tilePosition.x = -worldOffset
      }
      if (dirtTiling) {
        dirtTiling.tilePosition.x = -worldOffset
      }

      // --- Redraw Graphics layers ---
      _drawSky(skyGraphics, phase)
      _drawClouds(cloudsGraphics, beatsFromStart)
      _drawGrassOverlay(groundOverlay, beatsFromStart)

      // --- Update obstacles ---
      _updateObstacles(beatsFromStart)

      // --- Update hero ---
      const pose = _computePose(now, phase)
      _updateHero(pose)

      // --- Effects & particles ---
      effectsGraphics.clear()
      _drawForegroundShade(effectsGraphics)
      _drawEffects(effectsGraphics, now, pose)
      _drawParticles(effectsGraphics, now)
    },

    onHit(zone) {
      if (!container) return

      const now = performance.now()
      hitThisBeat = true

      if (charState !== 'running') return

      if (zone === 'perfect') {
        charState = 'jumping'
        charStateStart = now
        charJumpHeight = PERFECT_JUMP_HEIGHT

        _switchHeroAnimation('jump', false)
        _addEffect('ring', now, 460, 'perfect')
        _addEffect('trail', now, 220, 'perfect')
        _burstAroundHero(now, 10, minSide * 0.26, PALETTE.perfect)
        return
      }

      if (zone === 'good') {
        charState = 'jumping'
        charStateStart = now
        charJumpHeight = GOOD_JUMP_HEIGHT

        _switchHeroAnimation('jump', false)
        _addEffect('ring', now, 340, 'good')
        _burstAroundHero(now, 6, minSide * 0.18, PALETTE.good)
        return
      }

      if (zone === 'miss') {
        _startStumble(now)
      }
    },

    destroy() {
      const destroyOpts = { texture: false, baseTexture: false }

      if (heroSprite) {
        heroSprite.stop()
        heroSprite.destroy(destroyOpts)
      }
      if (heroShadow) heroShadow.destroy()
      if (bgTiling) bgTiling.destroy(destroyOpts)
      if (groundTiling) groundTiling.destroy(destroyOpts)
      if (dirtTiling) dirtTiling.destroy(destroyOpts)
      if (skyGraphics) skyGraphics.destroy()
      if (cloudsGraphics) cloudsGraphics.destroy()
      if (groundOverlay) groundOverlay.destroy()
      if (effectsGraphics) effectsGraphics.destroy()

      for (let i = 0; i < obstacleSprites.length; i++) {
        obstacleSprites[i].destroy(destroyOpts)
        obstacleShadows[i].destroy()
      }

      if (bgContainer) bgContainer.destroy()
      if (groundContainer) groundContainer.destroy()
      if (obstacleContainer) obstacleContainer.destroy()
      if (heroContainer) heroContainer.destroy()

      container = null
      width = 0
      height = 0
      minSide = 0
      groundY = 0
      charX = 0
      obstacleSpacing = 0

      bgContainer = null
      groundContainer = null
      obstacleContainer = null
      heroContainer = null
      skyGraphics = null
      cloudsGraphics = null
      groundOverlay = null
      effectsGraphics = null
      bgTiling = null
      groundTiling = null
      dirtTiling = null
      heroSprite = null
      heroShadow = null
      obstacleSprites = []
      obstacleShadows = []

      obstacles = []
      particles = []
      effects = []
      grassTufts = []
      clouds = []

      assetsReady = false
      _resetState()
    }
  }

  // ============ Internal functions ============

  function _seedWorldDecor() {
    grassTufts = []
    for (let i = 0; i < GRASS_TUFT_COUNT; i++) {
      grassTufts.push({
        offset: (i / GRASS_TUFT_COUNT) * obstacleSpacing * 2.5,
        h: minSide * (0.018 + (i % 4) * 0.007),
        lean: (i % 2 === 0 ? 1 : -1) * minSide * 0.006,
        alpha: 0.55 + (i % 3) * 0.12
      })
    }

    clouds = []
    for (let i = 0; i < CLOUD_COUNT; i++) {
      clouds.push({
        x: width * (i / CLOUD_COUNT),
        y: height * (0.12 + (i % 3) * 0.055),
        w: minSide * (0.12 + (i % 2) * 0.05),
        h: minSide * (0.05 + (i % 3) * 0.012),
        speed: 0.08 + (i % 4) * 0.03,
        alpha: 0.45 + (i % 2) * 0.18
      })
    }
  }

  function _getTextureHeight(texture, fallback) {
    const origHeight = texture && texture.orig && Number.isFinite(texture.orig.height)
      ? texture.orig.height
      : 0
    if (origHeight > 1) return origHeight

    const height = texture && Number.isFinite(texture.height) ? texture.height : 0
    if (height > 1) return height

    return fallback
  }

  function _refreshTilingScales() {
    if (!bgTiling || !groundTiling || !dirtTiling) return
    const assets = getTextures()

    const bgTexH = _getTextureHeight(assets.bg, 750)
    bgTiling.tileScale.set(groundY / bgTexH, groundY / bgTexH)

    const groundTexH = _getTextureHeight(assets.groundTop, 128)
    const groundScale = (minSide * 0.12) / groundTexH
    groundTiling.tileScale.set(groundScale, groundScale)

    const dirtTexH = _getTextureHeight(assets.groundFill, 128)
    const dirtScale = (minSide * 0.12) / dirtTexH
    dirtTiling.tileScale.set(dirtScale, dirtScale)
  }

  function _initPools() {
    obstacles = []
    for (let i = 0; i < MAX_OBSTACLES; i++) {
      obstacles.push({ active: false, beatIndex: 0, type: 0 })
    }

    particles = []
    for (let i = 0; i < MAX_PARTICLES; i++) {
      particles.push({
        active: false,
        x: 0, y: 0, vx: 0, vy: 0,
        start: 0, durationMs: 0, size: 0, color: 0
      })
    }

    effects = []
    for (let i = 0; i < MAX_EFFECTS; i++) {
      effects.push({ active: false, type: '', start: 0, durationMs: 0, zone: '' })
    }
  }

  function _resetState() {
    charState = 'running'
    charStateStart = 0
    charJumpHeight = 0
    currentAnim = 'run'
    prevBeatCount = -1
    hitThisBeat = false
  }

  function _startStumble(now) {
    charState = 'stumbling'
    charStateStart = now
    _switchHeroAnimation('dead', false)
    _addEffect('shake', now, 300, 'miss')
    _burstDust(now)
  }

  function _updateCharacterState(now) {
    if (charState === 'jumping' && now - charStateStart >= JUMP_DURATION_MS) {
      charState = 'running'
      _switchHeroAnimation('run', true)
      return
    }

    if (charState === 'stumbling' && now - charStateStart >= STUMBLE_DURATION_MS) {
      charState = 'running'
      _switchHeroAnimation('run', true)
    }
  }

  function _switchHeroAnimation(animName, loop) {
    if (!heroSprite || currentAnim === animName) return

    const assets = getTextures()
    const textures = assets.charTextures[animName]
    if (!textures) return

    currentAnim = animName
    heroSprite.textures = textures
    heroSprite.loop = loop
    heroSprite.gotoAndPlay(0)
  }

  function _computePose(now, phase) {
    let y = groundY
    let tilt = 0
    let scaleX = 1

    if (charState === 'jumping') {
      const t = Math.min((now - charStateStart) / JUMP_DURATION_MS, 1)
      const arc = 4 * t * (1 - t)
      y = groundY - arc * charJumpHeight * height
    } else if (charState === 'stumbling') {
      const t = Math.min((now - charStateStart) / STUMBLE_DURATION_MS, 1)
      if (t < 0.38) {
        tilt = (t / 0.38) * 0.28
      } else if (t < 0.72) {
        tilt = 0.28
      } else {
        tilt = 0.28 * (1 - (t - 0.72) / 0.28)
      }
    }

    // Running bob for hero scale (subtle)
    if (charState === 'running') {
      const bob = Math.sin(phase * Math.PI * 2) * 0.02
      scaleX = 1 + bob
    }

    return { x: charX, y, tilt, scaleX }
  }

  function _updateHero(pose) {
    if (!heroSprite) return

    heroSprite.x = pose.x
    heroSprite.y = pose.y
    heroSprite.rotation = pose.tilt

    const heroTargetH = minSide * 0.22
    const baseScale = heroTargetH / 472
    heroSprite.scale.set(baseScale * pose.scaleX, baseScale)

    // Shadow
    if (heroShadow) {
      heroShadow.clear()
      const shadowScale = charState === 'jumping'
        ? 0.6 + 0.4 * (pose.y / groundY)
        : 1
      const r = minSide * 0.04 * shadowScale
      heroShadow.beginFill(0x000000, 0.18)
      heroShadow.drawEllipse(pose.x, groundY + r * 0.22, r * 1.45, r * 0.45)
      heroShadow.endFill()
    }
  }

  function _updateObstacles(beatsFromStart) {
    const assets = getTextures()
    const firstVisible = Math.floor(beatsFromStart - 1)
    const lastVisible = Math.ceil(beatsFromStart + width / obstacleSpacing + 2)

    let poolIdx = 0
    for (let bi = Math.max(LEAD_IN_BEATS + 1, firstVisible); bi <= lastVisible && poolIdx < MAX_OBSTACLES; bi++) {
      const x = charX + (bi - beatsFromStart) * obstacleSpacing
      if (x < -minSide * 0.12 || x > width + minSide * 0.12) continue

      const obs = obstacles[poolIdx]
      obs.active = true
      obs.beatIndex = bi
      obs.type = (bi * 7 + 3) % 4

      const mapping = OBSTACLE_MAP[obs.type]
      const sprite = obstacleSprites[poolIdx]
      const shadow = obstacleShadows[poolIdx]
      const tex = assets[mapping.key]

      sprite.texture = tex
      const targetH = minSide * mapping.targetMul
      const texH = tex.height || 64
      const scale = targetH / texH
      sprite.scale.set(scale, scale)
      sprite.x = x
      sprite.y = groundY
      sprite.visible = true

      // Shadow
      shadow.clear()
      shadow.beginFill(0x000000, 0.18)
      const sr = minSide * 0.04
      shadow.drawEllipse(x, groundY + sr * 0.22, sr * 1.3, sr * 0.4)
      shadow.endFill()
      shadow.visible = true

      poolIdx++
    }

    // Hide unused pool entries
    for (let i = poolIdx; i < MAX_OBSTACLES; i++) {
      obstacles[i].active = false
      obstacleSprites[i].visible = false
      obstacleShadows[i].visible = false
    }
  }

  // ============ Graphics draw functions ============

  function _drawSky(g, phase) {
    if (!g) return
    g.clear()

    const skyH = groundY
    const bands = [
      PALETTE.skyTop, 0x95DEFF, 0xA8E5FF,
      PALETTE.skyMid, 0xD5F4FF, PALETTE.skyWarm
    ]

    const bandH = skyH / bands.length
    for (let i = 0; i < bands.length; i++) {
      g.beginFill(bands[i])
      g.drawRect(0, i * bandH, width, bandH + 1)
      g.endFill()
    }

    // Beat pulse overlay
    const pulse = (Math.cos(phase * Math.PI * 2) + 1) * 0.5
    g.beginFill(0xFFFFFF, 0.05 + pulse * 0.06)
    g.drawRect(0, 0, width, skyH)
    g.endFill()

    // Sun
    const sunX = width * 0.83
    const sunY = height * 0.16
    const r = minSide * 0.07

    g.beginFill(PALETTE.sunGlow, 0.18 + pulse * 0.1)
    g.drawCircle(sunX, sunY, r * 2.4)
    g.endFill()

    g.beginFill(PALETTE.sunGlow, 0.3 + pulse * 0.08)
    g.drawCircle(sunX, sunY, r * 1.55)
    g.endFill()

    g.beginFill(PALETTE.sunCore)
    g.drawCircle(sunX, sunY, r)
    g.endFill()

    g.lineStyle(minSide * 0.003, 0xFFF4C2, 0.75)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + phase * 0.4
      const r0 = r * 1.2
      const r1 = r * (1.7 + pulse * 0.2)
      g.moveTo(sunX + Math.cos(a) * r0, sunY + Math.sin(a) * r0)
      g.lineTo(sunX + Math.cos(a) * r1, sunY + Math.sin(a) * r1)
    }
    g.lineStyle(0)
  }

  function _drawClouds(g, beatsFromStart) {
    if (!g) return
    g.clear()

    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i]
      const x = ((c.x - beatsFromStart * obstacleSpacing * c.speed) % (width + c.w * 2) + (width + c.w * 2)) % (width + c.w * 2) - c.w

      g.beginFill(0xFFFFFF, c.alpha)
      g.drawEllipse(x, c.y, c.w, c.h)
      g.drawEllipse(x - c.w * 0.45, c.y + c.h * 0.15, c.w * 0.65, c.h * 0.75)
      g.drawEllipse(x + c.w * 0.45, c.y + c.h * 0.1, c.w * 0.62, c.h * 0.72)
      g.endFill()
    }
  }

  function _drawGrassOverlay(g, beatsFromStart) {
    if (!g) return
    g.clear()

    const worldOffset = beatsFromStart * obstacleSpacing
    const tileWidth = obstacleSpacing * 2.5

    for (let i = 0; i < grassTufts.length; i++) {
      const tuft = grassTufts[i]
      let x = tuft.offset - (worldOffset % tileWidth)
      if (x < -minSide * 0.06) x += tileWidth
      if (x > width + minSide * 0.06) continue

      const tipX = x + tuft.lean
      const tipY = groundY - tuft.h
      g.lineStyle(minSide * 0.0028, PALETTE.groundTop, tuft.alpha)
      g.moveTo(x, groundY)
      g.bezierCurveTo(
        x + tuft.lean * 0.3,
        groundY - tuft.h * 0.45,
        tipX,
        groundY - tuft.h * 0.8,
        tipX,
        tipY
      )
    }
    g.lineStyle(0)
  }

  function _drawEffects(g, now, pose) {
    for (let i = 0; i < effects.length; i++) {
      const e = effects[i]
      if (!e.active) continue

      const elapsed = now - e.start
      if (elapsed >= e.durationMs) {
        e.active = false
        continue
      }

      const p = elapsed / e.durationMs
      const fade = 1 - p

      if (e.type === 'ring') {
        const color = e.zone === 'perfect' ? PALETTE.perfect : PALETTE.good
        g.lineStyle(minSide * 0.009 * fade, color, 0.65 * fade)
        g.drawCircle(pose.x, pose.y - minSide * 0.06, minSide * (0.08 + p * 0.14))
        g.lineStyle(0)
      } else if (e.type === 'trail') {
        g.beginFill(PALETTE.perfect, 0.18 * fade)
        g.drawEllipse(pose.x - minSide * 0.028, pose.y + minSide * 0.015, minSide * (0.04 + p * 0.02), minSide * 0.018)
        g.drawEllipse(pose.x + minSide * 0.028, pose.y + minSide * 0.015, minSide * (0.04 + p * 0.02), minSide * 0.018)
        g.endFill()
      } else if (e.type === 'shake') {
        g.beginFill(PALETTE.miss, 0.09 * fade)
        g.drawRect(0, 0, width, height)
        g.endFill()
      }
    }
  }

  function _drawParticles(g, now) {
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      if (!p.active) continue

      const elapsed = now - p.start
      if (elapsed >= p.durationMs) {
        p.active = false
        continue
      }

      const t = elapsed / p.durationMs
      const fade = 1 - t
      const eased = 1 - (1 - t) * (1 - t)
      const x = p.x + p.vx * eased
      const y = p.y + p.vy * eased + t * t * minSide * 0.03

      g.beginFill(p.color, 0.18 * fade)
      g.drawCircle(x, y, p.size * (1.8 * fade + 0.2))
      g.endFill()

      g.beginFill(p.color, 0.92 * fade)
      g.drawCircle(x, y, p.size * (0.6 + 0.4 * fade))
      g.endFill()
    }
  }

  function _drawForegroundShade(g) {
    g.beginFill(0x000000, 0.06)
    g.drawRect(0, groundY + minSide * 0.095, width, height - groundY)
    g.endFill()
  }

  // ============ Particles / Effects helpers ============

  function _burstAroundHero(now, count, speed, color) {
    const originX = charX
    const originY = groundY - height * 0.07

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.35
      _addParticle(originX, originY, Math.cos(a) * speed, Math.sin(a) * speed, now, 420, minSide * 0.009, color)
    }
  }

  function _burstDust(now) {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.62 + (i / 7) * Math.PI * 0.76
      _addParticle(
        charX + minSide * 0.02, groundY,
        Math.cos(a) * minSide * 0.12,
        Math.sin(a) * minSide * 0.08 - minSide * 0.03,
        now, 430, minSide * 0.0085, PALETTE.dust
      )
    }
  }

  function _addEffect(type, start, durationMs, zone) {
    let slot = -1
    let oldestTime = Infinity

    for (let i = 0; i < effects.length; i++) {
      if (!effects[i].active) { slot = i; break }
      if (effects[i].start < oldestTime) { oldestTime = effects[i].start; slot = i }
    }

    if (slot < 0) return

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

    if (slot < 0) return

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

register('runner', 'Бегун', createRunnerLocation)
