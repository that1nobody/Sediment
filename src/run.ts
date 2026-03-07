import * as fs from 'fs'
import * as path from 'path'
import { generateWorld } from './world/pipeline'
import { exportWorldState } from './world/export'

// When compiled, this file lands at dist/run.js; data/ is two levels up.
const DATA_DIR = path.resolve(__dirname, '..', 'data')

interface WorldgenConfig {
  world?: { cell_count?: number; seed?: number | null }
  history?: {
    aeons?: number
    instability_threshold?: number
    instability_decay?: number
    instability_accumulation_rate?: number
  }
  terrain?: { elevation_noise_scale?: number }
  anomalies?: { initial_density?: number }
  organizations?: { max_organizations?: number; org_spread?: number }
  chronicle?: { min_load?: number }
}

function readConfig(): WorldgenConfig {
  const raw = fs.readFileSync(path.join(DATA_DIR, 'worldgen_config.json'), 'utf-8')
  return JSON.parse(raw) as WorldgenConfig
}

function main(): void {
  const cfg = readConfig()

  const cellCount = cfg.world?.cell_count ?? 2000
  const rawSeed   = cfg.world?.seed

  const world = generateWorld({
    world: {
      width: 1200,
      height: 900,
      cellCount,
      seed: rawSeed !== null && rawSeed !== undefined ? rawSeed : undefined,
    },
    events: {
      aeons:              cfg.history?.aeons                       ?? 50,
      instabilityThreshold: cfg.history?.instability_threshold     ?? 0.60,
      instabilityDecay:     cfg.history?.instability_decay         ?? 0.50,
      accumulationRate:     cfg.history?.instability_accumulation_rate ?? 0,
    },
    anomalies: {
      primordialDensity: cfg.anomalies?.initial_density ?? 0.01,
    },
    organizations: {
      maxOrganizations: cfg.organizations?.max_organizations ?? 12,
      orgSpread:        cfg.organizations?.org_spread        ?? 3,
    },
    chronicle: {
      minLoad: cfg.chronicle?.min_load ?? 0.33,
    },
  })

  const exported = exportWorldState(world)
  const outPath  = path.join(DATA_DIR, 'world_state.json')
  fs.writeFileSync(outPath, JSON.stringify(exported, null, 2), 'utf-8')

  console.log(`World generated (seed ${world.seed})`)
  console.log(`  Cells:            ${exported.summary.cell_count}`)
  console.log(`  Events:           ${exported.summary.event_count}`)
  console.log(`  Chronicle entries:${exported.summary.chronicle_count}`)
  console.log(`  Organizations:    ${exported.summary.organization_count}`)
  console.log(`  Anomalies:        ${exported.summary.anomaly_count}`)
  console.log(`  → ${outPath}`)
}

main()
