import { generateWorldGraph, type WorldConfig, type WorldGraph } from './generateWorldGraph'
import { applyElevation, type ElevationConfig } from './elevation'
import { applyRivers, type RiverConfig } from './rivers'
import { applyClimate, type ClimateConfig } from './climate'
import { applyBiomes, type BiomeConfig } from './biomes'

export interface WorldPipelineConfig {
  world: WorldConfig
  elevation?: ElevationConfig
  rivers?: RiverConfig
  climate?: ClimateConfig
  biomes?: BiomeConfig
}

/**
 * Runs the currently implemented generation pipeline end-to-end.
 */
export function generateWorld(config: WorldPipelineConfig): WorldGraph {
  const graph = generateWorldGraph(config.world)
  applyElevation(graph, graph.seed, config.elevation)
  applyRivers(graph, config.rivers)
  applyClimate(graph, config.climate)
  applyBiomes(graph, config.biomes)
  return graph
}
