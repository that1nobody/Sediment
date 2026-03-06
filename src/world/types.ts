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

export interface WorldGraph {
  cells: Cell[]
  edges: Edge[]
  corners: Corner[]
  /** The seed actually used to generate this world (record for reproducibility). */
  seed: number
  /** World dimensions — carried on the graph so pipeline stages can normalise coordinates. */
  width: number
  height: number
}

export interface WorldConfig {
  width: number
  height: number
  cellCount: number
  /** Supply a seed to reproduce a world exactly. Omit for a random one. */
  seed?: number
}
