import type { Point } from './poissonDisk'

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface Triangle {
  a: number; b: number; c: number
  cx: number; cy: number; r2: number // circumcircle centre and radius²
}

// ---------------------------------------------------------------------------
// Public output
// ---------------------------------------------------------------------------

export interface Triangulation {
  /** Indices into the original points array, one triple per Delaunay triangle. */
  triangles: ReadonlyArray<[number, number, number]>
  /**
   * Circumcenter of each triangle.  These are the vertices of the Voronoi
   * diagram dual to the Delaunay triangulation — one per triangle.
   * Note: circumcenters may lie outside the world bounds for triangles on
   * the convex hull; callers should clip as needed.
   */
  circumcenters: ReadonlyArray<Point>
}

// ---------------------------------------------------------------------------
// Bowyer-Watson incremental Delaunay triangulation
// ---------------------------------------------------------------------------

function circumcircle(
  pts: Point[],
  a: number,
  b: number,
  c: number
): { cx: number; cy: number; r2: number } {
  // Translate so C is at the origin to improve numerical stability.
  const ax = pts[a].x - pts[c].x, ay = pts[a].y - pts[c].y
  const bx = pts[b].x - pts[c].x, by = pts[b].y - pts[c].y
  const D = 2 * (ax * by - ay * bx)
  if (Math.abs(D) < 1e-10) {
    // Degenerate (collinear) — circumcircle is infinite; treat as always bad.
    return { cx: 0, cy: 0, r2: Number.MAX_VALUE }
  }
  const ma = ax * ax + ay * ay
  const mb = bx * bx + by * by
  const cx = pts[c].x + (by * ma - ay * mb) / D
  const cy = pts[c].y + (ax * mb - bx * ma) / D
  return { cx, cy, r2: (pts[a].x - cx) ** 2 + (pts[a].y - cy) ** 2 }
}

export function bowyerWatson(points: Point[]): Triangulation {
  const n = points.length
  if (n < 3) return { triangles: [], circumcenters: [] }

  // Super-triangle: large enough to contain all input points.
  // Its vertices are appended at indices n, n+1, n+2.
  const M = (Math.max(...points.map(p => Math.max(p.x, p.y))) + 1) * 4
  const ext: Point[] = [
    ...points,
    { x: 0, y: -M },     // n
    { x: M * 2, y: M },  // n+1
    { x: -M * 2, y: M }, // n+2
  ]
  const sa = n, sb = n + 1, sc = n + 2

  let tris: Triangle[] = [
    { a: sa, b: sb, c: sc, ...circumcircle(ext, sa, sb, sc) },
  ]

  for (let i = 0; i < n; i++) {
    const px = ext[i].x, py = ext[i].y

    // Partition triangles into "bad" (circumcircle contains point i) and good.
    const bad: Triangle[] = []
    const good: Triangle[] = []
    for (const t of tris) {
      const dx = px - t.cx, dy = py - t.cy
      ;(dx * dx + dy * dy < t.r2 + 1e-10 ? bad : good).push(t)
    }

    // Collect boundary edges of the bad-triangle polygon.
    // A boundary edge appears in exactly one bad triangle.
    const edgeCnt = new Map<string, [number, number]>()
    for (const t of bad) {
      for (const [u, v] of [[t.a, t.b], [t.b, t.c], [t.c, t.a]] as [number, number][]) {
        const key = u < v ? `${u}|${v}` : `${v}|${u}`
        if (!edgeCnt.has(key)) edgeCnt.set(key, [u, v])
        else edgeCnt.set(key, [-1, -1]) // mark as shared (interior) edge
      }
    }

    tris = good
    for (const [u, v] of edgeCnt.values()) {
      if (u === -1) continue // shared edge — not on boundary
      tris.push({ a: u, b: v, c: i, ...circumcircle(ext, u, v, i) })
    }
  }

  // Discard triangles that reference super-triangle vertices.
  const final = tris.filter(t => t.a < n && t.b < n && t.c < n)

  return {
    triangles: final.map(t => [t.a, t.b, t.c]),
    circumcenters: final.map(t => ({ x: t.cx, y: t.cy })),
  }
}
