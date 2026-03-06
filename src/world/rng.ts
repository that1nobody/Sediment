/**
 * Mulberry32 — fast, high-quality 32-bit seeded PRNG.
 * Returns a function that produces floats uniformly in [0, 1).
 */
export type RNG = () => number

export function mulberry32(seed: number): RNG {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6D2B79F5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Returns a 32-bit seed. Uses the provided value if given; otherwise
 * derives one from the current time mixed with Math.random() so that
 * two unseeded runs almost never produce the same world.
 */
export function makeSeed(userSeed?: number): number {
  return userSeed !== undefined
    ? (userSeed >>> 0)
    : ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0)
}
