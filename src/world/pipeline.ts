import { generateWorldGraph, type WorldConfig, type WorldGraph } from './generateWorldGraph'
import { applyElevation, type ElevationConfig } from './elevation'
import { applyRivers, type RiverConfig } from './rivers'
import { applyClimate, type ClimateConfig } from './climate'
import { applyBiomes, type BiomeConfig } from './biomes'
import { applyCivilizations, type CivilizationConfig } from './civilizations'
import { applyInstability, type InstabilityConfig } from './instability'
import { applyEvents, type EventConfig } from './events'
import { applyOrganizations, type OrganizationConfig } from './organizations'
import { applyAnomalies, type AnomalyConfig } from './anomalies'
import { applyRegisters, type RegisterConfig } from './registers'
import { assembleChronicle, type ChronicleConfig } from './chronicle'
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
  organizations?: OrganizationConfig
  anomalies?: AnomalyConfig
  registers?: RegisterConfig
  chronicle?: ChronicleConfig
}

/**
 * Runs the full generation pipeline end-to-end.
 *
 * Pipeline order (GDD §3, with Organizations inserted between events and anomalies):
 *   Poisson → Voronoi → elevation → rivers → climate → biomes →
 *   civilizations → instability → events → organizations → anomalies →
 *   registers → chronicle
 */
export function generateWorld(config: WorldPipelineConfig): WorldGraph {
  const graph = generateWorldGraph(config.world)
  applyElevation(graph, graph.seed, config.elevation)
  applyRivers(graph, config.rivers)
  applyClimate(graph, config.climate)
  applyBiomes(graph, config.biomes)

  // Two RNG streams: placement (civs, orgs, anomalies) and event logic.
  const rngPlacement = mulberry32(graph.seed ^ 0xdeadbeef)
  const rngEvents    = mulberry32(graph.seed ^ 0xcafebabe)

  applyCivilizations(graph, rngPlacement, config.civilizations)
  applyInstability(graph, config.instability)
  applyEvents(graph, rngEvents, config.events)
  applyOrganizations(graph, rngPlacement, config.organizations)
  applyAnomalies(graph, rngPlacement, config.anomalies)
  applyRegisters(graph, config.registers)
  assembleChronicle(graph, config.chronicle)

  return graph
}
