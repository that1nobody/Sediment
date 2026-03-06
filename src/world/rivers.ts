import type { WorldGraph } from './generateWorldGraph'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RiverConfig {
  /**
   * Elevation threshold below which a cell is considered ocean (a natural
   * sink).  Matches the typical sea-level fraction after elevation
   * normalisation.  Default 0.4.
   */
  seaLevel?: number
  /**
   * Minimum normalised drainage area (fraction of the most-drained cell's
   * catchment) a land cell must have to become a river channel.
   * Default 0.05 — roughly the top 5 % of drainage values.
   */
  riverThreshold?: number
}

// ---------------------------------------------------------------------------
// Pipeline stage
// ---------------------------------------------------------------------------

/**
 * Computes the river and drainage system for `graph` and writes results into
 * each cell:
 *
 *   cell.ocean      — true if the cell is below sea level
 *   cell.flowsTo    — id of the downhill neighbour (undefined for sinks)
 *   cell.drainage   — normalised drainage area ∈ [0, 1]
 *   cell.river      — true if drainage exceeds riverThreshold
 *   cell.watershed  — id of the ultimate sink this cell drains into
 *
 * Requires `applyElevation` to have run first.
 */
export function applyRivers(graph: WorldGraph, config: RiverConfig = {}): void {
  const { seaLevel = 0.4, riverThreshold = 0.05 } = config
  const cells = graph.cells
  const n = cells.length
  if (n === 0) return

  // -------------------------------------------------------------------------
  // 1. Classify ocean cells and assign flow direction
  // -------------------------------------------------------------------------
  // Each land cell flows to the neighbour with the lowest elevation.
  // If no neighbour is lower it is a local sink (interior basin).
  // Ocean cells are unconditional sinks.

  for (const cell of cells) {
    cell.ocean = cell.elevation! < seaLevel

    if (cell.ocean) {
      cell.flowsTo = undefined
      continue
    }

    let lowestId: number | undefined
    let lowestElev = cell.elevation!
    for (const nid of cell.neighbors) {
      const e = cells[nid].elevation!
      if (e < lowestElev) { lowestElev = e; lowestId = nid }
    }
    cell.flowsTo = lowestId
  }

  // -------------------------------------------------------------------------
  // 2. Flow accumulation — topological sort by descending elevation
  // -------------------------------------------------------------------------
  // Each cell starts with a drainage count of 1 (itself).  Processing from
  // high to low, each cell adds its accumulated count to its downstream cell.

  const order = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => cells[b].elevation! - cells[a].elevation!)

  const drainCount = new Array<number>(n).fill(1)

  for (const i of order) {
    const downstream = cells[i].flowsTo
    if (downstream !== undefined) drainCount[downstream] += drainCount[i]
  }

  const maxDrain = Math.max(...drainCount)

  // -------------------------------------------------------------------------
  // 3. Assign drainage, river flag
  // -------------------------------------------------------------------------

  for (let i = 0; i < n; i++) {
    cells[i].drainage = drainCount[i] / maxDrain
    cells[i].river = !cells[i].ocean && cells[i].drainage! > riverThreshold
  }

  // -------------------------------------------------------------------------
  // 4. Watershed assignment — iterative path compression
  // -------------------------------------------------------------------------
  // Follow flowsTo chains to the ultimate sink.  Path compression means each
  // cell is visited at most twice, keeping the total work O(n).

  const sinkOf = new Array<number | undefined>(n)

  for (let start = 0; start < n; start++) {
    if (sinkOf[start] !== undefined) continue

    // Trace the path to a resolved cell or a sink.
    const path: number[] = []
    let cur = start

    while (sinkOf[cur] === undefined) {
      path.push(cur)
      const next = cells[cur].flowsTo
      if (next === undefined) {
        sinkOf[cur] = cur // cur is a sink
        break
      }
      cur = next
    }

    // Backfill: every cell on this path drains to the same sink.
    const sink = sinkOf[cur]!
    for (const id of path) sinkOf[id] = sink
  }

  for (let i = 0; i < n; i++) cells[i].watershed = sinkOf[i]!
}
