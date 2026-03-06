import { generateWorldGraph } from '../generateWorldGraph'
import { applyElevation } from '../elevation'
import type { WorldGraph } from '../generateWorldGraph'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildGraph(cellCount = 80, seed = 42): WorldGraph {
  return generateWorldGraph({ width: 1000, height: 800, cellCount, seed })
}

// ---------------------------------------------------------------------------
// Basic output guarantees
// ---------------------------------------------------------------------------

describe('applyElevation — output range', () => {
  let graph: WorldGraph

  beforeAll(() => {
    graph = buildGraph()
    applyElevation(graph, graph.seed)
  })

  test('every cell has an elevation value after the call', () => {
    graph.cells.forEach(c => {
      expect(c.elevation).toBeDefined()
    })
  })

  test('all elevation values are in [0, 1]', () => {
    graph.cells.forEach(c => {
      expect(c.elevation!).toBeGreaterThanOrEqual(0)
      expect(c.elevation!).toBeLessThanOrEqual(1)
    })
  })

  test('at least one cell has elevation 0 (lowest point)', () => {
    const min = Math.min(...graph.cells.map(c => c.elevation!))
    expect(min).toBeCloseTo(0, 10)
  })

  test('at least one cell has elevation 1 (highest point)', () => {
    const max = Math.max(...graph.cells.map(c => c.elevation!))
    expect(max).toBeCloseTo(1, 10)
  })

  test('elevation values are not all identical (non-degenerate field)', () => {
    const values = new Set(graph.cells.map(c => c.elevation!))
    expect(values.size).toBeGreaterThan(1)
  })
})

// ---------------------------------------------------------------------------
// Spatial coherence
// ---------------------------------------------------------------------------

describe('applyElevation — spatial coherence', () => {
  test('neighbouring cells differ by less than 0.5 (no impossible cliffs)', () => {
    const graph = buildGraph(100, 7)
    applyElevation(graph, graph.seed)

    graph.cells.forEach(cell => {
      cell.neighbors.forEach(nid => {
        const diff = Math.abs(cell.elevation! - graph.cells[nid].elevation!)
        expect(diff).toBeLessThan(0.5)
      })
    })
  })
})

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('applyElevation — determinism', () => {
  test('same seed and config produce identical elevation fields', () => {
    const g1 = buildGraph(60, 99)
    const g2 = buildGraph(60, 99)
    applyElevation(g1, g1.seed)
    applyElevation(g2, g2.seed)
    const e1 = g1.cells.map(c => c.elevation)
    const e2 = g2.cells.map(c => c.elevation)
    expect(e1).toEqual(e2)
  })

  test('different seeds produce different elevation fields', () => {
    const g1 = buildGraph(60, 1)
    const g2 = buildGraph(60, 2)
    applyElevation(g1, g1.seed)
    applyElevation(g2, g2.seed)
    const e1 = g1.cells.map(c => c.elevation)
    const e2 = g2.cells.map(c => c.elevation)
    expect(e1).not.toEqual(e2)
  })
})

// ---------------------------------------------------------------------------
// Config parameters
// ---------------------------------------------------------------------------

describe('applyElevation — config parameters', () => {
  test('scale parameter changes the resulting field', () => {
    const g1 = buildGraph(60, 5)
    const g2 = buildGraph(60, 5)
    applyElevation(g1, g1.seed, { scale: 1.0 })
    applyElevation(g2, g2.seed, { scale: 3.0 })
    const e1 = g1.cells.map(c => c.elevation)
    const e2 = g2.cells.map(c => c.elevation)
    expect(e1).not.toEqual(e2)
  })

  test('octaves parameter changes the resulting field', () => {
    const g1 = buildGraph(60, 5)
    const g2 = buildGraph(60, 5)
    applyElevation(g1, g1.seed, { octaves: 2 })
    applyElevation(g2, g2.seed, { octaves: 8 })
    const e1 = g1.cells.map(c => c.elevation)
    const e2 = g2.cells.map(c => c.elevation)
    expect(e1).not.toEqual(e2)
  })

  test('default config (no options) runs without error', () => {
    const graph = buildGraph(50, 3)
    expect(() => applyElevation(graph, graph.seed)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('applyElevation — edge cases', () => {
  test('does nothing on a graph with 0 cells', () => {
    const graph = generateWorldGraph({ width: 100, height: 100, cellCount: 0, seed: 1 })
    expect(() => applyElevation(graph, graph.seed)).not.toThrow()
    expect(graph.cells).toHaveLength(0)
  })

  test('assigns valid elevation to a single-cell graph', () => {
    const graph = generateWorldGraph({ width: 100, height: 100, cellCount: 1, seed: 1 })
    applyElevation(graph, graph.seed)
    // With one cell, range is 0 → elevation defaults to 0.5
    expect(graph.cells[0].elevation).toBe(0.5)
  })

  test('elevation values are finite for very large worlds', () => {
    const graph = generateWorldGraph({ width: 100_000, height: 100_000, cellCount: 50, seed: 1 })
    applyElevation(graph, graph.seed)
    graph.cells.forEach(c => {
      expect(Number.isFinite(c.elevation!)).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// Distribution (sanity check for terrain variety)
// ---------------------------------------------------------------------------

describe('applyElevation — distribution', () => {
  test('a standard world has both high-elevation and low-elevation cells', () => {
    const graph = buildGraph(200, 11)
    applyElevation(graph, graph.seed)

    const lowCells = graph.cells.filter(c => c.elevation! < 0.4).length
    const highCells = graph.cells.filter(c => c.elevation! > 0.6).length

    // With 200 cells the distribution should not be degenerate in either direction.
    expect(lowCells).toBeGreaterThan(10)
    expect(highCells).toBeGreaterThan(10)
  })
})
