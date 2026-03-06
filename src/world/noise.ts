/**
 * Seeded 2D gradient (Perlin-style) noise with fractional Brownian motion.
 *
 * Architecture:
 *   hashInt  — maps (seed, ix, iy) → deterministic unsigned int
 *   grad2    — dot product of the hashed gradient with the offset vector
 *   noise2   — single octave in [−1, 1] using quintic fade interpolation
 *   fBm      — layered octaves giving fractal detail
 */

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// 8 normalised gradient directions (same as classic Perlin 2-D table)
const GX = [ 1, -1,  1, -1,  1, -1,  0,  0]
const GY = [ 1,  1, -1, -1,  0,  0,  1, -1]

/** Wang-style integer hash of three 32-bit values → unsigned 32-bit int. */
function hashInt(seed: number, ix: number, iy: number): number {
  let h = (seed ^ Math.imul(ix, 0x4d34b89f) ^ Math.imul(iy, 0x7c3a91d3)) | 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) | 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) | 0
  return (h ^ (h >>> 16)) >>> 0
}

/** Quintic smoothstep (zero first and second derivative at 0 and 1). */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Dot product of the pseudo-random gradient at grid cell (ix, iy) with the
 *  offset from that grid corner to (x, y). */
function grad2(seed: number, ix: number, iy: number, x: number, y: number): number {
  const g = hashInt(seed, ix, iy) & 7
  return GX[g] * (x - ix) + GY[g] * (y - iy)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Single-octave gradient noise at (x, y).
 * Returns a value in approximately [−1, 1].
 *
 * @param seed  Determines the gradient field; different seeds give unrelated fields.
 */
export function noise2(seed: number, x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix,        fy = y - iy
  const ux = fade(fx),      uy = fade(fy)

  const n00 = grad2(seed, ix,     iy,     x, y)
  const n10 = grad2(seed, ix + 1, iy,     x, y)
  const n01 = grad2(seed, ix,     iy + 1, x, y)
  const n11 = grad2(seed, ix + 1, iy + 1, x, y)

  return lerp(lerp(n00, n10, ux), lerp(n01, n11, ux), uy)
}

/**
 * Fractional Brownian motion — sums `octaves` noise layers, each doubling in
 * frequency and halving in amplitude.
 *
 * Returns a value in approximately [−1, 1]; normalise to [0, 1] as needed.
 *
 * @param seed       Seed forwarded to each octave (offset per octave to avoid correlation).
 * @param x, y       Sampling coordinates.
 * @param octaves    Number of detail layers (default 6).
 * @param lacunarity Frequency multiplier per octave (default 2.0).
 * @param gain       Amplitude multiplier per octave (default 0.5).
 */
export function fBm(
  seed: number,
  x: number,
  y: number,
  octaves = 6,
  lacunarity = 2.0,
  gain = 0.5
): number {
  let value = 0
  let amplitude = 1
  let frequency = 1
  let norm = 0

  for (let oct = 0; oct < octaves; oct++) {
    // Offset the seed per octave so layers are decorrelated.
    value += noise2(seed + oct * 1_000_003, x * frequency, y * frequency) * amplitude
    norm += amplitude
    amplitude *= gain
    frequency *= lacunarity
  }

  return value / norm
}
