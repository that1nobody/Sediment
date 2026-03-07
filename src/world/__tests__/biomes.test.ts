import { generateWorldGraph } from '../generateWorldGraph'
import { applyElevation } from '../elevation'
import { applyRivers } from '../rivers'
import { applyClimate } from '../climate'
import { applyBiomes } from '../biomes'
import type { Cell, WorldGraph } from '../types'

const VOCAB = new Set(['tundra', 'forest', 'grassland', 'desert', 'wetland', 'mountain', 'coast'])

describe('applyBiomes', () => {
  test('assigns exactly one valid biome to every cell', () => {
    const graph = generateWorldGraph({ width: 1000, height: 800, cellCount: 220, seed: 14 })
    applyElevation(graph, graph.seed)
    applyRivers(graph)
    applyClimate(graph)
    applyBiomes(graph)

    graph.cells.forEach(cell => {
      expect(cell.biome).toBeDefined()
      expect(VOCAB.has(cell.biome!)).toBe(true)
    })
  })

  test('mountain cells classify as mountain above threshold', () => {
    const graph = generateWorldGraph({ width: 1000, height: 800, cellCount: 260, seed: 101 })
    applyElevation(graph, graph.seed)
    applyRivers(graph)
    applyClimate(graph)
    applyBiomes(graph, { mountainLevel: 0.75 })

    graph.cells
      .filter(c => (c.elevation ?? 0) >= 0.75 && !(c.ocean ?? false))
      .forEach(c => expect(c.biome).toBe('mountain'))
  })

  test('produces biome diversity in a typical world', () => {
    const graph = generateWorldGraph({ width: 1200, height: 900, cellCount: 400, seed: 2 })
    applyElevation(graph, graph.seed)
    applyRivers(graph)
    applyClimate(graph)
    applyBiomes(graph)

    const distinct = new Set(graph.cells.map(c => c.biome))
    expect(distinct.size).toBeGreaterThanOrEqual(4)
  })

  test('classifies threshold edge cases deterministically', () => {
    const cells: Cell[] = [
      { id: 0, x: 0, y: 0, neighbors: [], ocean: true, elevation: 0.2, temperature: 0.7, moisture: 0.7 },
      { id: 1, x: 0, y: 0, neighbors: [], elevation: 0.9, temperature: 0.6, moisture: 0.6 },
      { id: 2, x: 0, y: 0, neighbors: [], elevation: 0.5, temperature: 0.1, moisture: 0.6 },
      { id: 3, x: 0, y: 0, neighbors: [], elevation: 0.5, temperature: 0.6, moisture: 0.1 },
      { id: 4, x: 0, y: 0, neighbors: [], elevation: 0.5, temperature: 0.7, moisture: 0.9 },
      { id: 5, x: 0, y: 0, neighbors: [], elevation: 0.5, temperature: 0.4, moisture: 0.9 },
      { id: 6, x: 0, y: 0, neighbors: [], elevation: 0.5, temperature: 0.4, moisture: 0.4 },
    ]

    const graph: WorldGraph = {
      seed: 1,
      width: 1,
      height: 1,
      cells,
      edges: [],
      corners: [],
      events: [],
    }

    applyBiomes(graph)

    expect(graph.cells[0].biome).toBe('coast')
    expect(graph.cells[1].biome).toBe('mountain')
    expect(graph.cells[2].biome).toBe('tundra')
    expect(graph.cells[3].biome).toBe('desert')
    expect(graph.cells[4].biome).toBe('wetland')
    expect(graph.cells[5].biome).toBe('forest')
    expect(graph.cells[6].biome).toBe('grassland')
  })
})
