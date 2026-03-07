import type { RNG } from './rng'
import type { WorldGraph } from './types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AnomalyConfig {
  /**
   * Fraction of total cells that receive a primordial anomaly.
   * Actual anomaly count = round(density × cellCount).  Default 0.03.
   */
  primordialDensity?: number
  /**
   * Event load above which an emergent anomaly is created.
   * Load ∈ [0, 1]; 0.66 is the mythic threshold from GDD §11.  Default 0.66.
   */
  emergentThreshold?: number
  /**
   * Graph-distance BFS radius within which an anomaly influences cells.
   * Default 2.
   */
  influenceRadius?: number
}

// ---------------------------------------------------------------------------
// Pipeline stage
// ---------------------------------------------------------------------------

/**
 * Seeds anomalies and propagates their influence across the world graph.
 *
 * Two origins (GDD §9):
 *   - **Primordial** — placed randomly during world creation; prefer land cells.
 *   - **Emergent** — created when a mythic-load event (load > threshold) fires.
 *
 * After seeding, every cell within `influenceRadius` steps of an anomaly
 * receives a contribution to `cell.anomalyInfluence` ∈ [0, 1].  Contributions
 * from multiple anomalies are summed and clamped.
 *
 * Writes into `graph.anomalies` and `cell.anomalyInfluence`.
 *
 * Requires `applyEvents` (and all preceding stages) to have run first.
 *
 * @param graph  World graph mutated in place.
 * @param rng    Seeded RNG for reproducible primordial placement.
 * @param config Tuning parameters; all fields have sensible defaults.
 */
export function applyAnomalies(graph: WorldGraph, rng: RNG, config: AnomalyConfig = {}): void {
  const {
    primordialDensity = 0.03,
    emergentThreshold = 0.66,
    influenceRadius = 2,
  } = config

  const cells = graph.cells
  const n = cells.length
  if (n === 0) return

  // -------------------------------------------------------------------------
  // 1. Reset influence field
  // -------------------------------------------------------------------------

  for (const cell of cells) cell.anomalyInfluence = 0

  // -------------------------------------------------------------------------
  // 2. Primordial anomalies — random placement, prefer land
  // -------------------------------------------------------------------------

  const landCells = cells.filter(c => !c.ocean)
  const primordialTarget = Math.round(primordialDensity * n)

  // Fisher-Yates shuffle of land cells, then take the first N
  const shuffled = landCells.slice()
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  for (let i = 0; i < Math.min(primordialTarget, shuffled.length); i++) {
    const signal = 0.40 + rng() * 0.60  // 0.40 – 1.00
    graph.anomalies.push({
      id: graph.anomalies.length,
      cellId: shuffled[i].id,
      origin: 'primordial',
      radius: influenceRadius,
      signal,
    })
  }

  // -------------------------------------------------------------------------
  // 3. Emergent anomalies — one per mythic event, signal scales with load
  // -------------------------------------------------------------------------

  for (const event of graph.events) {
    if (event.load <= emergentThreshold) continue
    // Signal rises from 0.30 at the threshold to 0.80 at load = 1.
    const signal = 0.30 + (event.load - emergentThreshold) / (1 - emergentThreshold) * 0.50
    graph.anomalies.push({
      id: graph.anomalies.length,
      cellId: event.cellId,
      origin: 'emergent',
      radius: influenceRadius,
      signal: Math.min(signal, 1),
    })
  }

  // -------------------------------------------------------------------------
  // 4. BFS influence propagation
  // -------------------------------------------------------------------------
  // Signal decays linearly with distance: 1.0 at the anomaly cell, 0.0 at
  // radius + 1 (not reached).  Contributions from multiple anomalies are summed.

  for (const anomaly of graph.anomalies) {
    // queue entries: [cellId, distance]
    const queue: [number, number][] = [[anomaly.cellId, 0]]
    const visited = new Set<number>([anomaly.cellId])

    while (queue.length > 0) {
      const [cur, dist] = queue.shift()!
      const contribution = anomaly.signal * (1 - dist / (anomaly.radius + 1))
      cells[cur].anomalyInfluence = Math.min(
        (cells[cur].anomalyInfluence ?? 0) + contribution,
        1,
      )

      if (dist < anomaly.radius) {
        for (const nid of cells[cur].neighbors) {
          if (!visited.has(nid)) {
            visited.add(nid)
            queue.push([nid, dist + 1])
          }
        }
      }
    }
  }
}
