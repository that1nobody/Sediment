import { generateWorldGraph } from '../generateWorldGraph'
import { applyElevation } from '../elevation'
import { applyRivers } from '../rivers'
import type { WorldGraph } from '../generateWorldGraph'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildWorld(cellCount = 120, seed = 42): WorldGraph {
  const graph = generateWorldGraph({ width: 1000, height: 800, cellCount, seed })
  applyElevation(graph, graph.seed)
  applyRivers(graph)
  return graph
}

// ---------------------------------------------------------------------------
// All fields populated
// ---------------------------------------------------------------------------

describe('applyRivers — fields populated', () => {
  let graph: WorldGraph

  beforeAll(() => { graph = buildWorld() })

  test('every cell has ocean set', () => {
    graph.cells.forEach(c => expect(typeof c.ocean).toBe('boolean'))
  })

  test('every cell has a drainage value', () => {
    graph.cells.forEach(c => {
      expect(c.drainage).toBeDefined()
      expect(Number.isFinite(c.drainage!)).toBe(true)
    })
  })

  test('every cell has river set', () => {
    graph.cells.forEach(c => expect(typeof c.river).toBe('boolean'))
  })

  test('every cell has a watershed value', () => {
    graph.cells.forEach(c => {
      expect(c.watershed).toBeDefined()
      expect(Number.isFinite(c.watershed!)).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// Ocean / land classification
// ---------------------------------------------------------------------------

describe('applyRivers — ocean classification', () => {
  const SEA_LEVEL = 0.4

  test('cells below sea level are ocean', () => {
    const graph = buildWorld()
    graph.cells
      .filter(c => c.elevation! < SEA_LEVEL)
      .forEach(c => expect(c.ocean).toBe(true))
  })

  test('cells at or above sea level are not ocean', () => {
    const graph = buildWorld()
    graph.cells
      .filter(c => c.elevation! >= SEA_LEVEL)
      .forEach(c => expect(c.ocean).toBe(false))
  })

  test('ocean cells have no flowsTo (they are sinks)', () => {
    const graph = buildWorld()
    graph.cells
      .filter(c => c.ocean)
      .forEach(c => expect(c.flowsTo).toBeUndefined())
  })
})

// ---------------------------------------------------------------------------
// Flow direction — downhill invariant
// ---------------------------------------------------------------------------

describe('applyRivers — flow direction', () => {
  test('every flowsTo target has lower or equal elevation than the source', () => {
    const graph = buildWorld()
    graph.cells.forEach(cell => {
      if (cell.flowsTo === undefined) return
      expect(graph.cells[cell.flowsTo].elevation!).toBeLessThanOrEqual(cell.elevation! + 1e-10)
    })
  })

  test('flowsTo references a valid cell id', () => {
    const graph = buildWorld()
    const n = graph.cells.length
    graph.cells.forEach(cell => {
      if (cell.flowsTo !== undefined) {
        expect(cell.flowsTo).toBeGreaterThanOrEqual(0)
        expect(cell.flowsTo).toBeLessThan(n)
      }
    })
  })

  test('a cell does not flow to itself', () => {
    const graph = buildWorld()
    graph.cells.forEach(cell => {
      expect(cell.flowsTo).not.toBe(cell.id)
    })
  })
})

// ---------------------------------------------------------------------------
// Flow accumulation
// ---------------------------------------------------------------------------

describe('applyRivers — flow accumulation', () => {
  test('all drainage values are in (0, 1]', () => {
    const graph = buildWorld()
    graph.cells.forEach(c => {
      expect(c.drainage!).toBeGreaterThan(0)
      expect(c.drainage!).toBeLessThanOrEqual(1)
    })
  })

  test('at least one cell has drainage 1.0 (the most-drained sink)', () => {
    const graph = buildWorld()
    const max = Math.max(...graph.cells.map(c => c.drainage!))
    expect(max).toBeCloseTo(1, 10)
  })

  test('a sink cell has the highest drainage in its watershed', () => {
    const graph = buildWorld()
    // Sinks are cells where flowsTo is undefined.
    const sinks = graph.cells.filter(c => c.flowsTo === undefined)
    sinks.forEach(sink => {
      const basinCells = graph.cells.filter(c => c.watershed === sink.id)
      basinCells.forEach(c => {
        expect(sink.drainage!).toBeGreaterThanOrEqual(c.drainage! - 1e-10)
      })
    })
  })

  test('drainage accumulates: downstream cells have higher drainage than upstream', () => {
    const graph = buildWorld(200, 7)
    // Follow one chain: pick a river cell and verify its downstream neighbour
    // has strictly higher or equal drainage.
    const rivers = graph.cells.filter(c => c.river && c.flowsTo !== undefined)
    rivers.forEach(cell => {
      const down = graph.cells[cell.flowsTo!]
      expect(down.drainage!).toBeGreaterThanOrEqual(cell.drainage! - 1e-10)
    })
  })
})

// ---------------------------------------------------------------------------
// River channels
// ---------------------------------------------------------------------------

describe('applyRivers — river channels', () => {
  test('river cells are land cells (not ocean)', () => {
    const graph = buildWorld()
    graph.cells
      .filter(c => c.river)
      .forEach(c => expect(c.ocean).toBe(false))
  })

  test('river cells have drainage above the default threshold (0.05)', () => {
    const graph = buildWorld()
    graph.cells
      .filter(c => c.river)
      .forEach(c => expect(c.drainage!).toBeGreaterThan(0.05))
  })

  test('non-river land cells have drainage at or below the threshold', () => {
    const graph = buildWorld()
    graph.cells
      .filter(c => !c.river && !c.ocean)
      .forEach(c => expect(c.drainage!).toBeLessThanOrEqual(0.05 + 1e-10))
  })

  test('at least one river cell exists in a typical world', () => {
    const graph = buildWorld(200, 3)
    const riverCount = graph.cells.filter(c => c.river).length
    expect(riverCount).toBeGreaterThan(0)
  })

  test('custom riverThreshold changes which cells are rivers', () => {
    const g1 = generateWorldGraph({ width: 1000, height: 800, cellCount: 100, seed: 5 })
    const g2 = generateWorldGraph({ width: 1000, height: 800, cellCount: 100, seed: 5 })
    applyElevation(g1, g1.seed); applyRivers(g1, { riverThreshold: 0.02 })
    applyElevation(g2, g2.seed); applyRivers(g2, { riverThreshold: 0.20 })
    const r1 = g1.cells.filter(c => c.river).length
    const r2 = g2.cells.filter(c => c.river).length
    expect(r1).toBeGreaterThan(r2)
  })
})

// ---------------------------------------------------------------------------
// Watersheds
// ---------------------------------------------------------------------------

describe('applyRivers — watersheds', () => {
  test('every watershed id is the id of an actual sink cell', () => {
    const graph = buildWorld()
    const sinkIds = new Set(
      graph.cells.filter(c => c.flowsTo === undefined).map(c => c.id)
    )
    graph.cells.forEach(c => {
      expect(sinkIds.has(c.watershed!)).toBe(true)
    })
  })

  test('sink cells belong to their own watershed', () => {
    const graph = buildWorld()
    graph.cells
      .filter(c => c.flowsTo === undefined)
      .forEach(c => expect(c.watershed).toBe(c.id))
  })

  test('all cells in a watershed trace to the same sink', () => {
    const graph = buildWorld(150, 11)
    function traceSink(id: number): number {
      let cur = id, steps = 0
      while (graph.cells[cur].flowsTo !== undefined && steps++ < graph.cells.length) {
        cur = graph.cells[cur].flowsTo!
      }
      return cur
    }
    graph.cells.forEach(cell => {
      expect(traceSink(cell.id)).toBe(cell.watershed)
    })
  })

  test('there are at least 2 distinct watersheds in a typical world', () => {
    const graph = buildWorld(200, 13)
    const wsIds = new Set(graph.cells.map(c => c.watershed))
    expect(wsIds.size).toBeGreaterThanOrEqual(2)
  })

  test('custom seaLevel changes the ocean classification', () => {
    const g1 = generateWorldGraph({ width: 1000, height: 800, cellCount: 100, seed: 9 })
    const g2 = generateWorldGraph({ width: 1000, height: 800, cellCount: 100, seed: 9 })
    applyElevation(g1, g1.seed); applyRivers(g1, { seaLevel: 0.2 })
    applyElevation(g2, g2.seed); applyRivers(g2, { seaLevel: 0.6 })
    const ocean1 = g1.cells.filter(c => c.ocean).length
    const ocean2 = g2.cells.filter(c => c.ocean).length
    expect(ocean2).toBeGreaterThan(ocean1)
  })
})

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe('applyRivers — determinism', () => {
  test('same seed produces identical river fields', () => {
    const g1 = buildWorld(80, 77)
    const g2 = buildWorld(80, 77)
    expect(g1.cells.map(c => c.river)).toEqual(g2.cells.map(c => c.river))
    expect(g1.cells.map(c => c.drainage)).toEqual(g2.cells.map(c => c.drainage))
    expect(g1.cells.map(c => c.watershed)).toEqual(g2.cells.map(c => c.watershed))
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('applyRivers — edge cases', () => {
  test('does nothing on an empty graph', () => {
    const graph = generateWorldGraph({ width: 100, height: 100, cellCount: 0, seed: 1 })
    applyElevation(graph, graph.seed)
    expect(() => applyRivers(graph)).not.toThrow()
  })

  test('all-ocean world (seaLevel above max elevation) has no rivers', () => {
    // Elevation is normalised to [0, 1]; using 1.1 guarantees all cells are ocean.
    const graph = generateWorldGraph({ width: 1000, height: 800, cellCount: 80, seed: 3 })
    applyElevation(graph, graph.seed)
    applyRivers(graph, { seaLevel: 1.1 })
    expect(graph.cells.every(c => c.ocean)).toBe(true)
    expect(graph.cells.every(c => !c.river)).toBe(true)
  })

  test('all-land world (seaLevel: 0.0) flows entirely on land', () => {
    const graph = generateWorldGraph({ width: 1000, height: 800, cellCount: 80, seed: 3 })
    applyElevation(graph, graph.seed)
    applyRivers(graph, { seaLevel: 0.0 })
    expect(graph.cells.every(c => !c.ocean)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// No-cycle guarantee
// ---------------------------------------------------------------------------

describe('applyRivers — acyclicity', () => {
  test('flow graph has no cycles (following flowsTo always reaches a sink)', () => {
    const graph = buildWorld(150, 21)
    const n = graph.cells.length

    graph.cells.forEach(cell => {
      // Walk the flow chain; a cycle would require more than n steps.
      let cur = cell.id, steps = 0
      while (graph.cells[cur].flowsTo !== undefined) {
        cur = graph.cells[cur].flowsTo!
        steps++
        expect(steps).toBeLessThan(n)
      }
    })
  })
})
