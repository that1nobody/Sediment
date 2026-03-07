import { generateWorldGraph } from '../generateWorldGraph'
import { applyElevation } from '../elevation'
import { applyRivers } from '../rivers'
import { applyClimate } from '../climate'
import { applyBiomes } from '../biomes'
import { applyCivilizations } from '../civilizations'
import { applyInstability } from '../instability'
import { applyEvents } from '../events'
import { applyOrganizations } from '../organizations'
import { mulberry32 } from '../rng'
import type { WorldGraph } from '../types'

// ---------------------------------------------------------------------------
// Helper: run pipeline up to and including events
// ---------------------------------------------------------------------------

function buildGraph(cellCount = 260, seed = 55): WorldGraph {
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
  return graph
}

describe('applyOrganizations', () => {
  test('organizations are seeded and recorded in graph.organizations', () => {
    const graph = buildGraph(280, 7)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    applyOrganizations(graph, rng, { maxOrganizations: 8 })

    expect(graph.organizations.length).toBeGreaterThan(0)
    expect(graph.organizations.length).toBeLessThanOrEqual(8)
  })

  test('each organization has a valid type and register', () => {
    const graph = buildGraph(260, 11)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    applyOrganizations(graph, rng)

    const validTypes = new Set(['cult', 'religion', 'mercenary', 'sect'])
    const validRegisters = new Set(['MYSTERY', 'MYTHIC', 'VIOLENT', 'EVIL'])

    graph.organizations.forEach(org => {
      expect(validTypes.has(org.type)).toBe(true)
      expect(validRegisters.has(org.register)).toBe(true)
    })
  })

  test('organization instability is in [0, 1]', () => {
    const graph = buildGraph(240, 33)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    applyOrganizations(graph, rng)

    graph.organizations.forEach(org => {
      expect(org.instability).toBeGreaterThanOrEqual(0)
      expect(org.instability).toBeLessThanOrEqual(1)
    })
  })

  test('each organization operates in at least one cell', () => {
    const graph = buildGraph(280, 21)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    applyOrganizations(graph, rng, { orgSpread: 3 })

    graph.organizations.forEach(org => {
      expect(org.cells.length).toBeGreaterThanOrEqual(1)
      expect(org.cells.length).toBeLessThanOrEqual(3)
    })
  })

  test('organizations do not operate in ocean cells', () => {
    const graph = buildGraph(300, 44)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    applyOrganizations(graph, rng)

    graph.organizations.forEach(org => {
      org.cells.forEach(cid => {
        expect(graph.cells[cid].ocean).not.toBe(true)
      })
    })
  })

  test('cell.organizations lists ids of all orgs operating there', () => {
    const graph = buildGraph(260, 66)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    applyOrganizations(graph, rng)

    // Verify that each org's cells have the org id recorded on the cell
    graph.organizations.forEach(org => {
      org.cells.forEach(cid => {
        expect(graph.cells[cid].organizations).toBeDefined()
        expect(graph.cells[cid].organizations!).toContain(org.id)
      })
    })
  })

  test('organizations may overlap with civilization cells', () => {
    const graph = buildGraph(300, 5)
    const rng = mulberry32(graph.seed ^ 0xdeadbeef)
    applyOrganizations(graph, rng, { maxOrganizations: 10 })

    // At least some org cells should be inside civilization territory
    const orgCivCells = graph.organizations.flatMap(o => o.cells)
      .filter(cid => graph.cells[cid].civilization !== undefined)
    expect(orgCivCells.length).toBeGreaterThan(0)
  })

  test('is deterministic given the same seed', () => {
    const graph1 = buildGraph(220, 9)
    const graph2 = buildGraph(220, 9)

    applyOrganizations(graph1, mulberry32(graph1.seed ^ 0xdeadbeef))
    applyOrganizations(graph2, mulberry32(graph2.seed ^ 0xdeadbeef))

    expect(graph1.organizations.length).toBe(graph2.organizations.length)
    graph1.organizations.forEach((org, i) => {
      expect(org.type).toBe(graph2.organizations[i].type)
      expect(org.register).toBe(graph2.organizations[i].register)
      expect(org.cells).toEqual(graph2.organizations[i].cells)
    })
  })

  test('empty graph does not throw', () => {
    const graph: WorldGraph = { seed: 1, width: 10, height: 10, cells: [], edges: [], corners: [], events: [], organizations: [], anomalies: [], chronicle: [] }
    const rng = mulberry32(1)
    expect(() => applyOrganizations(graph, rng)).not.toThrow()
  })
})
