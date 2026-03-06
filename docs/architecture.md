# Architecture Overview

Core structure:

Poisson Disk Sampling → Voronoi Graph → Environmental Fields →
Civilization Simulation → Event System → Register Layer → Chronicle
Output

Simulation units:

cells\
edges\
corners

Cells drive most systems including civilizations, instability, and
events.

## Current code layout (world module)

To keep pipeline stages loosely coupled, shared world interfaces live in
`src/world/types.ts` and stage implementations depend on those types rather
than on specific generator modules.

Current stage flow:

- `generateWorldGraph.ts` (spatial graph)
- `elevation.ts`
- `rivers.ts`
- `climate.ts`
- `biomes.ts`
- `pipeline.ts` orchestrates end-to-end generation

