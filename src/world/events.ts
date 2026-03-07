import type { RNG } from './rng'
import type { EventRecord, EventType, WorldGraph } from './types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface EventConfig {
  /**
   * Number of simulated time steps (aeons).  Each aeon, all cells above the
   * instability threshold are evaluated for events.  Default 10.
   */
  aeons?: number
  /**
   * Instability level at which a cell triggers an event in a given aeon.
   * Default 0.60.
   */
  instabilityThreshold?: number
  /**
   * Fraction by which instability is reduced in a cell after it triggers an
   * event (representing relief or reset).  Default 0.50.
   */
  instabilityDecay?: number
  /**
   * Amount of instability re-added to each settled cell at the start of every
   * aeon, simulating ongoing environmental and social pressure.  Without this,
   * cells never recover toward the threshold after firing.  Default 0.
   *
   * Recommended value: 0.04 – 0.08.  Higher values produce more frequent
   * recurring events; 0 disables re-accumulation entirely.
   */
  accumulationRate?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Selects the most appropriate event type for a cell given its current state
 * and the state of its neighbourhood.
 *
 * Priority order: famine/plague (environmental crises) → collapse (extreme) →
 * war (probabilistic for frontier cells — chance scales with instability so
 * low-pressure border friction becomes cultural exchange) → cultural_transformation.
 *
 * War probability: P(war) = instability × 0.70, capped at 0.85.
 * At threshold 0.60 this gives ~42 % war; at instability 0.90 it gives ~63 %.
 * The RNG is consumed once per frontier cell regardless of the outcome.
 */
function selectEventType(cellId: number, graph: WorldGraph, rng: RNG): EventType {
  const cell = graph.cells[cellId]
  const instability = cell.instability ?? 0

  // Environmental crises take priority over political conflict.
  if ((cell.moisture ?? 0.5) < 0.25) return 'famine'
  if ((cell.population ?? 0) > 0.85) return 'plague'

  // Collapse under extreme isolated pressure.
  if (instability > 0.90) return 'collapse'

  // War on frontier cells — probability scales with instability so that
  // moderate-pressure borders produce cultural exchange while high-pressure
  // ones escalate to open conflict.
  const hasEnemy = cell.neighbors.some(nid => {
    const nciv = graph.cells[nid].civilization
    return nciv !== undefined && nciv !== cell.civilization
  })
  if (hasEnemy && rng() < Math.min(instability * 0.70, 0.85)) return 'war'

  // Default: cultural transformation (including peaceful border exchange).
  return 'cultural_transformation'
}

/**
 * Computes a symbolic load value ∈ [0, 1] for an event.
 *
 * Load scales from a minimum floor at the instability threshold up toward 1
 * as instability approaches maximum.  This ensures medium-load events at the
 * threshold and mythic-load events at high instability.
 *
 * Formula: load = base × (0.40 + instability × 0.60) + jitter
 *   At instability = 0.60 (threshold): war ≈ 0.61–0.69 (near-mythic)
 *   At instability = 0.80:             war ≈ 0.74–0.82 (solidly mythic)
 *   At instability = 0.60:             cultural_transformation ≈ 0.38–0.46
 */
function computeLoad(type: EventType, instability: number, rng: RNG): number {
  const baseByType: Record<EventType, number> = {
    war:                     0.80,
    collapse:                0.90,
    plague:                  0.65,
    famine:                  0.60,
    disaster:                0.65,
    cultural_transformation: 0.50,
  }
  const base = baseByType[type]
  return Math.min(base * (0.40 + instability * 0.60) + rng() * 0.08, 1)
}

// ---------------------------------------------------------------------------
// Pipeline stage
// ---------------------------------------------------------------------------

/**
 * Simulates historical events over multiple aeons by inspecting each cell's
 * instability score.  Cells above the threshold trigger an event, which is
 * recorded in `graph.events` and causes a partial instability reset.
 *
 * Requires `applyInstability` (and preceding stages) to have run first.
 *
 * @param graph  World graph mutated in place; events are appended to `graph.events`.
 * @param rng    Seeded RNG for reproducible event selection.
 * @param config Tuning parameters; all fields have sensible defaults.
 */
export function applyEvents(graph: WorldGraph, rng: RNG, config: EventConfig = {}): void {
  const {
    aeons = 10,
    instabilityThreshold = 0.60,
    instabilityDecay = 0.50,
    accumulationRate = 0,
  } = config

  const cells = graph.cells
  if (cells.length === 0) return

  for (let aeon = 0; aeon < aeons; aeon++) {
    // Re-accumulate instability at the start of each aeon.
    // This simulates ongoing environmental and social pressure so that cells
    // can eventually fire again after a partial instability reset.
    if (accumulationRate > 0) {
      for (const cell of cells) {
        if (cell.civilization !== undefined) {
          cell.instability = Math.min((cell.instability ?? 0) + accumulationRate, 1)
        }
      }
    }

    for (const cell of cells) {
      if (cell.civilization === undefined) continue
      if ((cell.instability ?? 0) < instabilityThreshold) continue

      const type = selectEventType(cell.id, graph, rng)
      const load = computeLoad(type, cell.instability!, rng)

      const record: EventRecord = { aeon, cellId: cell.id, type, load }
      graph.events.push(record)

      // Apply event consequences
      if (type === 'plague') {
        // Plague reduces local population.
        cell.population = Math.max(0, (cell.population ?? 0) - 0.30)
      } else if (type === 'collapse') {
        // Collapse removes civilization claim.
        cell.civilization = undefined
        cell.population = 0
      }

      // Partial instability reset after the event.
      cell.instability = (cell.instability ?? 0) * (1 - instabilityDecay)
    }
  }
}
