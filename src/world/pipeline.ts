import { generateWorldGraph, type WorldConfig, type WorldGraph } from './generateWorldGraph'
import { applyElevation, type ElevationConfig } from './elevation'
import { applyRivers, type RiverConfig } from './rivers'
import { applyClimate, type ClimateConfig } from './climate'
import { applyBiomes, type BiomeConfig } from './biomes'
import { applyCivilizations, type CivilizationConfig } from './civilizations'
import { applyInstability, type InstabilityConfig } from './instability'
import { applyEvents, type EventConfig } from './events'
import { mulberry32 } from './rng'

export interface WorldPipelineConfig {
  world: WorldConfig
  elevation?: ElevationConfig
  rivers?: RiverConfig
  climate?: ClimateConfig
  biomes?: BiomeConfig
  civilizations?: CivilizationConfig
  instability?: InstabilityConfig
  events?: EventConfig
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
  const rng = mulberry32(graph.seed ^ 0xdeadbeef)
  applyCivilizations(graph, rng, config.civilizations)
  applyInstability(graph, config.instability)
  applyEvents(graph, rng, config.events)
  return graph
}
