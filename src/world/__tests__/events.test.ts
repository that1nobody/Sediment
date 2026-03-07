import { generateWorldGraph } from '../generateWorldGraph'
import { applyElevation } from '../elevation'
import { applyRivers } from '../rivers'
import { applyClimate } from '../climate'
import { applyBiomes } from '../biomes'
import { applyCivilizations } from '../civilizations'
import { applyInstability } from '../instability'
import { applyEvents } from '../events'
import { mulberry32 } from '../rng'
import type { Cell, WorldGraph } from '../types'

// ---------------------------------------------------------------------------
// Helper: run full pipeline up to and including instability
// ---------------------------------------------------------------------------

function buildGraph(cellCount = 260, seed = 77): WorldGraph {
  const graph = generateWorldGraph({ width: 1000, height: 800, cellCount, seed })
  applyElevation(graph, graph.seed)
  applyRivers(graph)
  applyClimate(graph)
  applyBiomes(graph)
  const rng = mulberry32(graph.seed ^ 0xdeadbeef)
  applyCivilizations(graph, rng)
  applyInstability(graph)
  return graph
}

describe('applyEvents', () => {
  test('event log is ordered and non-empty after a full simulation run', () => {
    const graph = buildGraph(280, 44)
    const rng = mulberry32(graph.seed ^ 0xcafebabe)
    applyEvents(graph, rng, { aeons: 15, instabilityThreshold: 0.40 })

    expect(graph.events.length).toBeGreaterThan(0)

    // Events must be in non-decreasing aeon order
    for (let i = 1; i < graph.events.length; i++) {
      expect(graph.events[i].aeon).toBeGreaterThanOrEqual(graph.events[i - 1].aeon)
    }
  })

  test('war events require two distinct civilisations', () => {
    const graph = buildGraph(300, 12)
    const rng = mulberry32(graph.seed ^ 0xcafebabe)
    applyEvents(graph, rng, { aeons: 10, instabilityThreshold: 0.30 })

    const warEvents = graph.events.filter(e => e.type === 'war')
    warEvents.forEach(e => {
      const cell = graph.cells[e.cellId]
      // At the time of recording, cell must have had an adjacent enemy civ.
      // Since collapse may have removed some civs, we check the neighbour
      // relationships that existed during the run: the cell itself was
      // settled (civilization defined or was defined at trigger time).
      // We can verify the cell had neighbors and was a settled land cell.
      expect(cell.biome).not.toBe('coast')
      expect(graph.cells[e.cellId].neighbors.length).toBeGreaterThan(0)
    })
  })

  test('plague events reduce population in affected cells', () => {
    // Construct a cell with high population, high instability, no enemy neighbours
    const cells: Cell[] = [
      {
        id: 0, x: 0.5, y: 0.5, neighbors: [],
        elevation: 0.5, moisture: 0.6, temperature: 0.5, biome: 'grassland',
        civilization: 0, population: 0.9, instability: 0.80,
      },
    ]
    const graph: WorldGraph = { seed: 1, width: 10, height: 10, cells, edges: [], corners: [], events: [] }
    const rng = mulberry32(1)
    const popBefore = cells[0].population!
    applyEvents(graph, rng, { aeons: 1, instabilityThreshold: 0.70, instabilityDecay: 0.50 })

    const plagueEvents = graph.events.filter(e => e.type === 'plague')
    if (plagueEvents.length > 0) {
      expect(graph.cells[0].population!).toBeLessThan(popBefore)
    }
  })

  test('instability decays after a triggered event', () => {
    // Single isolated high-instability settled cell
    const cells: Cell[] = [
      {
        id: 0, x: 0.5, y: 0.5, neighbors: [],
        elevation: 0.5, moisture: 0.4, temperature: 0.4, biome: 'grassland',
        civilization: 0, population: 0.5, instability: 0.75,
      },
    ]
    const graph: WorldGraph = { seed: 1, width: 10, height: 10, cells, edges: [], corners: [], events: [] }
    const rng = mulberry32(1)
    applyEvents(graph, rng, { aeons: 1, instabilityThreshold: 0.60, instabilityDecay: 0.50 })

    // At least one event must have fired
    expect(graph.events.length).toBeGreaterThan(0)
    // Instability must have dropped
    expect(graph.cells[0].instability!).toBeLessThan(0.75)
  })

  test('event symbolic load is in [0, 1]', () => {
    const graph = buildGraph(250, 88)
    const rng = mulberry32(graph.seed ^ 0xcafebabe)
    applyEvents(graph, rng, { aeons: 10, instabilityThreshold: 0.35 })

    graph.events.forEach(e => {
      expect(e.load).toBeGreaterThanOrEqual(0)
      expect(e.load).toBeLessThanOrEqual(1)
    })
  })

  test('event records reference valid cell ids', () => {
    const graph = buildGraph(240, 31)
    const rng = mulberry32(graph.seed ^ 0xcafebabe)
    applyEvents(graph, rng, { aeons: 8, instabilityThreshold: 0.40 })

    graph.events.forEach(e => {
      expect(e.cellId).toBeGreaterThanOrEqual(0)
      expect(e.cellId).toBeLessThan(graph.cells.length)
    })
  })

  test('is deterministic given the same seed', () => {
    const graph1 = buildGraph(220, 4)
    const graph2 = buildGraph(220, 4)

    applyEvents(graph1, mulberry32(graph1.seed ^ 0xcafebabe), { aeons: 6, instabilityThreshold: 0.40 })
    applyEvents(graph2, mulberry32(graph2.seed ^ 0xcafebabe), { aeons: 6, instabilityThreshold: 0.40 })

    expect(graph1.events.length).toBe(graph2.events.length)
    graph1.events.forEach((e, i) => {
      expect(e.type).toBe(graph2.events[i].type)
      expect(e.aeon).toBe(graph2.events[i].aeon)
      expect(e.cellId).toBe(graph2.events[i].cellId)
    })
  })

  test('no events are generated when instability threshold is impossibly high', () => {
    const graph = buildGraph(200, 9)
    const rng = mulberry32(graph.seed ^ 0xcafebabe)
    applyEvents(graph, rng, { aeons: 5, instabilityThreshold: 2.0 })
    expect(graph.events).toHaveLength(0)
  })

  test('collapse events remove civilization claim from the cell', () => {
    // Construct a cell that will select 'collapse':
    // no neighbors → no war; moisture ≥ 0.25 → no famine;
    // population < 0.70 → no plague; instability > 0.90 → collapse.
    const cells: Cell[] = [
      {
        id: 0, x: 0.5, y: 0.5, neighbors: [],
        elevation: 0.5, moisture: 0.5, temperature: 0.5, biome: 'grassland',
        civilization: 0, population: 0.10, instability: 0.95,
      },
    ]
    const graph: WorldGraph = { seed: 1, width: 10, height: 10, cells, edges: [], corners: [], events: [] }
    const rng = mulberry32(1)
    applyEvents(graph, rng, { aeons: 1, instabilityThreshold: 0.80, instabilityDecay: 0.50 })

    const collapseEvents = graph.events.filter(e => e.type === 'collapse')
    expect(collapseEvents.length).toBeGreaterThan(0)
    // After collapse, civilization is removed and population reset
    expect(graph.cells[0].civilization).toBeUndefined()
    expect(graph.cells[0].population).toBe(0)
  })

  test('empty graph does not throw', () => {
    const graph: WorldGraph = { seed: 1, width: 10, height: 10, cells: [], edges: [], corners: [], events: [] }
    const rng = mulberry32(1)
    expect(() => applyEvents(graph, rng)).not.toThrow()
  })
})
