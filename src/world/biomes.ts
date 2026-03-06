import type { WorldGraph } from './generateWorldGraph'

export type Biome =
  | 'tundra'
  | 'forest'
  | 'grassland'
  | 'desert'
  | 'wetland'
  | 'mountain'
  | 'coast'

export interface BiomeConfig {
  seaLevel?: number
  mountainLevel?: number
}

/**
 * Classifies each cell into a biome using elevation, temperature, moisture,
 * and ocean/river context from previous pipeline stages.
 */
export function applyBiomes(graph: WorldGraph, config: BiomeConfig = {}): void {
  const { seaLevel = 0.4, mountainLevel = 0.78 } = config

  for (const cell of graph.cells) {
    const elevation = cell.elevation ?? 0
    const t = cell.temperature ?? 0.5
    const m = cell.moisture ?? 0.5

    if (cell.ocean || elevation < seaLevel) {
      cell.biome = 'coast'
      continue
    }

    if (elevation >= mountainLevel) {
      cell.biome = 'mountain'
      continue
    }

    if (t < 0.22) {
      cell.biome = 'tundra'
      continue
    }

    if (m < 0.22) {
      cell.biome = 'desert'
      continue
    }

    if (m > 0.72) {
      cell.biome = t > 0.58 ? 'wetland' : 'forest'
      continue
    }

    cell.biome = 'grassland'
  }
}
