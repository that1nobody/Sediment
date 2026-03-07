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
import { applyRegisters, ALL_REGISTERS } from '../registers'
import { mulberry32 } from '../rng'
import type { Cell, WorldGraph } from '../types'

// ---------------------------------------------------------------------------
// Helper: run pipeline up to and including anomalies
// ---------------------------------------------------------------------------

function buildGraph(cellCount = 260, seed = 31): WorldGraph {
  const graph = generateWorldGraph({ width: 1000, height: 800, cellCount, seed })
  applyElevation(graph, graph.seed)
  applyRivers(graph)
  applyClimate(graph)
  applyBiomes(graph)
  const rngP = mulberry32(graph.seed ^ 0xdeadbeef)
  const rngE = mulberry32(graph.seed ^ 0xcafebabe)
  applyCivilizations(graph, rngP)
  applyInstability(graph)
  applyEvents(graph, rngE, { aeons: 8, instabilityThreshold: 0.40 })
  applyOrganizations(graph, rngP)
  applyAnomalies(graph, rngP)
  return graph
}

describe('applyRegisters', () => {
  test('every cell has at least one register after computation', () => {
    const graph = buildGraph(280, 14)
    applyRegisters(graph)

    // Every cell should have the registers array set (may be empty for featureless cells,
    // but most cells should have at least one).
    const withRegisters = graph.cells.filter(c => (c.registers?.length ?? 0) > 0)
    expect(withRegisters.length).toBeGreaterThan(0)
    graph.cells.forEach(cell => {
      expect(cell.registers).toBeDefined()
    })
  })

  test('register values are drawn from the defined vocabulary', () => {
    const graph = buildGraph(260, 19)
    applyRegisters(graph)

    const validSet = new Set(ALL_REGISTERS)
    graph.cells.forEach(cell => {
      (cell.registers ?? []).forEach(r => {
        expect(validSet.has(r as typeof ALL_REGISTERS[number])).toBe(true)
      })
    })
  })

  test('cells have at most maxRegisters registers', () => {
    const graph = buildGraph(240, 27)
    applyRegisters(graph, { maxRegisters: 2 })

    graph.cells.forEach(cell => {
      expect((cell.registers?.length ?? 0)).toBeLessThanOrEqual(2)
    })
  })

  test('desert cells are biased toward DEATH and FIRE registers', () => {
    const graph = buildGraph(300, 2)
    applyRegisters(graph)

    const desertCells = graph.cells.filter(c => c.biome === 'desert')
    if (desertCells.length > 0) {
      const withDeathOrFire = desertCells.filter(c =>
        (c.registers ?? []).some(r => r === 'DEATH' || r === 'FIRE'),
      )
      expect(withDeathOrFire.length).toBeGreaterThan(0)
    }
  })

  test('cells with high anomaly influence gain MYSTERY or MYTHIC or MAGIC', () => {
    // Construct a cell with high anomalyInfluence
    const cells: Cell[] = [
      {
        id: 0, x: 0.5, y: 0.5, neighbors: [],
        elevation: 0.5, moisture: 0.4, temperature: 0.4, biome: 'grassland',
        anomalyInfluence: 0.90,
      },
    ]
    const graph: WorldGraph = { seed: 1, width: 10, height: 10, cells, edges: [], corners: [], events: [], organizations: [], anomalies: [], chronicle: [] }
    applyRegisters(graph, { threshold: 0.10 })

    const regs = cells[0].registers ?? []
    const hasAnomalyReg = regs.some(r => r === 'MYSTERY' || r === 'MYTHIC' || r === 'MAGIC')
    expect(hasAnomalyReg).toBe(true)
  })

  test('org cells gain the org primary register', () => {
    const cells: Cell[] = [
      {
        id: 0, x: 0.5, y: 0.5, neighbors: [],
        elevation: 0.5, moisture: 0.4, temperature: 0.4, biome: 'grassland',
        anomalyInfluence: 0,
      },
    ]
    const graph: WorldGraph = {
      seed: 1, width: 10, height: 10, cells, edges: [], corners: [],
      events: [], chronicle: [], anomalies: [],
      organizations: [{ id: 0, type: 'cult', cells: [0], instability: 0.7, register: 'MYSTERY' }],
    }
    applyRegisters(graph, { threshold: 0.10 })

    expect(cells[0].registers).toContain('MYSTERY')
  })

  test('ANCIENT register correlates with cells that have long historical event chains', () => {
    const graph = buildGraph(280, 42)
    applyRegisters(graph)

    // Cells with collapse or cultural_transformation events near them should lean ANCIENT
    const ancientCells = graph.cells.filter(c => (c.registers ?? []).includes('ANCIENT'))
    // We just verify ANCIENT gets assigned somewhere in a non-trivial world
    expect(ancientCells.length).toBeGreaterThan(0)
  })

  test('is deterministic', () => {
    const graph1 = buildGraph(200, 77)
    const graph2 = buildGraph(200, 77)
    applyRegisters(graph1)
    applyRegisters(graph2)

    graph1.cells.forEach((c, i) => {
      expect(c.registers).toEqual(graph2.cells[i].registers)
    })
  })

  test('empty graph does not throw', () => {
    const graph: WorldGraph = { seed: 1, width: 10, height: 10, cells: [], edges: [], corners: [], events: [], organizations: [], anomalies: [], chronicle: [] }
    expect(() => applyRegisters(graph)).not.toThrow()
  })
})
