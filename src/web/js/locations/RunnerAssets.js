/**
 * RunnerAssets — манифест и кэш текстур для RunnerLocation.
 *
 * Текстуры shared: живут в кэше модуля, не уничтожаются при stop/start.
 * clearCache() — только при полном уничтожении приложения.
 */

const BASE = 'assets/runner/'

const MANIFEST = {
  bg: `${BASE}backgrounds/bg.png`,
  groundTop: `${BASE}tileset/ground-top.png`,
  groundFill: `${BASE}tileset/ground-fill.png`,
  stone: `${BASE}obstacles/stone.png`,
  crate: `${BASE}obstacles/crate.png`,
  bush: `${BASE}obstacles/bush.png`,
  mushroom: `${BASE}obstacles/mushroom.png`
}

const CHAR_FRAMES = {
  run: 8,
  jump: 12,
  dead: 8,
  idle: 10
}

/** @type {object|null} */
let cache = null

function _buildCharPaths() {
  /** @type {Record<string, string[]>} */
  const paths = {}
  for (const [anim, count] of Object.entries(CHAR_FRAMES)) {
    paths[anim] = []
    for (let i = 1; i <= count; i++) {
      paths[anim].push(`${BASE}character/${anim}-${i}.png`)
    }
  }
  return paths
}

/**
 * Возвращает кэшированные текстуры (синхронно, если preload завершён).
 * До preload — Texture.from() создаёт текстуры с фоновой загрузкой.
 */
export function getTextures() {
  if (cache) return cache

  const pixi = globalThis.PIXI

  const textures = {}
  for (const [key, url] of Object.entries(MANIFEST)) {
    textures[key] = pixi.Texture.from(url)
  }

  const charPaths = _buildCharPaths()
  /** @type {Record<string, PIXI.Texture[]>} */
  const charTextures = {}
  for (const [anim, paths] of Object.entries(charPaths)) {
    charTextures[anim] = paths.map(p => pixi.Texture.from(p))
  }

  cache = { ...textures, charTextures }
  return cache
}

/**
 * Предзагрузка всех ассетов через PIXI.Assets.load().
 * @returns {Promise<void>}
 */
export async function preloadAll() {
  const pixi = globalThis.PIXI
  const charPaths = _buildCharPaths()
  const urls = [
    ...Object.values(MANIFEST),
    ...Object.values(charPaths).flat()
  ]

  await pixi.Assets.load(urls)
}

/** Очистка кэша — только при полном уничтожении приложения. */
export function clearCache() {
  cache = null
}
