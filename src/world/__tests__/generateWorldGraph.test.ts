import {
  generateWorldGraph,
  WorldGraph,
  WorldConfig,
} from '../generateWorldGraph'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<WorldConfig> = {}): WorldConfig {
  return { width: 1000, height: 800, cellCount: 50, seed: 1, ...overrides }
}

// ---------------------------------------------------------------------------
// Output structure
// ---------------------------------------------------------------------------

describe('generateWorldGraph — output structure', () => {
  let graph: WorldGraph

  beforeAll(() => { graph = generateWorldGraph(makeConfig()) })

  test('returns cells, edges, corners, and seed fields', () => {
    expect(graph).toHaveProperty('cells')
    expect(graph).toHaveProperty('edges')
    expect(graph).toHaveProperty('corners')
    expect(graph).toHaveProperty('seed')
  })

  test('all four fields have the correct types', () => {
    expect(Array.isArray(graph.cells)).toBe(true)
    expect(Array.isArray(graph.edges)).toBe(true)
    expect(Array.isArray(graph.corners)).toBe(true)
    expect(typeof graph.seed).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// Cell properties
// ---------------------------------------------------------------------------

describe('generateWorldGraph — cell properties', () => {
  let graph: WorldGraph

  beforeAll(() => { graph = generateWorldGraph(makeConfig({ cellCount: 80, seed: 42 })) })

  test('cell ids are sequential starting at 0', () => {
    graph.cells.forEach((c, i) => expect(c.id).toBe(i))
  })

  test('all cell coordinates are finite numbers', () => {
    graph.cells.forEach(c => {
      expect(Number.isFinite(c.x)).toBe(true)
      expect(Number.isFinite(c.y)).toBe(true)
    })
  })

  test('all cell x coordinates are within [0, width)', () => {
    graph.cells.forEach(c => {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x).toBeLessThan(1000)
    })
  })

  test('all cell y coordinates are within [0, height)', () => {
    graph.cells.forEach(c => {
      expect(c.y).toBeGreaterThanOrEqual(0)
      expect(c.y).toBeLessThan(800)
    })
  })

  test('elevation, moisture, and biome are undefined before terrain generation', () => {
    graph.cells.forEach(c => {
      expect(c.elevation).toBeUndefined()
      expect(c.moisture).toBeUndefined()
      expect(c.biome).toBeUndefined()
    })
  })

  test('no two cells share the same (x, y) position', () => {
    const seen = new Set<string>()
    graph.cells.forEach(c => {
      const key = `${c.x},${c.y}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    })
  })
})

// ---------------------------------------------------------------------------
// Voronoi / Delaunay topology
// ---------------------------------------------------------------------------

describe('generateWorldGraph — graph topology', () => {
  let graph: WorldGraph

  beforeAll(() => { graph = generateWorldGraph(makeConfig({ cellCount: 60, seed: 7 })) })

  test('with ≥ 3 cells, edges and corners are non-empty', () => {
    expect(graph.edges.length).toBeGreaterThan(0)
    expect(graph.corners.length).toBeGreaterThan(0)
  })

  test('every edge references two distinct, valid cell ids', () => {
    const n = graph.cells.length
    graph.edges.forEach(e => {
      expect(e.cellA).toBeGreaterThanOrEqual(0)
      expect(e.cellB).toBeGreaterThanOrEqual(0)
      expect(e.cellA).toBeLessThan(n)
      expect(e.cellB).toBeLessThan(n)
      expect(e.cellA).not.toBe(e.cellB)
    })
  })

  test('every edge references two distinct, valid corner ids', () => {
    const m = graph.corners.length
    graph.edges.forEach(e => {
      expect(e.cornerA).toBeGreaterThanOrEqual(0)
      expect(e.cornerB).toBeGreaterThanOrEqual(0)
      expect(e.cornerA).toBeLessThan(m)
      expect(e.cornerB).toBeLessThan(m)
      expect(e.cornerA).not.toBe(e.cornerB)
    })
  })

  test('edge ids are sequential starting at 0', () => {
    graph.edges.forEach((e, i) => expect(e.id).toBe(i))
  })

  test('corner ids are sequential starting at 0', () => {
    graph.corners.forEach((c, i) => expect(c.id).toBe(i))
  })

  test('corner coordinates are finite numbers', () => {
    graph.corners.forEach(c => {
      expect(Number.isFinite(c.x)).toBe(true)
      expect(Number.isFinite(c.y)).toBe(true)
    })
  })

  test('neighbour relationship is symmetric', () => {
    const cells = graph.cells
    cells.forEach(c => {
      c.neighbors.forEach(nid => {
        expect(cells[nid].neighbors).toContain(c.id)
      })
    })
  })

  test('all neighbour ids reference valid cells', () => {
    const n = graph.cells.length
    graph.cells.forEach(c => {
      c.neighbors.forEach(nid => {
        expect(nid).toBeGreaterThanOrEqual(0)
        expect(nid).toBeLessThan(n)
      })
    })
  })

  test('no cell lists itself as a neighbour', () => {
    graph.cells.forEach(c => {
      expect(c.neighbors).not.toContain(c.id)
    })
  })

  test('every cell has at least one neighbour (no isolated cells)', () => {
    graph.cells.forEach(c => {
      expect(c.neighbors.length).toBeGreaterThan(0)
    })
  })
})

// ---------------------------------------------------------------------------
// Determinism (seed)
// ---------------------------------------------------------------------------

describe('generateWorldGraph — determinism', () => {
  test('same seed produces identical cell positions', () => {
    const a = generateWorldGraph(makeConfig({ seed: 999 }))
    const b = generateWorldGraph(makeConfig({ seed: 999 }))
    expect(a.cells.map(c => [c.x, c.y])).toEqual(b.cells.map(c => [c.x, c.y]))
  })

  test('same seed produces identical graph topology', () => {
    const a = generateWorldGraph(makeConfig({ seed: 999 }))
    const b = generateWorldGraph(makeConfig({ seed: 999 }))
    expect(a.edges).toEqual(b.edges)
    expect(a.corners).toEqual(b.corners)
    expect(a.cells.map(c => c.neighbors)).toEqual(b.cells.map(c => c.neighbors))
  })

  test('different seeds produce different cell positions (with overwhelming probability)', () => {
    const a = generateWorldGraph(makeConfig({ seed: 1 }))
    const b = generateWorldGraph(makeConfig({ seed: 2 }))
    const aPos = a.cells.map(c => `${c.x},${c.y}`).join(';')
    const bPos = b.cells.map(c => `${c.x},${c.y}`).join(';')
    expect(aPos).not.toBe(bPos)
  })

  test('seed field on WorldGraph matches the provided seed', () => {
    const graph = generateWorldGraph(makeConfig({ seed: 12345 }))
    expect(graph.seed).toBe(12345)
  })

  test('omitting seed still produces a valid graph with a recorded seed', () => {
    const graph = generateWorldGraph(makeConfig({ seed: undefined }))
    expect(typeof graph.seed).toBe('number')
    expect(Number.isFinite(graph.seed)).toBe(true)
    expect(graph.cells.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('generateWorldGraph — edge cases', () => {
  test('cellCount 0 returns empty arrays', () => {
    const graph = generateWorldGraph(makeConfig({ cellCount: 0 }))
    expect(graph.cells).toHaveLength(0)
    expect(graph.edges).toHaveLength(0)
    expect(graph.corners).toHaveLength(0)
  })

  test('cellCount 1 returns one cell and no edges', () => {
    const graph = generateWorldGraph(makeConfig({ cellCount: 1 }))
    expect(graph.cells).toHaveLength(1)
    expect(graph.edges).toHaveLength(0)
  })

  test('very small cellCount produces a valid (possibly minimal) graph', () => {
    // Poisson disk sampling is approximate: targetCount is not a hard upper bound.
    // With cellCount: 2 the minimum-distance radius is so large that the sampler
    // may still place a small handful of points.  Assert structure, not exact count.
    const graph = generateWorldGraph(makeConfig({ cellCount: 2 }))
    expect(graph.cells.length).toBeGreaterThan(0)
    graph.cells.forEach((c, i) => expect(c.id).toBe(i))
    expect(typeof graph.seed).toBe('number')
  })

  test('wide world produces valid graph', () => {
    const graph = generateWorldGraph(makeConfig({ width: 5000, height: 100, cellCount: 80 }))
    graph.cells.forEach(c => {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x).toBeLessThan(5000)
      expect(c.y).toBeGreaterThanOrEqual(0)
      expect(c.y).toBeLessThan(100)
    })
  })

  test('tall world produces valid graph', () => {
    const graph = generateWorldGraph(makeConfig({ width: 100, height: 5000, cellCount: 80 }))
    graph.cells.forEach(c => {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x).toBeLessThan(100)
      expect(c.y).toBeGreaterThanOrEqual(0)
      expect(c.y).toBeLessThan(5000)
    })
  })
})

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

describe('generateWorldGraph — performance', () => {
  test('generates a 2000-cell world (default config size) in under 2 s', () => {
    const start = performance.now()
    generateWorldGraph(makeConfig({ cellCount: 2000, seed: 1 }))
    expect(performance.now() - start).toBeLessThan(2000)
  })
})

// ---------------------------------------------------------------------------
// Future pipeline stages — placeholder suites
// ---------------------------------------------------------------------------

describe('Elevation field [FUTURE]', () => {
  test.todo('every cell elevation is in [0, 1] after terrain generation')
  test.todo('elevation is spatially coherent: neighbouring cells differ by less than a max slope')
  test.todo('elevation field is reproducible given the same seed')
  test.todo('mountain and ocean cells are distinguishable by threshold values')
})

describe('River and drainage system [FUTURE]', () => {
  test.todo('rivers only flow downhill')
  test.todo('every river terminates at the sea or a basin sink')
  test.todo('no river forms a cycle')
  test.todo('watershed partitions every cell into exactly one basin')
})

describe('Climate fields [FUTURE]', () => {
  test.todo('temperature decreases with elevation above a threshold')
  test.todo('moisture is higher within N cells of a river')
  test.todo('every cell has temperature and moisture values after climate computation')
})

describe('Biome classification [FUTURE]', () => {
  test.todo('every cell has a biome after classification')
  test.todo('biome values are drawn from the defined vocabulary')
  test.todo('cold-and-dry cells are not classified as wetland')
  test.todo('at least 4 distinct biomes exist in a standard 2000-cell world')
})

describe('Civilisation emergence [FUTURE]', () => {
  test.todo('civilisations only seed in cells meeting minimum habitability criteria')
  test.todo('civilisations expand only into adjacent cells')
  test.todo('no two civilisations can occupy the same cell simultaneously')
})

describe('Instability system [FUTURE]', () => {
  test.todo('instability exceeding a threshold triggers at least one event')
  test.todo('instability decays after a triggered event')
})

describe('Event simulation [FUTURE]', () => {
  test.todo('war events require two distinct civilisations')
  test.todo('plague events reduce population in affected cells')
  test.todo('event log is ordered and non-empty after a full simulation run')
})

describe('Anomaly system [FUTURE]', () => {
  test.todo('primordial anomaly count ≈ density × cell count (±10%)')
  test.todo('anomaly influence radius does not extend beyond world bounds')
  test.todo('emergent anomalies are only created by catastrophic events')
})

describe('Register calculation [FUTURE]', () => {
  test.todo('every cell has at least one register after computation')
  test.todo('registers are drawn from the defined vocabulary')
  test.todo('ANCIENT register correlates with cells that have long historical event chains')
})

describe('Chronicle generation [FUTURE]', () => {
  test.todo('chronicle contains at least one fragment after a full simulation run')
  test.todo('only events above symbolic load threshold appear in the chronicle')
  test.todo('chronicle fragments are ordered chronologically')
  test.todo('chronicle output is valid non-empty text')
})
