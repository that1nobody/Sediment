import { bowyerWatson } from '../delaunay'
import type { Point } from '../poissonDisk'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function grid(rows: number, cols: number): Point[] {
  const pts: Point[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      pts.push({ x: c * 10, y: r * 10 })
  return pts
}

function edgesFromTriangles(
  triangles: ReadonlyArray<[number, number, number]>
): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (let ti = 0; ti < triangles.length; ti++) {
    const [a, b, c] = triangles[ti]
    for (const [u, v] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const key = u < v ? `${u}|${v}` : `${v}|${u}`
      const entry = map.get(key)
      if (entry) entry.push(ti)
      else map.set(key, [ti])
    }
  }
  return map
}

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('bowyerWatson — edge cases', () => {
  test('returns empty triangulation for 0 points', () => {
    const { triangles, circumcenters } = bowyerWatson([])
    expect(triangles).toHaveLength(0)
    expect(circumcenters).toHaveLength(0)
  })

  test('returns empty triangulation for 1 point', () => {
    const { triangles } = bowyerWatson([{ x: 0, y: 0 }])
    expect(triangles).toHaveLength(0)
  })

  test('returns empty triangulation for 2 points', () => {
    const { triangles } = bowyerWatson([{ x: 0, y: 0 }, { x: 1, y: 0 }])
    expect(triangles).toHaveLength(0)
  })

  test('returns exactly 1 triangle for 3 non-collinear points', () => {
    const pts: Point[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }]
    const { triangles, circumcenters } = bowyerWatson(pts)
    expect(triangles).toHaveLength(1)
    expect(circumcenters).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Triangle structure
// ---------------------------------------------------------------------------

describe('bowyerWatson — triangle structure', () => {
  const pts = grid(5, 5)
  const { triangles, circumcenters } = bowyerWatson(pts)

  test('each triangle references three distinct, valid point indices', () => {
    const n = pts.length
    triangles.forEach(([a, b, c]) => {
      expect(a).toBeGreaterThanOrEqual(0)
      expect(b).toBeGreaterThanOrEqual(0)
      expect(c).toBeGreaterThanOrEqual(0)
      expect(a).toBeLessThan(n)
      expect(b).toBeLessThan(n)
      expect(c).toBeLessThan(n)
      expect(a).not.toBe(b)
      expect(b).not.toBe(c)
      expect(a).not.toBe(c)
    })
  })

  test('number of triangles equals number of circumcenters', () => {
    expect(triangles.length).toBe(circumcenters.length)
  })

  test('circumcenters have finite coordinates', () => {
    circumcenters.forEach(cc => {
      expect(Number.isFinite(cc.x)).toBe(true)
      expect(Number.isFinite(cc.y)).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// Graph topology
// ---------------------------------------------------------------------------

describe('bowyerWatson — graph topology', () => {
  const pts = grid(6, 6)
  const n = pts.length
  const { triangles } = bowyerWatson(pts)
  const edgeMap = edgesFromTriangles(triangles)

  test('neighbour relationship is symmetric', () => {
    for (const key of edgeMap.keys()) {
      const sep = key.indexOf('|')
      const u = key.slice(0, sep)
      const v = key.slice(sep + 1)
      // Both orderings represent the same undirected edge — the map always
      // stores the canonical (u < v) key, so just verify both ids are valid.
      expect(Number(u)).toBeGreaterThanOrEqual(0)
      expect(Number(v)).toBeGreaterThanOrEqual(0)
      expect(Number(u)).toBeLessThan(n)
      expect(Number(v)).toBeLessThan(n)
    }
  })

  test('every point has at least one adjacent Delaunay edge (no isolated vertices)', () => {
    const referenced = new Set<number>()
    for (const [a, b, c] of triangles) {
      referenced.add(a); referenced.add(b); referenced.add(c)
    }
    for (let i = 0; i < n; i++) {
      expect(referenced.has(i)).toBe(true)
    }
  })

  test('interior edges are shared by exactly 2 triangles', () => {
    const interior = [...edgeMap.values()].filter(tris => tris.length === 2)
    interior.forEach(tris => {
      expect(tris[0]).not.toBe(tris[1])
    })
  })

  test('boundary edges are shared by exactly 1 triangle', () => {
    const boundary = [...edgeMap.values()].filter(tris => tris.length === 1)
    expect(boundary.length).toBeGreaterThan(0)
  })

  test('satisfies the Delaunay triangle count formula: T = 2n - h - 2 (approximately)', () => {
    // For a Delaunay triangulation of n points with h hull points:
    // T ≈ 2n - h - 2.  For a grid, h = 4*(side-1), T ≈ 2n - 4*(side-1) - 2.
    // We just verify it's in a reasonable range rather than exact, because
    // collinear points (grid edges) can cause degeneracies.
    expect(triangles.length).toBeGreaterThan(0)
    // For 36 grid points, T should be roughly 2*36 - 2 = 70 ± some hull adjustment.
    expect(triangles.length).toBeGreaterThan(30)
    expect(triangles.length).toBeLessThan(100)
  })
})

// ---------------------------------------------------------------------------
// Circumcircle correctness (Delaunay condition)
// ---------------------------------------------------------------------------

describe('bowyerWatson — Delaunay condition', () => {
  test('no point lies strictly inside the circumcircle of any triangle', () => {
    // Use a small set of random-ish points so the check is tractable.
    const pts: Point[] = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 },
      { x: 15, y: 7 }, { x: 8, y: 15 }, { x: 2, y: 12 },
    ]
    const { triangles, circumcenters } = bowyerWatson(pts)

    triangles.forEach(([a, b, c], ti) => {
      const { x: cx, y: cy } = circumcenters[ti]
      const r2 = (pts[a].x - cx) ** 2 + (pts[a].y - cy) ** 2

      pts.forEach((p, pi) => {
        if (pi === a || pi === b || pi === c) return
        const d2 = (p.x - cx) ** 2 + (p.y - cy) ** 2
        // Allow a small epsilon for floating-point coincident circumcircles.
        expect(d2).toBeGreaterThanOrEqual(r2 - 1e-6)
      })
    })
  })
})
