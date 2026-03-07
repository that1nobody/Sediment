import type { WorldGraph } from './types'

// ---------------------------------------------------------------------------
// Export types (JSON-serialisable; consumed by render_chronicle.py)
// ---------------------------------------------------------------------------

export interface CellExport {
  biome: string
  registers: string[]
  civilization?: number
  x: number
  y: number
}

export interface OrganizationExport {
  id: number
  type: string
  register: string
}

export interface FragmentExport {
  aeon: number
  event_type: string
  load: number
  registers: string[]
  cell_id: number
  cell_biome: string
  organization_id?: number
  organization_type?: string
}

export interface WorldStateExport {
  seed: number
  generated_at: string
  summary: {
    cell_count: number
    event_count: number
    chronicle_count: number
    organization_count: number
    anomaly_count: number
  }
  /** Chronicle fragments in aeon order; only entries meeting minLoad threshold. */
  chronicle: FragmentExport[]
  /**
   * Cell data keyed by cell id (string).
   * Only cells referenced by chronicle fragments are included.
   */
  cells: Record<string, CellExport>
  organizations: OrganizationExport[]
}

// ---------------------------------------------------------------------------
// Export function
// ---------------------------------------------------------------------------

/**
 * Converts a fully-generated WorldGraph into a JSON-serialisable snapshot
 * for consumption by the Python narrative layer (render_chronicle.py).
 *
 * Only cells referenced by at least one chronicle fragment are included in
 * the cells map, keeping the output compact.
 */
export function exportWorldState(graph: WorldGraph): WorldStateExport {
  // Collect only cells referenced by chronicle fragments
  const referencedCellIds = new Set<number>(graph.chronicle.map(f => f.cellId))

  const cells: Record<string, CellExport> = {}
  for (const id of referencedCellIds) {
    const cell = graph.cells[id]
    cells[String(id)] = {
      biome: cell.biome ?? 'unknown',
      registers: cell.registers ?? [],
      civilization: cell.civilization,
      x: cell.x,
      y: cell.y,
    }
  }

  return {
    seed: graph.seed,
    generated_at: new Date().toISOString().split('T')[0],
    summary: {
      cell_count: graph.cells.length,
      event_count: graph.events.length,
      chronicle_count: graph.chronicle.length,
      organization_count: graph.organizations.length,
      anomaly_count: graph.anomalies.length,
    },
    chronicle: graph.chronicle.map(f => ({
      aeon: f.aeon,
      event_type: f.eventType,
      load: f.load,
      registers: f.registers,
      cell_id: f.cellId,
      cell_biome: graph.cells[f.cellId]?.biome ?? 'unknown',
      organization_id: f.organizationId,
      organization_type: f.organizationType,
    })),
    cells,
    organizations: graph.organizations.map(o => ({
      id: o.id,
      type: o.type,
      register: o.register,
    })),
  }
}
