import type { RNG } from './rng'

export interface Point { x: number; y: number }

/**
 * Bridson's Poisson disk sampling algorithm.
 *
 * Generates a set of points inside [0, width) × [0, height) such that no
 * two points are closer than a minimum distance r, while still covering the
 * space as densely as possible.  The count of returned points will be
 * approximately `targetCount` but is not guaranteed to be exact — it depends
 * on the random seed and how tightly the chosen r fits the space.
 *
 * @param targetCount  Desired number of points; drives the choice of r.
 * @param maxAttempts  Candidates tried per active point before giving up (30
 *                     is Bridson's recommended default).
 */
export function poissonDisk(
  width: number,
  height: number,
  targetCount: number,
  rng: RNG,
  maxAttempts = 30
): Point[] {
  if (targetCount === 0) return []
  if (targetCount === 1) return [{ x: rng() * width, y: rng() * height }]

  // Minimum separation between points.  The formula targets the right density
  // for a Poisson process filling the given area.
  const r = Math.sqrt((width * height) / targetCount)
  const cellSize = r / Math.SQRT2

  const gridW = Math.ceil(width / cellSize) + 1
  const gridH = Math.ceil(height / cellSize) + 1
  const grid: (Point | undefined)[] = new Array(gridW * gridH)

  const active: Point[] = []
  const points: Point[] = []

  function insert(p: Point): void {
    const gx = Math.floor(p.x / cellSize)
    const gy = Math.floor(p.y / cellSize)
    grid[gx + gy * gridW] = p
    active.push(p)
    points.push(p)
  }

  function tooClose(p: Point): boolean {
    const gx = Math.floor(p.x / cellSize)
    const gy = Math.floor(p.y / cellSize)
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = gx + dx, ny = gy + dy
        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue
        const q = grid[nx + ny * gridW]
        if (q && (p.x - q.x) ** 2 + (p.y - q.y) ** 2 < r * r) return true
      }
    }
    return false
  }

  // Seed point
  insert({ x: rng() * width, y: rng() * height })

  while (active.length > 0) {
    const i = Math.floor(rng() * active.length)
    const origin = active[i]
    let found = false

    for (let k = 0; k < maxAttempts; k++) {
      const angle = rng() * 2 * Math.PI
      const d = r * (1 + rng()) // sample in annulus [r, 2r]
      const c: Point = {
        x: origin.x + Math.cos(angle) * d,
        y: origin.y + Math.sin(angle) * d,
      }
      if (c.x < 0 || c.x >= width || c.y < 0 || c.y >= height) continue
      if (tooClose(c)) continue
      insert(c)
      found = true
      break
    }

    if (!found) active.splice(i, 1)
  }

  return points
}
