import { mulberry32, makeSeed } from '../rng'

describe('mulberry32', () => {
  test('produces values in [0, 1)', () => {
    const rng = mulberry32(42)
    for (let i = 0; i < 10000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  test('same seed produces identical sequence', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b())
    }
  })

  test('different seeds produce different sequences', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const same = Array.from({ length: 100 }, () => a() === b()).every(Boolean)
    expect(same).toBe(false)
  })

  test('mean of large sample is approximately 0.5', () => {
    const rng = mulberry32(999)
    let sum = 0
    const N = 100_000
    for (let i = 0; i < N; i++) sum += rng()
    const mean = sum / N
    expect(mean).toBeGreaterThan(0.49)
    expect(mean).toBeLessThan(0.51)
  })

  test('seed 0 is valid and produces a non-trivial sequence', () => {
    const rng = mulberry32(0)
    const values = Array.from({ length: 10 }, () => rng())
    const allZero = values.every(v => v === 0)
    expect(allZero).toBe(false)
  })
})

describe('makeSeed', () => {
  test('returns the provided seed unchanged (as unsigned 32-bit int)', () => {
    expect(makeSeed(42)).toBe(42)
    expect(makeSeed(0)).toBe(0)
  })

  test('returns a number when no seed is provided', () => {
    const s = makeSeed()
    expect(typeof s).toBe('number')
    expect(Number.isFinite(s)).toBe(true)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(0xffffffff)
  })

  test('two unseeded calls are very unlikely to produce the same value', () => {
    // There's a 1-in-4-billion chance this fails — acceptable.
    expect(makeSeed()).not.toBe(makeSeed())
  })
})
