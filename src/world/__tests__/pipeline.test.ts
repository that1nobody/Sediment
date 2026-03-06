import { generateWorld } from '../pipeline'

describe('generateWorld pipeline', () => {
  test('runs all implemented stages and populates key fields', () => {
    const graph = generateWorld({
      world: { width: 1000, height: 800, cellCount: 180, seed: 33 },
    })

    expect(graph.cells.length).toBeGreaterThan(0)

    graph.cells.forEach(cell => {
      expect(cell.elevation).toBeDefined()
      expect(cell.ocean).toBeDefined()
      expect(cell.drainage).toBeDefined()
      expect(cell.temperature).toBeDefined()
      expect(cell.moisture).toBeDefined()
      expect(cell.biome).toBeDefined()
    })
  })
})
