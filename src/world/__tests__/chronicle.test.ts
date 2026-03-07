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
import { applyRegisters } from '../registers'
import { assembleChronicle } from '../chronicle'
import { mulberry32 } from '../rng'
import type { EventRecord, WorldGraph } from '../types'

// ---------------------------------------------------------------------------
// Helper: run full pipeline up to and including registers
// ---------------------------------------------------------------------------

function buildGraph(cellCount = 280, seed = 13): WorldGraph {
  const graph = generateWorldGraph({ width: 1000, height: 800, cellCount, seed })
  applyElevation(graph, graph.seed)
  applyRivers(graph)
  applyClimate(graph)
  applyBiomes(graph)
  const rngP = mulberry32(graph.seed ^ 0xdeadbeef)
  const rngE = mulberry32(graph.seed ^ 0xcafebabe)
  applyCivilizations(graph, rngP)
  applyInstability(graph)
  applyEvents(graph, rngE, { aeons: 12, instabilityThreshold: 0.35 })
  applyOrganizations(graph, rngP)
  applyAnomalies(graph, rngP)
  applyRegisters(graph)
  return graph
}

describe('assembleChronicle', () => {
  test('chronicle contains at least one fragment after a full simulation run', () => {
    const graph = buildGraph(280, 13)
    assembleChronicle(graph, { minLoad: 0.33 })

    expect(graph.chronicle.length).toBeGreaterThan(0)
  })

  test('only events above symbolic load threshold appear in the chronicle', () => {
    const graph = buildGraph(260, 7)
    const minLoad = 0.40
    assembleChronicle(graph, { minLoad })

    graph.chronicle.forEach(fragment => {
      expect(fragment.load).toBeGreaterThanOrEqual(minLoad)
    })
  })

  test('chronicle fragments are ordered chronologically (non-decreasing aeon)', () => {
    const graph = buildGraph(300, 20)
    assembleChronicle(graph)

    for (let i = 1; i < graph.chronicle.length; i++) {
      expect(graph.chronicle[i].aeon).toBeGreaterThanOrEqual(graph.chronicle[i - 1].aeon)
    }
  })

  test('chronicle output is valid non-empty structured data', () => {
    const graph = buildGraph(260, 33)
    assembleChronicle(graph, { minLoad: 0.20 })

    expect(Array.isArray(graph.chronicle)).toBe(true)
    graph.chronicle.forEach(fragment => {
      // All required fields are present and typed correctly
      expect(typeof fragment.aeon).toBe('number')
      expect(typeof fragment.eventIndex).toBe('number')
      expect(typeof fragment.cellId).toBe('number')
      expect(typeof fragment.load).toBe('number')
      expect(Array.isArray(fragment.registers)).toBe(true)
      expect(fragment.load).toBeGreaterThanOrEqual(0.20)
      expect(fragment.load).toBeLessThanOrEqual(1)
      expect(fragment.cellId).toBeGreaterThanOrEqual(0)
      expect(fragment.cellId).toBeLessThan(graph.cells.length)
      expect(fragment.eventIndex).toBeGreaterThanOrEqual(0)
      expect(fragment.eventIndex).toBeLessThan(graph.events.length)
    })
  })

  test('chronicle fragments correctly reference valid events', () => {
    const graph = buildGraph(240, 50)
    assembleChronicle(graph)

    graph.chronicle.forEach(fragment => {
      const event: EventRecord = graph.events[fragment.eventIndex]
      expect(event).toBeDefined()
      expect(event.cellId).toBe(fragment.cellId)
      expect(event.type).toBe(fragment.eventType)
      expect(event.load).toBeCloseTo(fragment.load)
    })
  })

  test('fragments with organization presence carry org metadata', () => {
    const graph = buildGraph(300, 18)
    assembleChronicle(graph)

    const withOrg = graph.chronicle.filter(f => f.organizationId !== undefined)
    if (withOrg.length > 0) {
      withOrg.forEach(f => {
        expect(f.organizationType).toBeDefined()
        expect(['cult', 'religion', 'mercenary', 'sect']).toContain(f.organizationType)
      })
    }
  })

  test('setting threshold to 2.0 produces empty chronicle', () => {
    const graph = buildGraph(200, 4)
    assembleChronicle(graph, { minLoad: 2.0 })
    expect(graph.chronicle).toHaveLength(0)
  })

  test('is deterministic', () => {
    const graph1 = buildGraph(220, 99)
    const graph2 = buildGraph(220, 99)
    assembleChronicle(graph1)
    assembleChronicle(graph2)

    expect(graph1.chronicle.length).toBe(graph2.chronicle.length)
    graph1.chronicle.forEach((f, i) => {
      expect(f.aeon).toBe(graph2.chronicle[i].aeon)
      expect(f.cellId).toBe(graph2.chronicle[i].cellId)
      expect(f.eventType).toBe(graph2.chronicle[i].eventType)
    })
  })

  test('empty graph does not throw', () => {
    const graph: WorldGraph = { seed: 1, width: 10, height: 10, cells: [], edges: [], corners: [], events: [], organizations: [], anomalies: [], chronicle: [] }
    expect(() => assembleChronicle(graph)).not.toThrow()
    expect(graph.chronicle).toHaveLength(0)
  })
})
