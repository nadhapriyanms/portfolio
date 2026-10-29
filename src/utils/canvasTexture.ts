import * as THREE from 'three'

const cache = new Map<string, THREE.CanvasTexture>()

/**
 * Draws into a 2D canvas and wraps it as a texture. Cached by key so signs that share
 * artwork share GPU memory.
 */
export function canvasTexture(
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  opts: { repeat?: boolean } = {},
) {
  const hit = cache.get(key)
  if (hit) return hit
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  draw(ctx, width, height)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  if (opts.repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  cache.set(key, tex)
  return tex
}

export const fonts = {
  display: '"Big Shoulders Display", "Arial Narrow", sans-serif',
  body: '"IBM Plex Sans", system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, monospace',
  hand: '"Caveat", "Comic Sans MS", cursive',
}

/** Wraps text to a max width; returns the lines. */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

/** Deterministic PRNG so procedural worlds look identical on every visit. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** Remaps v from [a,b] to [0,1], clamped. */
export const range = (v: number, a: number, b: number) => clamp01((v - a) / (b - a))
export const smooth = (v: number) => v * v * (3 - 2 * v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
