# Test Coverage Analysis

## Executive Summary

Coverage is now strong for implemented world-generation modules.

- **Statements:** 99.08%
- **Branches:** 90.52%
- **Functions:** 100%
- **Lines:** 99.63%
- **Statements:** 96.04%
- **Branches:** 86.31%
- **Functions:** 96.96%
- **Lines:** 96.75%

Current suite status:

- 10 passing test suites
- 126 passing tests
- 124 passing tests
- 29 `todo` tests tracking future stages

This document reflects the **current** repository state and outlines the next
highest-value testing tasks.

---

## Current Tested Surface

Implemented and covered modules:

- `rng.ts`
- `poissonDisk.ts`
- `delaunay.ts`
- `generateWorldGraph.ts`
- `elevation.ts`
- `rivers.ts`
- `climate.ts`
- `biomes.ts`
- `pipeline.ts`

Key behavior already exercised:

- deterministic seed behavior
- graph topology invariants (neighbors/edges/corners)
- elevation normalization
- downhill river flow + drainage accumulation + watersheds
- climate field assignment and bounds
- biome vocabulary and distribution checks
- end-to-end pipeline smoke coverage

---

## Remaining Coverage Hotspots

Based on current coverage output:

| File | Gap | Suggested test |
|------|-----|----------------|
| `src/world/climate.ts` | additional branch combinations around clamps/latitude-cooling toggles | add focused parameterized tests for high/low elevationCooling and pole/equator inputs |
| `src/world/biomes.ts` | threshold branch combinations (already mostly covered) | add parameterized boundary tests for exact threshold equality behavior |
| `src/world/climate.ts` | fallback moisture seeding branch (`queue.length === 0`) | run `applyClimate` without `applyRivers` and assert moisture still assigned |
| `src/world/biomes.ts` | low-moisture desert branch and some default branch paths | construct deterministic fixture cells for edge-threshold classification |

---

## Priority Test Work (Next)

### 1) Close deterministic branch gaps in climate/biomes

Add direct, table-driven unit tests that trigger each threshold path explicitly
instead of relying only on generated-world distributions.

### 2) Convert high-value `todo` tests into active tests

Focus first on existing `todo`s tied to already-implemented stages, then leave
future-stage `todo`s as roadmap markers.

### 3) Add a lightweight CI gate

Run the following on every PR:

- `npm test -- --runInBand`
- `npm run test:coverage -- --runInBand`

Optional policy:

- fail PR if line coverage drops below 90%

---

## Pipeline Stage Coverage Matrix

| Stage | Implementation | Test status |
|------|----------------|-------------|
| Spatial sampling (Poisson) | ✅ | ✅ |
| Topology (Delaunay/Voronoi dual) | ✅ | ✅ |
| Elevation | ✅ | ✅ |
| Rivers / drainage | ✅ | ✅ |
| Climate (temperature/moisture) | ✅ | ✅ (with minor branch gaps) |
| Biomes | ✅ | ✅ (with minor branch gaps) |
| Civilizations | ❌ | ❌ |
| Instability | ❌ | ❌ |
| Events | ❌ | ❌ |
| Anomalies | ❌ | ❌ |
| Registers | ❌ | ❌ |
| Chronicle | ❌ | ❌ |

---

## Commands

```bash
npm install
npm test -- --runInBand
npm run test:coverage -- --runInBand
```

