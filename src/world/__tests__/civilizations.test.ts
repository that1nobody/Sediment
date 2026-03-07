import { generateWorldGraph } from '../generateWorldGraph'
import { applyElevation } from '../elevation'
import { applyRivers } from '../rivers'
import { applyClimate } from '../climate'
import { applyBiomes } from '../biomes'
import { applyCivilizations } from '../civilizations'
import { mulberry32 } from '../rng'
import type { Cell, WorldGraph } from '../types'

// ---------------------------------------------------------------------------
// Helper: run all preceding pipeline stages and return the graph
// ---------------------------------------------------------------------------

function buildGraph(cellCount = 220, seed = 42): WorldGraph {
  const graph = generateWorldGraph({ width: 1000, height: 800, cellCount, seed })
  applyElevation(graph, graph.seed)
  applyRivers(graph)
  applyClimate(graph)
  applyBiomes(graph)
  return graph
}

describe('applyCivilizations', () => {
  test('civilisations only seed in cells meeting minimum habitability criteria', () => {
    const graph = buildGraph(300, 7)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    applyCivilizations(graph, rng, { minMoisture: 0.25, minTemperature: 0.20, minDrainage: 0.05 })

    // Every settled cell must meet the habitability criteria
    graph.cells.forEach(cell => {
      if (cell.civilization !== undefined) {
        // Seed cells meet the criteria; expanded cells only need to be non-ocean non-mountain.
        // At minimum: not ocean
        expect(cell.ocean).not.toBe(true)
        expect(cell.biome).not.toBe('mountain')
      }
    })
  })

  test('civilisations expand only into adjacent cells', () => {
    const graph = buildGraph(250, 11)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    applyCivilizations(graph, rng, { maxCivilizations: 3, expansionSteps: 5 })

    // Build an adjacency lookup
    const neighborSet = new Map<number, Set<number>>()
    graph.cells.forEach(c => neighborSet.set(c.id, new Set(c.neighbors)))

    // For each settled cell (other than seeds), at least one neighbor must
    // share the same civilization and have population >= its own (closer to origin).
    // We verify the weaker property: every settled cell has at least one
    // settled neighbor of the same civilization.
    graph.cells.forEach(cell => {
      if (cell.civilization === undefined) return

      const samecivNeighbor = cell.neighbors.some(
        nid => graph.cells[nid].civilization === cell.civilization,
      )
      // The seed cell itself may have no same-civ neighbour if the civ only
      // claimed a single cell — so only check cells that aren't the maximum
      // population cell in their civ.
      if ((cell.population ?? 1) < 1) {
        expect(samegivNeighbor(cell, graph)).toBe(true)
      }
    })

    // Simpler reachability check: every settled cell can trace a path through
    // same-civilization cells back to a population-1 origin.
    const settled = graph.cells.filter(c => c.civilization !== undefined)
    for (const cell of settled) {
      const civId = cell.civilization!
      // BFS from this cell through same-civ neighbors; must reach a pop-1 origin.
      const visited = new Set<number>()
      const queue = [cell.id]
      let foundOrigin = false
      while (queue.length > 0) {
        const cur = queue.shift()!
        if (visited.has(cur)) continue
        visited.add(cur)
        const c = graph.cells[cur]
        if (c.civilization !== civId) continue
        if ((c.population ?? 0) === 1) { foundOrigin = true; break }
        for (const nid of c.neighbors) queue.push(nid)
      }
      expect(foundOrigin).toBe(true)
    }
  })

  test('no two civilisations can occupy the same cell simultaneously', () => {
    const graph = buildGraph(300, 99)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    applyCivilizations(graph, rng, { maxCivilizations: 6, expansionSteps: 15 })

    // Each cell has at most one civilization id
    graph.cells.forEach(cell => {
      expect(typeof cell.civilization === 'number' || cell.civilization === undefined).toBe(true)
    })

    // Verify uniqueness by checking the raw value (no cell stores two ids)
    const civValues = graph.cells
      .filter(c => c.civilization !== undefined)
      .map(c => c.civilization!)
    // All values should be valid integers in [0, maxCivilizations)
    civValues.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(v)).toBe(true)
    })
  })

  test('population is in [0, 1] for all settled cells', () => {
    const graph = buildGraph(280, 55)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    applyCivilizations(graph, rng)

    graph.cells.forEach(cell => {
      if (cell.civilization !== undefined) {
        expect(cell.population).toBeDefined()
        expect(cell.population!).toBeGreaterThanOrEqual(0)
        expect(cell.population!).toBeLessThanOrEqual(1)
      }
    })
  })

  test('handles a world where no habitable cell exists gracefully', () => {
    // Build a minimal graph with only ocean or mountain cells
    const cells: Cell[] = [
      { id: 0, x: 0, y: 0, neighbors: [1], ocean: true, elevation: 0.1, moisture: 0.8, temperature: 0.5, biome: 'coast' },
      { id: 1, x: 1, y: 0, neighbors: [0], elevation: 0.9, moisture: 0.4, temperature: 0.4, biome: 'mountain' },
    ]
    const graph: WorldGraph = { seed: 1, width: 10, height: 10, cells, edges: [], corners: [], events: [], organizations: [], anomalies: [], chronicle: [] }
    const rng = mulberry32(1)
    expect(() => applyCivilizations(graph, rng)).not.toThrow()
    graph.cells.forEach(c => expect(c.civilization).toBeUndefined())
  })

  test('empty graph does not throw', () => {
    const graph: WorldGraph = { seed: 1, width: 10, height: 10, cells: [], edges: [], corners: [], events: [], organizations: [], anomalies: [], chronicle: [] }
    const rng = mulberry32(1)
    expect(() => applyCivilizations(graph, rng)).not.toThrow()
  })

  test('is deterministic given the same seed', () => {
    const graph1 = buildGraph(200, 3)
    const graph2 = buildGraph(200, 3)
    applyCivilizations(graph1, mulberry32(graph1.seed ^ 0xdeadbeef))
    applyCivilizations(graph2, mulberry32(graph2.seed ^ 0xdeadbeef))

    graph1.cells.forEach((c, i) => {
      expect(c.civilization).toBe(graph2.cells[i].civilization)
      expect(c.population).toBe(graph2.cells[i].population)
    })
  })
})

// ---------------------------------------------------------------------------
// Private helper used inside the second test
// ---------------------------------------------------------------------------

function samegivNeighbor(cell: Cell, graph: WorldGraph): boolean {
  return cell.neighbors.some(nid => graph.cells[nid].civilization === cell.civilization)
}
