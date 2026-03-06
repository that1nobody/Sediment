import { poissonDisk } from '../poissonDisk'
import { mulberry32 } from '../rng'

const rng = () => mulberry32(7)

describe('poissonDisk — output size', () => {
  test('returns 0 points when targetCount is 0', () => {
    expect(poissonDisk(1000, 800, 0, rng())).toHaveLength(0)
  })

  test('returns 1 point when targetCount is 1', () => {
    expect(poissonDisk(1000, 800, 1, rng())).toHaveLength(1)
  })

  test('returns approximately targetCount points (within factor of 2)', () => {
    const target = 200
    const pts = poissonDisk(1000, 800, target, rng())
    expect(pts.length).toBeGreaterThan(target * 0.5)
    expect(pts.length).toBeLessThan(target * 2)
  })
})

describe('poissonDisk — spatial constraints', () => {
  let pts: ReturnType<typeof poissonDisk>

  beforeAll(() => {
    pts = poissonDisk(1000, 800, 150, rng())
  })

  test('all points have x in [0, width)', () => {
    pts.forEach(p => {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThan(1000)
    })
  })

  test('all points have y in [0, height)', () => {
    pts.forEach(p => {
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThan(800)
    })
  })

  test('no two points are closer than the minimum separation', () => {
    // r = sqrt(width * height / targetCount) ≈ sqrt(1000*800/150) ≈ 73
    const r = Math.sqrt((1000 * 800) / 150)
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d2 = (pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2
        expect(d2).toBeGreaterThanOrEqual(r * r - 1e-6)
      }
    }
  })
})

describe('poissonDisk — determinism', () => {
  test('same seed produces identical point sets', () => {
    const a = poissonDisk(500, 400, 80, mulberry32(1234))
    const b = poissonDisk(500, 400, 80, mulberry32(1234))
    expect(a).toEqual(b)
  })

  test('different seeds produce different point sets', () => {
    const a = poissonDisk(500, 400, 80, mulberry32(1))
    const b = poissonDisk(500, 400, 80, mulberry32(2))
    expect(a).not.toEqual(b)
  })
})

describe('poissonDisk — non-square worlds', () => {
  test('works with a very wide world', () => {
    const pts = poissonDisk(5000, 100, 100, rng())
    pts.forEach(p => {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThan(5000)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThan(100)
    })
  })

  test('works with a very tall world', () => {
    const pts = poissonDisk(100, 5000, 100, rng())
    pts.forEach(p => {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThan(100)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThan(5000)
    })
  })
})
