# CLAUDE.md — Sediment Engine

This file provides guidance for AI assistants working in this repository. Read it before making any changes.

---

## Project Overview

**Sediment** is a procedural world-history generator. It simulates a world from geological formation through civilizational rise and fall, producing a structured chronicle of events. The project is split into two layers:

- **TypeScript** — Spatial/physical world generation (Voronoi graphs, elevation, rivers, climate, biomes)
- **Python** — Narrative/language generation (grammar-driven chronicle text using vocabulary registers)

There are three intended player roles: Trickster, Archivist, and Direct. The project is currently in early development with the world generation pipeline (TypeScript) being the most complete part.

---

## Repository Structure

```
Sediment/
├── src/
│   └── world/                    # TypeScript world generation module
│       ├── __tests__/            # Jest test files (*.test.ts)
│       ├── types.ts              # Shared type definitions (Cell, Edge, Corner, WorldGraph, etc.)
│       ├── rng.ts                # Seeded RNG (mulberry32 algorithm)
│       ├── noise.ts              # Perlin-style gradient noise
│       ├── poissonDisk.ts        # Poisson disk sampling for cell placement
│       ├── delaunay.ts           # Delaunay triangulation
│       ├── generateWorldGraph.ts # Voronoi graph construction
│       ├── elevation.ts          # Elevation field generation
│       ├── rivers.ts             # River/drainage network simulation
│       ├── climate.ts            # Temperature and moisture fields
│       ├── biomes.ts             # Biome classification
│       └── pipeline.ts           # Orchestrates all stages in sequence
├── data/
│   ├── categories.json           # Semantic vocabulary grouped by category
│   ├── grammar.json              # Named patterns for narrative generation
│   ├── registers.json            # Register-to-category pull weights
│   └── worldgen_config.json      # World generation parameters (seed, cell count, etc.)
├── docs/
│   ├── architecture.md           # System architecture overview
│   ├── worldgen.md               # World generation pipeline details
│   ├── simulation.md             # Simulation systems documentation
│   ├── chronicle.md              # Chronicle generation documentation
│   ├── narrative-prototype.md    # Narrative data files and usage guide
│   └── test-coverage-analysis.md # Current test coverage metrics
├── graph_engine.py               # Python narrative generation engine (standalone)
├── GDD.md                        # Game Design Document (authoritative design reference)
├── CONTRIBUTING.md               # Branching and PR conventions
├── README.md                     # Project overview
├── package.json                  # NPM scripts and dev dependencies
├── tsconfig.json                 # TypeScript compiler configuration
└── jest.config.js                # Jest test configuration
```

---

## Development Workflow

### Branching

- All work happens on **feature branches** off `main`
- Branch prefixes: `feat/`, `fix/`, `docs/`, `chore/`
- Open a PR to `main`; run tests before marking ready for review
- Never commit directly to `main`

### Running Tests

```bash
npm test                    # Run all tests once
npm run test:coverage       # Run with coverage report (outputs to coverage/)
npm run test:watch          # Watch mode for development
```

Tests live in `src/world/__tests__/` and use the pattern `**/__tests__/**/*.test.ts`.

### TypeScript Build

```bash
npx tsc                     # Compile to dist/ (not required for tests)
```

The project has no production build step in regular CI — tests run directly via `ts-jest`.

### Python Narrative Engine

```bash
python graph_engine.py      # Run standalone narrative prototype
```

No installation required beyond Python 3 standard library. Data files are read from `data/`.

---

## Key Conventions

### TypeScript Code Style

- **Functions:** camelCase (`generateWorldGraph`, `applyElevation`)
- **Types/Interfaces:** PascalCase (`Cell`, `WorldGraph`, `ElevationConfig`)
- **Constants:** UPPER_CASE where appropriate (`GX`, `GY`)
- **Exports:** Named exports only; no default exports
- **Type imports:** Use `import type { ... }` for type-only imports

### Documentation Conventions

- All exported functions have JSDoc comments (`/** ... */`) with `@param` and `@returns`
- Complex algorithms (Delaunay, Perlin noise) include inline comments explaining the math
- Section separators use `// ------` comment lines for visual grouping

### Pipeline Architecture

Each world generation stage is a **pure function or in-place mutator** following this pattern:

```typescript
// Pure function pattern
export function computeSomething(graph: WorldGraph, config: SomeConfig = {}): ResultType { ... }

// In-place mutation pattern
export function applySomething(graph: WorldGraph, config: SomeConfig = {}): void { ... }
```

`pipeline.ts` calls all stages in sequence. When adding a new stage:
1. Create a new file in `src/world/`
2. Define its config interface in the file or `types.ts` if shared
3. Export the stage function
4. Add it to `pipeline.ts` in the correct order
5. Add a corresponding test file in `src/world/__tests__/`

### Types

All shared types are defined in `types.ts`. Key types:
- `Cell` — a Voronoi region (position, elevation, moisture, temperature, biome, rivers)
- `Corner` — a Voronoi vertex (shared by multiple cells)
- `Edge` — connection between two cells or corners
- `WorldGraph` — top-level container with `cells`, `corners`, `edges`

Do not scatter type definitions across implementation files. If a type is used by more than one module, it belongs in `types.ts`.

### Configuration

World generation parameters are in `data/worldgen_config.json`. Do not hardcode magic numbers in source files — add them as named fields in the config interface and `worldgen_config.json`.

---

## Testing Guidelines

- Every world generation module must have a corresponding test file
- Tests use seeded RNG (`rng.ts`) to ensure determinism — avoid `Math.random()` in tests
- Cover edge cases: zero cells, single cell, extreme config values
- Coverage targets apply to `src/world/` — see `docs/test-coverage-analysis.md` for current metrics
- Mock nothing from within the project; use real implementations with controlled seeds

---

## Data Files (`data/`)

| File | Purpose |
|------|---------|
| `worldgen_config.json` | Tunable parameters for world generation (cell count, seed, aeon count, elevation scale) |
| `categories.json` | Vocabulary words grouped by semantic category for narrative generation |
| `grammar.json` | Named grammar patterns used by the Python narrative engine |
| `registers.json` | Affinity weights that map registers (narrative tones) to vocabulary categories |

These files are read at runtime by `graph_engine.py`. Changes to schema must be reflected in the Python parsing code.

---

## Important Design Constraints (from GDD.md)

- World generation must be **fully deterministic** given the same seed
- The simulation pipeline runs in a fixed order: Poisson sampling → Voronoi → elevation → rivers → moisture → temperature → biomes → civilizations → instability → events → anomalies → registers → chronicle
- Civilizations, instability, events, anomalies, and registers are **not yet implemented** in TypeScript (only in the Python prototype)
- The narrative system uses **registers** (thematic tones) to weight vocabulary selection — this is a core design concept documented in GDD.md §12
- Do not conflate physical world simulation (TypeScript) with narrative generation (Python)

---

## What Is Not Present

- No linting or formatting tools (no ESLint, Prettier, or EditorConfig)
- No CI/CD pipelines
- No production build targets or deployment configuration
- No database or external API integrations
- No environment variables

---

## Quick Reference

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run Python narrative engine
python graph_engine.py

# Check TypeScript types
npx tsc --noEmit
```
