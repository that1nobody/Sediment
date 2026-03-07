export interface Cell {
  id: number
  x: number
  y: number

  neighbors: number[] // ids of adjacent cells

  // Terrain (set by applyElevation)
  elevation?: number

  // Rivers (set by applyRivers)
  ocean?: boolean      // true if cell is below sea level
  flowsTo?: number     // id of the downstream neighbour; undefined = sink
  drainage?: number    // normalised drainage area in [0, 1] (1 = most-drained cell)
  river?: boolean      // true if drainage exceeds the river-channel threshold
  watershed?: number   // id of the ultimate sink this cell drains into

  // Climate (set by applyClimate)
  moisture?: number
  temperature?: number

  // Classification (set by applyBiomes)
  biome?: string

  // Civilizations (set by applyCivilizations)
  civilization?: number  // id of the owning civilization; undefined = unclaimed
  population?: number    // relative population level ∈ [0, 1]

  // Instability (set by applyInstability)
  instability?: number   // accumulated pressure ∈ [0, 1]; crossing a threshold triggers events
}

export interface Edge {
  id: number
  cellA: number  // Delaunay edge endpoint → Voronoi face A
  cellB: number  // Delaunay edge endpoint → Voronoi face B
  cornerA: number // id of first Voronoi vertex (circumcenter) bounding this edge
  cornerB: number // id of second Voronoi vertex bounding this edge
}

export interface Corner {
  id: number
  x: number
  y: number
}

export type EventType =
  | 'famine'
  | 'war'
  | 'plague'
  | 'disaster'
  | 'cultural_transformation'
  | 'collapse'

export interface EventRecord {
  /** Aeon (time step) in which the event occurred. */
  aeon: number
  /** Primary cell where the event originated. */
  cellId: number
  type: EventType
  /**
   * Symbolic weight ∈ [0, 1].  Low (<0.33) → ignored, medium → recorded,
   * high (>0.66) → mythic.
   */
  load: number
}

export interface WorldGraph {
  cells: Cell[]
  edges: Edge[]
  corners: Corner[]
  /** The seed actually used to generate this world (record for reproducibility). */
  seed: number
  /** World dimensions — carried on the graph so pipeline stages can normalise coordinates. */
  width: number
  height: number
  /** Ordered event ledger produced by applyEvents. */
  events: EventRecord[]
}

export interface WorldConfig {
  width: number
  height: number
  cellCount: number
  /** Supply a seed to reproduce a world exactly. Omit for a random one. */
  seed?: number
}
