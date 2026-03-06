import type { WorldGraph } from './types'
import type { WorldGraph } from './generateWorldGraph'

export interface ClimateConfig {
  /**
   * How strongly elevation cools temperature. 0.6 means the highest mountains
   * can be up to 0.6 temperature units colder than sea-level at same latitude.
   */
  elevationCooling?: number
  /**
   * Graph-distance at which moisture from water sources decays to near-zero.
   */
  moistureFalloffDistance?: number
}

function clamp01(v: number): number {
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

/**
 * Computes temperature and moisture for every cell.
 *
 * Temperature:
 * - Warmer near the equator (y midpoint of map)
 * - Cooler near poles (top/bottom)
 * - Further reduced by elevation
 *
 * Moisture:
 * - Highest at water sources (ocean + river cells)
 * - Decays with graph distance from water sources
 */
export function applyClimate(graph: WorldGraph, config: ClimateConfig = {}): void {
  const { elevationCooling = 0.6, moistureFalloffDistance = 12 } = config
  const { cells, height } = graph

  if (cells.length === 0) return

  // Temperature field
  for (const cell of cells) {
    const latitude = Math.abs((cell.y / height) * 2 - 1) // 0 at equator, 1 at poles
    const latHeat = 1 - latitude
    const elevation = cell.elevation ?? 0
    cell.temperature = clamp01(latHeat - elevation * elevationCooling)
  }

  // Moisture field via multi-source BFS from water cells.
  const n = cells.length
  const distances = new Array<number>(n).fill(Number.POSITIVE_INFINITY)
  const queue: number[] = []

  for (const cell of cells) {
    if (cell.ocean || cell.river) {
      distances[cell.id] = 0
      queue.push(cell.id)
    }
  }

  // Fallback if no rivers/oceans are tagged yet: seed from lowest elevation cells.
  if (queue.length === 0) {
    const sorted = [...cells].sort((a, b) => (a.elevation ?? 0) - (b.elevation ?? 0))
    const seedCount = Math.max(1, Math.floor(n * 0.05))
    for (let i = 0; i < seedCount; i++) {
      distances[sorted[i].id] = 0
      queue.push(sorted[i].id)
    }
  }

  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]
    const nextDist = distances[cur] + 1
    for (const nid of cells[cur].neighbors) {
      if (nextDist < distances[nid]) {
        distances[nid] = nextDist
        queue.push(nid)
      }
    }
  }

  for (const cell of cells) {
    const d = distances[cell.id]
    const proximity = 1 - d / moistureFalloffDistance
    const latitude = Math.abs((cell.y / height) * 2 - 1)
    const latHumidity = 1 - latitude * 0.4
    cell.moisture = clamp01(proximity * 0.8 + latHumidity * 0.2)
  }
}
