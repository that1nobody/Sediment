import type { EventType, WorldGraph } from './types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export const ALL_REGISTERS = [
  'DEATH', 'DARKNESS', 'WILD', 'ANCIENT', 'MYTHIC',
  'MYSTERY', 'MAGIC', 'FIRE', 'VIOLENT', 'EVIL',
] as const

export type Register = typeof ALL_REGISTERS[number]

export interface RegisterConfig {
  /**
   * Minimum score for a register to be considered active on a cell.
   * Default 0.25.
   */
  threshold?: number
  /**
   * Maximum number of active registers per cell.  Default 3.
   */
  maxRegisters?: number
}

// ---------------------------------------------------------------------------
// Scoring tables
// ---------------------------------------------------------------------------

/** Base register scores contributed by each biome. */
const BIOME_SCORES: Partial<Record<string, Partial<Record<Register, number>>>> = {
  ocean:     { WILD: 0.30, MYSTERY: 0.20, DARKNESS: 0.20 },
  coast:     { WILD: 0.40, ANCIENT: 0.10 },
  forest:    { WILD: 0.60, MYSTERY: 0.20, ANCIENT: 0.20 },
  grassland: { WILD: 0.30, ANCIENT: 0.10 },
  wetland:   { WILD: 0.50, MYSTERY: 0.40, DARKNESS: 0.20 },
  desert:    { DEATH: 0.50, FIRE: 0.40, ANCIENT: 0.30 },
  tundra:    { ANCIENT: 0.50, DARKNESS: 0.40, DEATH: 0.30 },
  mountain:  { ANCIENT: 0.60, WILD: 0.30, MYTHIC: 0.20 },
}

/** Register boosts per event type, scaled by event load at assignment time. */
const EVENT_BOOSTS: Record<EventType, Partial<Record<Register, number>>> = {
  war:                   { VIOLENT: 0.60, FIRE: 0.30 },
  famine:                { DEATH: 0.50, DARKNESS: 0.30 },
  plague:                { DEATH: 0.50, MYSTERY: 0.30 },
  disaster:              { WILD: 0.40, DEATH: 0.30, MYSTERY: 0.20 },
  cultural_transformation: { ANCIENT: 0.30, MYTHIC: 0.40 },
  collapse:              { DEATH: 0.40, ANCIENT: 0.30, DARKNESS: 0.20 },
}

// ---------------------------------------------------------------------------
// Pipeline stage
// ---------------------------------------------------------------------------

/**
 * Computes the active symbolic registers for every cell and writes them into
 * `cell.registers`.
 *
 * Register scores are aggregated from four sources (GDD §10):
 *   1. **Biome** — base scores from terrain type
 *   2. **Events** — event-type boosts scaled by each event's symbolic load
 *   3. **Anomaly influence** — `anomalyInfluence` boosts MYSTERY, MYTHIC, MAGIC
 *   4. **Organizations** — each org amplifies its primary register in its cells
 *
 * The top-scoring registers above `threshold` (up to `maxRegisters`) are stored.
 * Registers describe the world state rather than driving the simulation (GDD §3).
 *
 * Requires `applyAnomalies` and `applyOrganizations` to have run first.
 *
 * @param graph  World graph mutated in place.
 * @param config Tuning parameters; all fields have sensible defaults.
 */
export function applyRegisters(graph: WorldGraph, config: RegisterConfig = {}): void {
  const { threshold = 0.25, maxRegisters = 3 } = config

  const cells = graph.cells
  if (cells.length === 0) return

  // -------------------------------------------------------------------------
  // Pre-compute per-cell event boosts (load-weighted)
  // -------------------------------------------------------------------------

  const cellEventBoosts = new Map<number, Partial<Record<Register, number>>>()
  for (const event of graph.events) {
    const acc = cellEventBoosts.get(event.cellId) ?? {}
    const boosts = EVENT_BOOSTS[event.type]
    for (const reg of ALL_REGISTERS) {
      const b = boosts[reg]
      if (b !== undefined) {
        acc[reg] = Math.min((acc[reg] ?? 0) + b * event.load, 1)
      }
    }
    cellEventBoosts.set(event.cellId, acc)
  }

  // -------------------------------------------------------------------------
  // Pre-compute per-cell org boosts (each org adds 0.40 to its register)
  // -------------------------------------------------------------------------

  const cellOrgBoosts = new Map<number, Partial<Record<Register, number>>>()
  for (const org of graph.organizations) {
    const reg = org.register as Register
    for (const cid of org.cells) {
      const acc = cellOrgBoosts.get(cid) ?? {}
      acc[reg] = Math.min((acc[reg] ?? 0) + 0.40, 1)
      cellOrgBoosts.set(cid, acc)
    }
  }

  // -------------------------------------------------------------------------
  // Assign registers to each cell
  // -------------------------------------------------------------------------

  for (const cell of cells) {
    const scores: Record<Register, number> = {
      DEATH: 0, DARKNESS: 0, WILD: 0, ANCIENT: 0, MYTHIC: 0,
      MYSTERY: 0, MAGIC: 0, FIRE: 0, VIOLENT: 0, EVIL: 0,
    }

    // 1. Biome
    const biomeBoosts = BIOME_SCORES[cell.biome ?? ''] ?? {}
    for (const reg of ALL_REGISTERS) {
      const b = biomeBoosts[reg]
      if (b !== undefined) scores[reg] += b
    }

    // 2. Events (clamped per register at 1.0)
    const evBoosts = cellEventBoosts.get(cell.id) ?? {}
    for (const reg of ALL_REGISTERS) {
      const b = evBoosts[reg]
      if (b !== undefined) scores[reg] = Math.min(scores[reg] + b, 2)
    }

    // 3. Anomaly influence → MYSTERY, MYTHIC, MAGIC
    const anom = cell.anomalyInfluence ?? 0
    if (anom > 0) {
      scores.MYSTERY = Math.min(scores.MYSTERY + anom * 0.60, 2)
      scores.MYTHIC  = Math.min(scores.MYTHIC  + anom * 0.40, 2)
      scores.MAGIC   = Math.min(scores.MAGIC   + anom * 0.50, 2)
    }

    // 4. Organizations
    const orgBoosts = cellOrgBoosts.get(cell.id) ?? {}
    for (const reg of ALL_REGISTERS) {
      const b = orgBoosts[reg]
      if (b !== undefined) scores[reg] = Math.min(scores[reg] + b, 2)
    }

    // Select top registers above threshold
    cell.registers = ALL_REGISTERS
      .filter(r => scores[r] >= threshold)
      .sort((a, b) => scores[b] - scores[a])
      .slice(0, maxRegisters)
  }
}
