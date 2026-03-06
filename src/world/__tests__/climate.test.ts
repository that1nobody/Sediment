import { generateWorldGraph } from '../generateWorldGraph'
import { applyElevation } from '../elevation'
import { applyRivers } from '../rivers'
import { applyClimate } from '../climate'
import type { WorldGraph } from '../types'

describe('applyClimate', () => {
  test('assigns temperature and moisture in [0, 1] for every cell', () => {
    const graph = generateWorldGraph({ width: 1000, height: 800, cellCount: 220, seed: 42 })
    applyElevation(graph, graph.seed)
    applyRivers(graph)

    applyClimate(graph)

    graph.cells.forEach(cell => {
      expect(cell.temperature).toBeDefined()
      expect(cell.moisture).toBeDefined()
      expect(cell.temperature!).toBeGreaterThanOrEqual(0)
      expect(cell.temperature!).toBeLessThanOrEqual(1)
      expect(cell.moisture!).toBeGreaterThanOrEqual(0)
      expect(cell.moisture!).toBeLessThanOrEqual(1)
    })
  })

  test('higher-elevation cells tend to be cooler than low-elevation cells', () => {
    const graph = generateWorldGraph({ width: 1200, height: 900, cellCount: 260, seed: 9 })
    applyElevation(graph, graph.seed)
    applyRivers(graph)
    applyClimate(graph, { elevationCooling: 1.0 })

    const midLatitude = graph.cells.filter(c => {
      const lat = Math.abs((c.y / graph.height) * 2 - 1)
      return lat > 0.35 && lat < 0.65
    })

    const byElevation = [...midLatitude]
      .filter(c => c.temperature !== undefined && c.elevation !== undefined)
      .sort((a, b) => a.elevation! - b.elevation!)

    const slice = Math.max(6, Math.floor(byElevation.length * 0.2))
    const low = byElevation.slice(0, slice)
    const high = byElevation.slice(-slice)

    const avg = (arr: typeof low, key: 'temperature' | 'elevation') =>
      arr.reduce((s, c) => s + (c[key] as number), 0) / arr.length

    expect(avg(low, 'elevation')).toBeLessThan(avg(high, 'elevation'))
    expect(avg(low, 'temperature')).toBeGreaterThan(avg(high, 'temperature'))
  })

  test('water cells are moister than the world average', () => {
    const graph = generateWorldGraph({ width: 1000, height: 800, cellCount: 200, seed: 7 })
    applyElevation(graph, graph.seed)
    applyRivers(graph)
    applyClimate(graph)

    const water = graph.cells.filter(c => c.ocean || c.river)
    const avg = (arr: typeof water) => arr.reduce((s, c) => s + c.moisture!, 0) / arr.length

    expect(water.length).toBeGreaterThan(0)
    expect(avg(water)).toBeGreaterThanOrEqual(avg(graph.cells))
    expect(Math.max(...water.map(c => c.moisture!))).toBeGreaterThan(0.9)
  })

  test('uses fallback moisture seeding when no ocean/river flags exist', () => {
    const graph: WorldGraph = {
      seed: 1,
      width: 100,
      height: 100,
      edges: [],
      corners: [],
      cells: [
        { id: 0, x: 10, y: 50, neighbors: [1], elevation: 0.1 },
        { id: 1, x: 40, y: 50, neighbors: [0, 2], elevation: 0.3 },
        { id: 2, x: 80, y: 50, neighbors: [1], elevation: 0.8 },
      ],
    }

    applyClimate(graph)

    graph.cells.forEach(c => {
      expect(c.temperature).toBeDefined()
      expect(c.moisture).toBeDefined()
      expect(Number.isFinite(c.moisture)).toBe(true)
    })

    // Lowest elevation cell should be one of fallback moisture sources.
    expect(graph.cells[0].moisture!).toBeGreaterThanOrEqual(graph.cells[2].moisture!)
  })
})
