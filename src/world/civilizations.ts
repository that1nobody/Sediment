import type { RNG } from './rng'
import type { WorldGraph } from './types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CivilizationConfig {
  /**
   * Maximum number of civilizations that may be seeded.
   * Actual count depends on how many habitable cells exist.  Default 8.
   */
  maxCivilizations?: number
  /**
   * Number of expansion rounds after initial seeding.  Each round, every
   * civilization attempts to claim one unclaimed adjacent cell.  Default 12.
   */
  expansionSteps?: number
  /** Minimum moisture a cell must have to be habitable.  Default 0.25. */
  minMoisture?: number
  /** Minimum temperature a cell must have to be habitable.  Default 0.20. */
  minTemperature?: number
  /** Minimum drainage a cell must have (proxy for water access).  Default 0.05. */
  minDrainage?: number
}

// ---------------------------------------------------------------------------
// Pipeline stage
// ---------------------------------------------------------------------------

/**
 * Seeds civilizations in habitable land cells and expands them outward,
 * writing the results into each cell:
 *
 *   cell.civilization  — id of the owning civilization (undefined = unclaimed)
 *   cell.population    — relative population ∈ [0, 1] (higher near origin)
 *
 * Requires `applyBiomes` (and all preceding stages) to have run first.
 *
 * @param graph  World graph mutated in place.
 * @param rng    Seeded RNG for reproducible placement.
 * @param config Tuning parameters; all fields have sensible defaults.
 */
export function applyCivilizations(
  graph: WorldGraph,
  rng: RNG,
  config: CivilizationConfig = {},
): void {
  const {
    maxCivilizations = 8,
    expansionSteps = 12,
    minMoisture = 0.25,
    minTemperature = 0.20,
    minDrainage = 0.05,
  } = config

  const cells = graph.cells
  if (cells.length === 0) return

  // -------------------------------------------------------------------------
  // 1. Collect candidate seed cells: habitable, non-ocean land
  // -------------------------------------------------------------------------

  const habitable = cells.filter(c =>
    !c.ocean &&
    c.biome !== 'mountain' &&
    (c.moisture ?? 0) >= minMoisture &&
    (c.temperature ?? 0) >= minTemperature &&
    (c.drainage ?? 0) >= minDrainage,
  )

  if (habitable.length === 0) return

  // -------------------------------------------------------------------------
  // 2. Fisher-Yates shuffle of candidates, then take the first N as origins
  // -------------------------------------------------------------------------

  const shuffled = habitable.slice()
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const seedCount = Math.min(maxCivilizations, shuffled.length)
  const seeds = shuffled.slice(0, seedCount)

  // Claim seed cells
  for (let civId = 0; civId < seeds.length; civId++) {
    seeds[civId].civilization = civId
    seeds[civId].population = 1
  }

  // -------------------------------------------------------------------------
  // 3. Expansion — BFS frontier, one step per round per civilization
  // -------------------------------------------------------------------------
  // frontier[civId] = set of cell ids on the active expansion front

  const frontier: Set<number>[] = seeds.map(s => new Set([s.id]))

  for (let step = 0; step < expansionSteps; step++) {
    // Population decays with distance from origin; step 0 = 1, step N ≈ 0
    const popFraction = 1 - (step + 1) / (expansionSteps + 1)

    const nextFrontier: Set<number>[] = frontier.map(() => new Set())

    for (let civId = 0; civId < seeds.length; civId++) {
      for (const cellId of frontier[civId]) {
        for (const nid of cells[cellId].neighbors) {
          const neighbor = cells[nid]
          if (
            neighbor.civilization === undefined &&
            !neighbor.ocean &&
            neighbor.biome !== 'mountain'
          ) {
            neighbor.civilization = civId
            neighbor.population = popFraction
            nextFrontier[civId].add(nid)
          }
        }
      }
    }

    for (let civId = 0; civId < seeds.length; civId++) {
      frontier[civId] = nextFrontier[civId]
    }
  }
}
