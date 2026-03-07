import type { ChronicleFragment, WorldGraph } from './types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ChronicleConfig {
  /**
   * Minimum event load for a fragment to be recorded.
   * GDD §11: low (<0.33) → ignored, medium → recorded, high (>0.66) → mythic.
   * Default 0.33.
   */
  minLoad?: number
}

// ---------------------------------------------------------------------------
// Pipeline stage
// ---------------------------------------------------------------------------

/**
 * Assembles a structured chronicle from the event ledger, filtering to events
 * that exceed the symbolic load threshold and enriching each with register and
 * organization context.
 *
 * Chronicle fragments are in chronological (aeon) order because events are
 * appended to `graph.events` in order during `applyEvents`.
 *
 * The resulting `graph.chronicle` is structured data — textual rendering is
 * handled by the Python narrative layer (graph_engine.py).  Each fragment
 * carries enough context (registers, org type, event type, load) for the
 * Python layer to select appropriate vocabulary, voice, and templates.
 *
 * Requires `applyRegisters` (and all preceding stages) to have run first.
 *
 * @param graph  World graph mutated in place; `graph.chronicle` is populated.
 * @param config Tuning parameters; all fields have sensible defaults.
 */
export function assembleChronicle(graph: WorldGraph, config: ChronicleConfig = {}): void {
  const { minLoad = 0.33 } = config

  graph.chronicle = []

  if (graph.cells.length === 0) return

  // Build a quick cell-id → org-id lookup for the first org found in each cell
  const cellToOrg = new Map<number, number>()
  for (const org of graph.organizations) {
    for (const cid of org.cells) {
      if (!cellToOrg.has(cid)) cellToOrg.set(cid, org.id)
    }
  }

  for (let i = 0; i < graph.events.length; i++) {
    const event = graph.events[i]
    if (event.load < minLoad) continue

    const cell = graph.cells[event.cellId]
    const registers = cell.registers ?? []

    const orgId = cellToOrg.get(event.cellId)
    const org = orgId !== undefined ? graph.organizations[orgId] : undefined

    const fragment: ChronicleFragment = {
      aeon: event.aeon,
      eventIndex: i,
      cellId: event.cellId,
      eventType: event.type,
      load: event.load,
      registers,
      organizationId: org?.id,
      organizationType: org?.type,
    }

    graph.chronicle.push(fragment)
  }
}
