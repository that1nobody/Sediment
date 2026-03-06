import { fBm } from './noise'
import type { WorldGraph } from './types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ElevationConfig {
  /**
   * Spatial scale of terrain features relative to the world size.
   * 1.0 → one broad feature (continent-scale hills) spans the world.
   * 2.0 → two features; 4.0 → four (smaller, more numerous mountains).
   * Maps directly to worldgen_config.json `terrain.elevation_noise_scale`.
   */
  scale?: number
  /** fBm detail layers. More octaves → finer ridges and valleys. Default 6. */
  octaves?: number
}

// ---------------------------------------------------------------------------
// Pipeline stage
// ---------------------------------------------------------------------------

/**
 * Assigns `cell.elevation` ∈ [0, 1] to every cell in `graph`.
 *
 * Uses fractal Brownian motion noise sampled at each cell's normalised
 * position.  Values are linearly remapped so the lowest cell is 0 and the
 * highest is 1, giving full dynamic range regardless of seed.
 *
 * Typical interpretation: values below 0.4 are ocean / below sea-level;
 * values above 0.75 are highland / mountain.  The exact thresholds are left
 * to the biome-classification stage so they can be tuned independently.
 *
 * @param graph   WorldGraph produced by generateWorldGraph (mutated in-place).
 * @param seed    The world seed (use graph.seed for consistency).
 * @param config  Optional tuning parameters.
 */
export function applyElevation(
  graph: WorldGraph,
  seed: number,
  config: ElevationConfig = {}
): void {
  const { scale = 1.0, octaves = 6 } = config

  if (graph.cells.length === 0) return

  // Sample fBm at each cell's position, normalised to [0, scale].
  const raw = graph.cells.map(cell =>
    fBm(seed, (cell.x / graph.width) * scale, (cell.y / graph.height) * scale, octaves)
  )

  // Remap: stretch the actual min→max range to [0, 1].
  // This guarantees at least one cell at 0 and one at 1 regardless of seed.
  let lo = raw[0], hi = raw[0]
  for (const v of raw) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const range = hi - lo

  graph.cells.forEach((cell, i) => {
    cell.elevation = range > 0 ? (raw[i] - lo) / range : 0.5
  })
}
