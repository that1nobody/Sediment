// src/world/generateWorldGraph.ts

export interface Cell {
  id: number
  x: number
  y: number

  neighbors: number[]

  elevation?: number
  moisture?: number
  biome?: string
}

export interface Edge {
  id: number
  cellA: number
  cellB: number
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
}

export interface WorldConfig {
  width: number
  height: number
  cellCount: number
  seed?: number
}

/*
Main entry point for world graph generation
*/
export function generateWorldGraph(config: WorldConfig): WorldGraph {

  const points = generateRandomPoints(
    config.width,
    config.height,
    config.cellCount
  )

  const cells: Cell[] = points.map((p, i) => ({
    id: i,
    x: p.x,
    y: p.y,
    neighbors: []
  }))

  // NOTE:
  // In the first version we will NOT compute full Voronoi edges yet.
  // That will be added in the next iteration.

  return {
    cells,
    edges: [],
    corners: []
  }
}

/*
Temporary point generator

Later this will be replaced by Poisson disk sampling.
*/
function generateRandomPoints(
  width: number,
  height: number,
  count: number
) {

  const points: { x: number; y: number }[] = []

  for (let i = 0; i < count; i++) {
    points.push({
      x: Math.random() * width,
      y: Math.random() * height
    })
  }

  return points
}
