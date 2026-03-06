import { noise2, fBm } from '../noise'

// ---------------------------------------------------------------------------
// noise2 — single octave
// ---------------------------------------------------------------------------

describe('noise2 — output range', () => {
  test('values are in approximately [-1, 1] over a dense grid', () => {
    for (let x = 0; x < 10; x += 0.1) {
      for (let y = 0; y < 10; y += 0.1) {
        const v = noise2(42, x, y)
        expect(v).toBeGreaterThanOrEqual(-1.5)
        expect(v).toBeLessThanOrEqual(1.5)
      }
    }
  })

  test('returns 0 at integer grid corners (Perlin property)', () => {
    // Gradient noise is exactly 0 where the offset vector is (0,0).
    for (let ix = 0; ix < 5; ix++) {
      for (let iy = 0; iy < 5; iy++) {
        expect(noise2(99, ix, iy)).toBeCloseTo(0, 10)
      }
    }
  })
})

describe('noise2 — determinism', () => {
  test('same seed and coordinates always produce the same value', () => {
    expect(noise2(1, 1.5, 2.3)).toBe(noise2(1, 1.5, 2.3))
    expect(noise2(0, 0.1, 0.9)).toBe(noise2(0, 0.1, 0.9))
  })

  test('different seeds produce different values at the same coordinate', () => {
    const a = noise2(1, 3.7, 2.1)
    const b = noise2(2, 3.7, 2.1)
    expect(a).not.toBeCloseTo(b, 5)
  })
})

describe('noise2 — continuity', () => {
  test('nearby points produce nearby values (no discontinuous jumps)', () => {
    const base = noise2(7, 2.0, 3.0)
    const nearby = noise2(7, 2.001, 3.001)
    expect(Math.abs(nearby - base)).toBeLessThan(0.05)
  })
})

// ---------------------------------------------------------------------------
// fBm — fractional Brownian motion
// ---------------------------------------------------------------------------

describe('fBm — output range', () => {
  test('values are bounded within [-1, 1] over a large sample', () => {
    for (let x = 0; x < 10; x += 0.07) {
      for (let y = 0; y < 10; y += 0.07) {
        const v = fBm(13, x, y)
        expect(v).toBeGreaterThanOrEqual(-1)
        expect(v).toBeLessThanOrEqual(1)
      }
    }
  })

  test('mean over a large sample is approximately 0', () => {
    let sum = 0, n = 0
    for (let x = 0; x < 20; x += 0.1) {
      for (let y = 0; y < 20; y += 0.1) {
        sum += fBm(17, x, y)
        n++
      }
    }
    expect(sum / n).toBeGreaterThan(-0.15)
    expect(sum / n).toBeLessThan(0.15)
  })
})

describe('fBm — determinism', () => {
  test('same arguments always return the same value', () => {
    expect(fBm(42, 1.0, 2.0, 6)).toBe(fBm(42, 1.0, 2.0, 6))
  })

  test('different seeds produce different outputs', () => {
    // Avoid integer grid points — gradient noise is exactly 0 there by construction.
    expect(fBm(1, 5.37, 2.81)).not.toBeCloseTo(fBm(2, 5.37, 2.81), 5)
  })
})

describe('fBm — parameters', () => {
  test('1 octave equals single noise2 call (normalised by amplitude sum of 1)', () => {
    const x = 1.3, y = 2.7
    // With 1 octave, lacunarity and gain don't matter; fBm = noise2 / 1.
    expect(fBm(5, x, y, 1)).toBeCloseTo(noise2(5, x, y), 10)
  })

  test('more octaves produce different output than fewer (detail changes the field)', () => {
    // fBm with normalization keeps total variance roughly constant, but the
    // spatial frequency content differs: each additional octave shifts values
    // at non-integer sampling points.  Verify the outputs are actually different.
    const samples = [
      [1.3, 2.7], [0.5, 3.1], [4.2, 0.8], [2.9, 4.4], [3.7, 1.6],
    ] as [number, number][]
    const anyDiffer = samples.some(([x, y]) => fBm(3, x, y, 6) !== fBm(3, x, y, 1))
    expect(anyDiffer).toBe(true)
  })

  test('lacunarity 1 (no frequency increase) produces smoother output than lacunarity 2', () => {
    function maxAbsDiff(lacunarity: number): number {
      let max = 0
      for (let x = 0; x < 5; x += 0.5) {
        const a = fBm(9, x, 2.5, 4, lacunarity)
        const b = fBm(9, x + 0.1, 2.5, 4, lacunarity)
        max = Math.max(max, Math.abs(b - a))
      }
      return max
    }
    expect(maxAbsDiff(1)).toBeLessThan(maxAbsDiff(2))
  })
})
