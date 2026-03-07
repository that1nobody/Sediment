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

  // Organizations (set by applyOrganizations)
  organizations?: number[]  // ids of organizations operating in this cell (may overlap with civ)

  // Anomalies (set by applyAnomalies)
  anomalyInfluence?: number  // cumulative anomaly signal ∈ [0, 1]

  // Registers (set by applyRegisters)
  registers?: string[]  // symbolic register names active at this cell
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

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export type OrgType = 'cult' | 'religion' | 'mercenary' | 'sect'

export interface Organization {
  id: number
  type: OrgType
  /** Cell ids where this organization currently operates. May overlap with civilization cells. */
  cells: number[]
  /** Fast-drift instability ∈ [0, 1] — organizations are inherently volatile. */
  instability: number
  /** Primary register this organization amplifies in its operating cells. */
  register: string
}

// ---------------------------------------------------------------------------
// Anomalies
// ---------------------------------------------------------------------------

export type AnomalyOrigin = 'primordial' | 'emergent'

export interface Anomaly {
  id: number
  cellId: number
  origin: AnomalyOrigin
  /** Graph-distance BFS radius of influence. */
  radius: number
  /** Base signal strength ∈ [0, 1]. */
  signal: number
}

// ---------------------------------------------------------------------------
// Chronicle
// ---------------------------------------------------------------------------

export interface ChronicleFragment {
  /** Aeon of the triggering event. */
  aeon: number
  /** Index into `WorldGraph.events`. */
  eventIndex: number
  cellId: number
  eventType: EventType
  /** Symbolic load ∈ [0, 1]. Low (<0.33) → ignored, medium → recorded, high (>0.66) → mythic. */
  load: number
  /** Active registers at the cell when the event fired. */
  registers: string[]
  /** Organization involved (if any operates in this cell). */
  organizationId?: number
  organizationType?: OrgType
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

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
  /** Organizations seeded by applyOrganizations. */
  organizations: Organization[]
  /** Anomalies seeded by applyAnomalies. */
  anomalies: Anomaly[]
  /** Chronicle fragments assembled by assembleChronicle. */
  chronicle: ChronicleFragment[]
}

export interface WorldConfig {
  width: number
  height: number
  cellCount: number
  /** Supply a seed to reproduce a world exactly. Omit for a random one. */
  seed?: number
}
