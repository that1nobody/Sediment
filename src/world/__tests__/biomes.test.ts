import { generateWorldGraph } from '../generateWorldGraph'
import { applyElevation } from '../elevation'
import { applyRivers } from '../rivers'
import { applyClimate } from '../climate'
import { applyBiomes } from '../biomes'

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
})
