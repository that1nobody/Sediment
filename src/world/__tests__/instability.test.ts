import { generateWorldGraph } from '../generateWorldGraph'
import { applyElevation } from '../elevation'
import { applyRivers } from '../rivers'
import { applyClimate } from '../climate'
import { applyBiomes } from '../biomes'
import { applyCivilizations } from '../civilizations'
import { applyInstability } from '../instability'
import { mulberry32 } from '../rng'
import type { Cell, WorldGraph } from '../types'

// ---------------------------------------------------------------------------
// Helper: run pipeline up to and including civilizations
// ---------------------------------------------------------------------------

function buildGraph(cellCount = 240, seed = 5): WorldGraph {
  const graph = generateWorldGraph({ width: 1000, height: 800, cellCount, seed })
  applyElevation(graph, graph.seed)
  applyRivers(graph)
  applyClimate(graph)
  applyBiomes(graph)
  applyCivilizations(graph, mulberry32(graph.seed ^ 0xdeadbeef))
  return graph
}

describe('applyInstability', () => {
  test('instability is in [0, 1] for all cells', () => {
    const graph = buildGraph(260, 17)
    applyInstability(graph)

    graph.cells.forEach(cell => {
      expect(cell.instability).toBeDefined()
      expect(cell.instability!).toBeGreaterThanOrEqual(0)
      expect(cell.instability!).toBeLessThanOrEqual(1)
    })
  })

  test('unclaimed cells receive instability of 0', () => {
    const graph = buildGraph(200, 21)
    applyInstability(graph)

    graph.cells
      .filter(c => c.civilization === undefined)
      .forEach(c => expect(c.instability).toBe(0))
  })

  test('frontier cells have elevated instability relative to interior cells', () => {
    const graph = buildGraph(350, 13)
    applyInstability(graph)

    const frontier = graph.cells.filter(c =>
      c.civilization !== undefined &&
      c.neighbors.some(nid => {
        const nciv = graph.cells[nid].civilization
        return nciv !== undefined && nciv !== c.civilization
      }),
    )
    const interior = graph.cells.filter(c =>
      c.civilization !== undefined &&
      !c.neighbors.some(nid => {
        const nciv = graph.cells[nid].civilization
        return nciv !== undefined && nciv !== c.civilization
      }),
    )

    if (frontier.length > 0 && interior.length > 0) {
      const avgFrontier = frontier.reduce((s, c) => s + c.instability!, 0) / frontier.length
      const avgInterior = interior.reduce((s, c) => s + c.instability!, 0) / interior.length
      expect(avgFrontier).toBeGreaterThan(avgInterior)
    }
  })

  test('dry settled cells have non-zero instability (famine driver)', () => {
    // Construct a minimal settled cell with very low moisture
    const cells: Cell[] = [
      {
        id: 0, x: 0, y: 0, neighbors: [],
        elevation: 0.5, moisture: 0.05, temperature: 0.5, biome: 'desert',
        civilization: 0, population: 0.5,
      },
    ]
    const graph: WorldGraph = { seed: 1, width: 10, height: 10, cells, edges: [], corners: [], events: [] }
    applyInstability(graph, { famineThreshold: 0.30 })
    expect(graph.cells[0].instability).toBeGreaterThan(0)
  })

  test('is deterministic', () => {
    const graph1 = buildGraph(200, 8)
    const graph2 = buildGraph(200, 8)
    applyInstability(graph1)
    applyInstability(graph2)

    graph1.cells.forEach((c, i) => {
      expect(c.instability).toBe(graph2.cells[i].instability)
    })
  })

  test('empty graph does not throw', () => {
    const graph: WorldGraph = { seed: 1, width: 10, height: 10, cells: [], edges: [], corners: [], events: [] }
    expect(() => applyInstability(graph)).not.toThrow()
  })
})
