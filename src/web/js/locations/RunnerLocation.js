/**
 * RunnerLocation — side-scrolling rhythm runner со спрайтовым рендерингом.
 *
 * Герой — AnimatedSprite (дино), фон — TilingSprite с параллаксом,
 * земля — TilingSprite тайлов.
 * Реакция героя привязана только к ритм-событиям:
 * perfect/good→прыжок, miss→спотыкание.
 */

import { register } from './LocationRegistry.js'
import { getTextures, preloadAll } from './RunnerAssets.js'
import { DINO_PHRASES, pickPhraseWithoutImmediateRepeat } from '../DinoPhrases.js'

const MAX_PARTICLES = 20
const MAX_EFFECTS = 6

const JUMP_DURATION_MS = 500
const STUMBLE_DURATION_MS = 620
const PERFECT_JUMP_HEIGHT = 0.185
const GOOD_JUMP_HEIGHT = 0.11

const GRASS_TUFT_COUNT = 24
const CLOUD_COUNT = 5

// Runner bubble lives inside dense Pixi scene near the hero, so keep it longer.
const SPEECH_TTL_MS = 2200
const SPEECH_FADE_MS = 420
const SPEECH_COOLDOWN_MS = 420
const SPEECH_FADE_IN_MS = 180
const SPEECH_MIN_EVENTS = 2
const SPEECH_MAX_EVENTS = 5

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

function createRunnerLocation() {
  let container = null
  let width = 0
  let height = 0
  let minSide = 0

  let groundY = 0
  let charX = 0
  let scrollStep = 0

  // Container tree
  let bgContainer = null
  let groundContainer = null
  let heroContainer = null

  // Graphics layers (redrawn each frame)
  let skyGraphics = null
  let cloudsGraphics = null
  let groundOverlay = null
  let effectsGraphics = null
  let speechGraphics = null

  // Sprites
  let bgTiling = null
  let groundTiling = null
  let dirtTiling = null
  let heroSprite = null
  let heroShadow = null
  let speechText = null
  let speechTextStyle = null

  // State pools
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
  let speechMessage = ''
  let speechZone = 'good'
  let speechShownAt = 0
  let speechLastShownAt = 0
  let speechLastByGroup = { positive: '', miss: '' }
  let speechEventsUntilByGroup = { positive: 2, miss: 2 }

  return {
    init(pixiContainer, w, h) {
      container = pixiContainer
      width = w
      height = h
      minSide = Math.min(w, h)

      groundY = h * 0.75
      charX = w * 0.2
      scrollStep = w * 0.23

      const pixi = globalThis.PIXI
      const assets = getTextures()

      // --- Container tree ---
      bgContainer = new pixi.Container()
      groundContainer = new pixi.Container()
      heroContainer = new pixi.Container()

      container.addChild(bgContainer)
      container.addChild(groundContainer)
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

      speechGraphics = new pixi.Graphics()
      container.addChild(speechGraphics)

      speechTextStyle = new pixi.TextStyle({
        fontFamily: 'Nunito, Segoe UI, Arial, sans-serif',
        fontSize: Math.max(14, Math.min(18, Math.round(minSide * 0.03))),
        fontWeight: '900',
        fill: 0x161616,
        align: 'center',
        lineJoin: 'round'
      })
      speechText = new pixi.Text('', speechTextStyle)
      speechText.anchor.set(0.5, 0.5)
      speechText.visible = false
      container.addChild(speechText)

      _seedWorldDecor()
      _initPools()
      _resetState()

      // Preload assets in background
      preloadAll()
        .then(() => {
          _refreshTilingScales()
        })
        .catch(err => console.warn('[RunnerLocation] Asset preload failed:', err))
    },

    onBeat(phase, beatsFromStart = 0) {
      if (!container) return

      const now = performance.now()

      _updateCharacterState(now)

      const worldOffset = beatsFromStart * scrollStep

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

      // --- Update hero ---
      const pose = _computePose(now, phase)
      _updateHero(pose)

      // --- Effects & particles ---
      effectsGraphics.clear()
      _drawForegroundShade(effectsGraphics)
      _drawEffects(effectsGraphics, now, pose)
      _drawParticles(effectsGraphics, now)
      _drawSpeechBubble(speechGraphics, now, pose)
    },

    onHit(zone) {
      if (!container) return

      const now = performance.now()

      if (zone === 'perfect') {
        charState = 'jumping'
        charStateStart = now
        charJumpHeight = PERFECT_JUMP_HEIGHT

        _showSpeech('positive', 'perfect', now)
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

        _showSpeech('positive', 'good', now)
        _switchHeroAnimation('jump', false)
        _addEffect('ring', now, 340, 'good')
        _burstAroundHero(now, 6, minSide * 0.18, PALETTE.good)
        return
      }

      if (zone === 'miss') {
        _showSpeech('miss', 'miss', now)
        if (charState === 'stumbling') return
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
      if (speechGraphics) speechGraphics.destroy()
      if (speechText) speechText.destroy()

      if (bgContainer) bgContainer.destroy()
      if (groundContainer) groundContainer.destroy()
      if (heroContainer) heroContainer.destroy()

      container = null
      width = 0
      height = 0
      minSide = 0
      groundY = 0
      charX = 0
      scrollStep = 0

      bgContainer = null
      groundContainer = null
      heroContainer = null
      skyGraphics = null
      cloudsGraphics = null
      groundOverlay = null
      effectsGraphics = null
      speechGraphics = null
      bgTiling = null
      groundTiling = null
      dirtTiling = null
      heroSprite = null
      heroShadow = null
      speechText = null
      speechTextStyle = null

      particles = []
      effects = []
      grassTufts = []
      clouds = []

      _resetState()
    }
  }

  // ============ Internal functions ============

  function _seedWorldDecor() {
    grassTufts = []
    for (let i = 0; i < GRASS_TUFT_COUNT; i++) {
      grassTufts.push({
        offset: (i / GRASS_TUFT_COUNT) * scrollStep * 2.5,
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
    speechMessage = ''
    speechZone = 'good'
    speechShownAt = 0
    speechLastShownAt = 0
    speechLastByGroup = { positive: '', miss: '' }
    speechEventsUntilByGroup = {
      positive: _nextSpeechEventGap(),
      miss: _nextSpeechEventGap()
    }
  }

  function _nextSpeechEventGap() {
    const span = SPEECH_MAX_EVENTS - SPEECH_MIN_EVENTS + 1
    return SPEECH_MIN_EVENTS + Math.floor(Math.random() * span)
  }

  function _pickSpeech(group) {
    const list = DINO_PHRASES[group]
    if (!list || list.length === 0) return ''
    const next = pickPhraseWithoutImmediateRepeat(list, speechLastByGroup[group] || '')
    speechLastByGroup[group] = next
    return next
  }

  function _showSpeech(group, zone, now) {
    // In runner we intentionally show speech less frequently (every 2-5 events)
    // to avoid visual overload over fast jump/stumble feedback.
    const remaining = speechEventsUntilByGroup[group] ?? _nextSpeechEventGap()
    if (remaining > 1) {
      speechEventsUntilByGroup[group] = remaining - 1
      return
    }
    speechEventsUntilByGroup[group] = _nextSpeechEventGap()

    if (now - speechLastShownAt < SPEECH_COOLDOWN_MS) return
    const phrase = _pickSpeech(group)
    if (!phrase) return
    speechMessage = phrase
    speechZone = zone
    speechShownAt = now
    speechLastShownAt = now
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
      const x = ((c.x - beatsFromStart * scrollStep * c.speed) % (width + c.w * 2) + (width + c.w * 2)) % (width + c.w * 2) - c.w

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

    const worldOffset = beatsFromStart * scrollStep
    const tileWidth = scrollStep * 2.5

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

  function _drawSpeechBubble(g, now, pose) {
    if (!g || !speechText) return

    g.clear()

    const elapsed = now - speechShownAt
    if (!speechMessage || elapsed >= SPEECH_TTL_MS) {
      speechMessage = ''
      speechText.visible = false
      return
    }

    const fadeStart = SPEECH_TTL_MS - SPEECH_FADE_MS
    const fadeOutAlpha = elapsed > fadeStart
      ? Math.max(0, 1 - (elapsed - fadeStart) / SPEECH_FADE_MS)
      : 1
    const fadeInProgress = Math.min(1, elapsed / SPEECH_FADE_IN_MS)
    const fadeInAlpha = 1 - Math.pow(1 - fadeInProgress, 3)
    const alpha = fadeOutAlpha * fadeInAlpha
    const popScale = 0.9 + 0.1 * fadeInAlpha

    speechText.text = speechMessage
    speechText.alpha = alpha
    speechText.visible = true

    const bubbleW = Math.min(width * 0.37, Math.max(minSide * 0.19, speechText.width + minSide * 0.09))
    const bubbleH = Math.max(minSide * 0.085, speechText.height + minSide * 0.075)
    const radius = minSide * 0.018

    const rawX = pose.x + minSide * 0.26
    const bubbleX = Math.min(width - bubbleW * 0.5 - minSide * 0.02, Math.max(bubbleW * 0.5 + minSide * 0.02, rawX))
    const bubbleY = Math.max(minSide * 0.06 + bubbleH * 0.5, pose.y - minSide * 0.34 - bubbleH * 0.5)

    const isMiss = speechZone === 'miss'

    // Thought bubble: cloud-like contour + two small circles to the hero.
    const lobeScale = isMiss ? 1.12 : 1
    _drawCloudBubble(g, bubbleX, bubbleY, bubbleW * lobeScale * popScale, bubbleH * lobeScale * popScale, radius, alpha)

    // Keep a subtle "thought" trail without pointing directly at the hero.
    const c1x = bubbleX - bubbleW * 0.26
    const c1y = bubbleY + bubbleH * 0.55
    const c2x = c1x - minSide * 0.035
    const c2y = c1y + minSide * 0.042
    g.lineStyle(minSide * 0.005, 0x111111, 0.95 * alpha)
    g.beginFill(0xFFFFFF, 0.96 * alpha)
    g.drawCircle(c1x, c1y, minSide * 0.017)
    g.endFill()
    g.beginFill(0xFFFFFF, 0.96 * alpha)
    g.drawCircle(c2x, c2y, minSide * 0.011)
    g.endFill()
    g.lineStyle(0)

    speechText.style.fill = isMiss ? 0x5A1212 : 0x1B1B1B
    speechText.scale.set(0.93 + 0.07 * fadeInAlpha)
    speechText.x = bubbleX
    speechText.y = bubbleY
  }

  function _drawCloudBubble(g, cx, cy, w, h, radius, alpha) {
    const rx = w * 0.5
    const ry = h * 0.5
    const bumps = [1.05, 0.95, 1.08, 0.92, 1.06, 0.94, 1.03, 0.96, 1.04, 0.93]
    const points = []

    for (let i = 0; i < bumps.length; i++) {
      const a = (-Math.PI / 2) + (Math.PI * 2 * i / bumps.length)
      const br = bumps[i]
      points.push({
        x: cx + Math.cos(a) * rx * br,
        y: cy + Math.sin(a) * ry * br
      })
    }

    const firstMid = {
      x: (points[0].x + points[1].x) * 0.5,
      y: (points[0].y + points[1].y) * 0.5
    }

    g.lineStyle(Math.max(2, radius * 0.55), 0x111111, 0.96 * alpha)
    g.beginFill(0xFFFFFF, 0.97 * alpha)
    g.moveTo(firstMid.x, firstMid.y)
    for (let i = 0; i < points.length; i++) {
      const p = points[i]
      const n = points[(i + 1) % points.length]
      const midX = (p.x + n.x) * 0.5
      const midY = (p.y + n.y) * 0.5
      g.quadraticCurveTo(p.x, p.y, midX, midY)
    }
    g.closePath()
    g.endFill()
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
