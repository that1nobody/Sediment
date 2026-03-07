import type { WorldGraph } from './types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface InstabilityConfig {
  /**
   * Moisture level below which a cell contributes famine pressure.
   * Default 0.30.
   */
  famineThreshold?: number
  /**
   * Weight applied to each instability driver before summing.
   * All weights are normalised so the maximum possible raw score equals 1.
   */
  weights?: {
    /** Pressure from low moisture (famine risk).  Default 0.35. */
    famine?: number
    /** Pressure from sitting on a border between civilizations.  Default 0.30. */
    frontier?: number
    /** Pressure from high local population (faction conflict risk).  Default 0.35. */
    population?: number
  }
}

// ---------------------------------------------------------------------------
// Pipeline stage
// ---------------------------------------------------------------------------

/**
 * Computes an instability score for every settled cell and writes it into
 * `cell.instability` ∈ [0, 1].  Unclaimed cells receive an instability of 0.
 *
 * Drivers (from GDD §7):
 *   - **Famine** — low moisture relative to the famine threshold
 *   - **Frontier stress** — the cell neighbours a cell of a different civilisation
 *   - **Population pressure** — local population contributes conflict risk
 *
 * Requires `applyCivilizations` (and preceding stages) to have run first.
 *
 * @param graph  World graph mutated in place.
 * @param config Tuning parameters; all fields have sensible defaults.
 */
export function applyInstability(graph: WorldGraph, config: InstabilityConfig = {}): void {
  const {
    famineThreshold = 0.30,
    weights: {
      famine: wFamine = 0.35,
      frontier: wFrontier = 0.30,
      population: wPop = 0.35,
    } = {},
  } = config

  const cells = graph.cells
  if (cells.length === 0) return

  for (const cell of cells) {
    if (cell.civilization === undefined) {
      cell.instability = 0
      continue
    }

    // --- Famine driver -------------------------------------------------------
    // Normalised shortage below threshold: 0 when moisture ≥ threshold, 1 when
    // moisture = 0.
    const m = cell.moisture ?? 0
    const famineScore = m < famineThreshold
      ? (famineThreshold - m) / famineThreshold
      : 0

    // --- Frontier driver -----------------------------------------------------
    // True if at least one neighbour belongs to a different civilisation.
    const onFrontier = cell.neighbors.some(nid => {
      const nciv = cells[nid].civilization
      return nciv !== undefined && nciv !== cell.civilization
    })
    const frontierScore = onFrontier ? 1 : 0

    // --- Population driver ---------------------------------------------------
    // Higher population → more faction conflict risk.
    const popScore = cell.population ?? 0

    // --- Weighted sum --------------------------------------------------------
    const raw = wFamine * famineScore + wFrontier * frontierScore + wPop * popScore
    // Maximum possible raw value equals the sum of all weights (= 1 by design).
    const maxRaw = wFamine + wFrontier + wPop
    cell.instability = maxRaw > 0 ? Math.min(raw / maxRaw, 1) : 0
  }
}
