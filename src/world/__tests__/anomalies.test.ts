import { generateWorldGraph } from '../generateWorldGraph'
import { applyElevation } from '../elevation'
import { applyRivers } from '../rivers'
import { applyClimate } from '../climate'
import { applyBiomes } from '../biomes'
import { applyCivilizations } from '../civilizations'
import { applyInstability } from '../instability'
import { applyEvents } from '../events'
import { applyOrganizations } from '../organizations'
import { applyAnomalies } from '../anomalies'
import { mulberry32 } from '../rng'
import type { Cell, WorldGraph } from '../types'

// ---------------------------------------------------------------------------
// Helper: run pipeline up to and including organizations
// ---------------------------------------------------------------------------

function buildGraph(cellCount = 260, seed = 22): WorldGraph {
  const graph = generateWorldGraph({ width: 1000, height: 800, cellCount, seed })
  applyElevation(graph, graph.seed)
  applyRivers(graph)
  applyClimate(graph)
  applyBiomes(graph)
  const rngP = mulberry32(graph.seed ^ 0xdeadbeef)
  const rngE = mulberry32(graph.seed ^ 0xcafebabe)
  applyCivilizations(graph, rngP)
  applyInstability(graph)
  applyEvents(graph, rngE, { aeons: 10, instabilityThreshold: 0.40 })
  applyOrganizations(graph, rngP)
  return graph
}

describe('applyAnomalies', () => {
  test('primordial anomaly count is approximately density × cell count (±20%)', () => {
    const graph = buildGraph(300, 3)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    const density = 0.03
    applyAnomalies(graph, rng, { primordialDensity: density })

    const primordials = graph.anomalies.filter(a => a.origin === 'primordial')
    // Use the actual cell count (Poisson sampling is approximate, not exactly cellCount)
    const expected = Math.round(density * graph.cells.length)
    expect(primordials.length).toBeGreaterThanOrEqual(Math.floor(expected * 0.80))
    expect(primordials.length).toBeLessThanOrEqual(Math.ceil(expected * 1.20))
  })

  test('emergent anomalies are only created by mythic events (load > threshold)', () => {
    const graph = buildGraph(280, 17)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    const threshold = 0.66
    applyAnomalies(graph, rng, { emergentThreshold: threshold })

    const emergents = graph.anomalies.filter(a => a.origin === 'emergent')
    const mythicEvents = graph.events.filter(e => e.load > threshold)
    expect(emergents.length).toBe(mythicEvents.length)
  })

  test('primordial anomalies are placed on non-ocean cells', () => {
    const graph = buildGraph(260, 8)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    applyAnomalies(graph, rng)

    const primordials = graph.anomalies.filter(a => a.origin === 'primordial')
    primordials.forEach(a => {
      expect(graph.cells[a.cellId].ocean).not.toBe(true)
    })
  })

  test('anomaly influence radius does not extend beyond world bounds (all influences ∈ [0, 1])', () => {
    const graph = buildGraph(240, 5)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    applyAnomalies(graph, rng)

    graph.cells.forEach(cell => {
      expect(cell.anomalyInfluence).toBeDefined()
      expect(cell.anomalyInfluence!).toBeGreaterThanOrEqual(0)
      expect(cell.anomalyInfluence!).toBeLessThanOrEqual(1)
    })
  })

  test('anomaly origin cell has higher influence than a distant cell', () => {
    // Build a minimal linear graph: 0 — 1 — 2 — 3
    const cells: Cell[] = Array.from({ length: 4 }, (_, i) => ({
      id: i, x: i, y: 0, neighbors: [i - 1, i + 1].filter(n => n >= 0 && n <= 3),
      elevation: 0.5, ocean: false, moisture: 0.5, temperature: 0.5, biome: 'grassland',
    }))
    // Pre-inject a single anomaly at cell 0 so the test controls exactly one signal.
    // Call applyAnomalies with density=0 and threshold=2.0 so no new ones are added —
    // it only resets influence and runs BFS over the pre-existing anomaly.
    const graph: WorldGraph = {
      seed: 1, width: 10, height: 10, cells, edges: [], corners: [],
      events: [], organizations: [], chronicle: [],
      anomalies: [{ id: 0, cellId: 0, origin: 'primordial', radius: 2, signal: 1.0 }],
    }
    const rng = mulberry32(1)
    applyAnomalies(graph, rng, { primordialDensity: 0, emergentThreshold: 2.0, influenceRadius: 2 })

    // Cell 0 (origin): signal 1.0; Cell 2 (dist 2): 1.0 * (1 - 2/3) ≈ 0.333
    expect(cells[0].anomalyInfluence!).toBeGreaterThan(cells[2].anomalyInfluence!)
  })

  test('is deterministic given the same seed', () => {
    const graph1 = buildGraph(200, 6)
    const graph2 = buildGraph(200, 6)

    applyAnomalies(graph1, mulberry32(graph1.seed ^ 0xdeadbeef))
    applyAnomalies(graph2, mulberry32(graph2.seed ^ 0xdeadbeef))

    expect(graph1.anomalies.length).toBe(graph2.anomalies.length)
    graph1.cells.forEach((c, i) => {
      expect(c.anomalyInfluence).toBe(graph2.cells[i].anomalyInfluence)
    })
  })

  test('empty graph does not throw', () => {
    const graph: WorldGraph = { seed: 1, width: 10, height: 10, cells: [], edges: [], corners: [], events: [], organizations: [], anomalies: [], chronicle: [] }
    const rng = mulberry32(1)
    expect(() => applyAnomalies(graph, rng)).not.toThrow()
  })
})
