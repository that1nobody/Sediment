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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Selects the most appropriate event type for a cell given its current state
 * and the state of its neighbourhood.
 */
function selectEventType(cellId: number, graph: WorldGraph): EventType {
  const cell = graph.cells[cellId]

  // War requires an adjacent cell of a different civilization.
  const hasEnemy = cell.neighbors.some(nid => {
    const nciv = graph.cells[nid].civilization
    return nciv !== undefined && nciv !== cell.civilization
  })
  if (hasEnemy) return 'war'

  // Famine when moisture is very low.
  if ((cell.moisture ?? 0.5) < 0.25) return 'famine'

  // Plague when population is high.
  if ((cell.population ?? 0) > 0.70) return 'plague'

  // Collapse for high-instability isolated cells.
  if ((cell.instability ?? 0) > 0.90) return 'collapse'

  // Default: cultural transformation.
  return 'cultural_transformation'
}

/**
 * Computes a symbolic load value ∈ [0, 1] for an event.
 * Higher instability and more extreme event types produce higher loads.
 */
function computeLoad(type: EventType, instability: number, rng: RNG): number {
  const baseByType: Record<EventType, number> = {
    war: 0.70,
    collapse: 0.80,
    plague: 0.55,
    famine: 0.45,
    disaster: 0.60,
    cultural_transformation: 0.35,
  }
  const base = baseByType[type]
  // Scale by instability and add small jitter for variability.
  return Math.min(base * instability + rng() * 0.10, 1)
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
  } = config

  const cells = graph.cells
  if (cells.length === 0) return

  for (let aeon = 0; aeon < aeons; aeon++) {
    for (const cell of cells) {
      if (cell.civilization === undefined) continue
      if ((cell.instability ?? 0) < instabilityThreshold) continue

      const type = selectEventType(cell.id, graph)
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
