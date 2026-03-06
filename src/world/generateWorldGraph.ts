import { makeSeed, mulberry32 } from './rng'
import { poissonDisk } from './poissonDisk'
import { bowyerWatson } from './delaunay'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface Cell {
  id: number
  x: number
  y: number

  neighbors: number[] // ids of adjacent cells

  elevation?: number
  moisture?: number
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
}

export interface WorldConfig {
  width: number
  height: number
  cellCount: number
  /** Supply a seed to reproduce a world exactly. Omit for a random one. */
  seed?: number
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function generateWorldGraph(config: WorldConfig): WorldGraph {
  const seed = makeSeed(config.seed)
  const rng = mulberry32(seed)

  // --- Points ---------------------------------------------------------------
  // Poisson disk sampling gives well-spaced sites compared to pure random,
  // which yields higher-quality Voronoi cells and avoids slivers.
  const pts = poissonDisk(config.width, config.height, config.cellCount, rng)

  const cells: Cell[] = pts.map((p, i) => ({
    id: i,
    x: p.x,
    y: p.y,
    neighbors: [],
  }))

  if (pts.length < 3) {
    return { cells, edges: [], corners: [], seed }
  }

  // --- Delaunay triangulation -----------------------------------------------
  // Each Delaunay triangle becomes a Voronoi vertex (circumcenter = corner).
  // Each Delaunay edge becomes a Voronoi edge separating two adjacent cells.
  const { triangles, circumcenters } = bowyerWatson(pts)

  const corners: Corner[] = circumcenters.map((c, i) => ({ id: i, x: c.x, y: c.y }))

  // --- Extract neighbour relationships and Voronoi edges --------------------
  // Map each Delaunay edge (sorted pair of cell ids) to the indices of the
  // (at most two) triangles that share it.
  const delaunayEdgeMap = new Map<string, number[]>()

  for (let ti = 0; ti < triangles.length; ti++) {
    const [a, b, c] = triangles[ti]
    for (const [u, v] of [[a, b], [b, c], [c, a]] as [number, number][]) {
      const key = u < v ? `${u}|${v}` : `${v}|${u}`
      const entry = delaunayEdgeMap.get(key)
      if (entry) entry.push(ti)
      else delaunayEdgeMap.set(key, [ti])
    }
  }

  const neighborSets = new Map<number, Set<number>>()
  cells.forEach((_, i) => neighborSets.set(i, new Set()))

  const edges: Edge[] = []

  for (const [key, triIds] of delaunayEdgeMap) {
    const sep = key.indexOf('|')
    const u = Number(key.slice(0, sep))
    const v = Number(key.slice(sep + 1))

    neighborSets.get(u)!.add(v)
    neighborSets.get(v)!.add(u)

    // Only interior Delaunay edges have two adjacent triangles and thus a
    // finite Voronoi edge.  Hull edges extend to infinity and are skipped
    // until a clipping step is introduced.
    if (triIds.length === 2) {
      edges.push({
        id: edges.length,
        cellA: u,
        cellB: v,
        cornerA: triIds[0],
        cornerB: triIds[1],
      })
    }
  }

  for (const [id, set] of neighborSets) {
    cells[id].neighbors = Array.from(set)
  }

  return { cells, edges, corners, seed }
}
