# Test Coverage Analysis

## Executive Summary

Current test coverage is **0%**. There are no test files, no testing framework,
and no CI configuration. The single implemented source file
(`src/world/generateWorldGraph.ts`) is entirely untested.

This document catalogues the gaps and proposes a concrete testing strategy for
both the code that exists today and the pipeline stages described in
`docs/worldgen.md`.

---

## Current State

| File | Lines | Tests | Coverage |
|------|-------|-------|----------|
| `src/world/generateWorldGraph.ts` | 90 | 0 | 0% |

**Testing infrastructure:** none (no `package.json`, `jest.config`, or
`tsconfig.json` existed before this analysis).

---

## What Has Been Added

This branch introduces the minimal scaffolding needed to start testing:

```
package.json            — npm scripts, Jest + ts-jest dev-dependencies
tsconfig.json           — TypeScript compiler config
jest.config.ts          — Jest configured for ts-jest, coverage reporting
src/world/__tests__/
  generateWorldGraph.test.ts  — test suite for the existing source file
```

Run tests with:

```
npm install
npm test              # run once
npm run test:coverage # run with HTML/lcov coverage report
npm run test:watch    # watch mode during development
```

---

## Priority 1 — Gaps in Existing Code

### 1.1 Seeded / reproducible random point generation

**Risk: High**

`generateRandomPoints` calls `Math.random()` directly and ignores the `seed`
field on `WorldConfig`. This means:

- Worlds cannot be reproduced from a recorded seed.
- Tests cannot assert deterministic output.
- Debugging world-generation bugs is extremely difficult.

**What to do:**

1. Replace `Math.random()` with a seeded pseudo-random number generator
   (e.g. [mulberry32](https://github.com/bryc/code/blob/master/jshash/PRNGs.md)
   — 6 lines of code, no dependency).
2. When `config.seed` is `undefined`, derive a seed from `Date.now()` and
   store it on the returned `WorldGraph` so callers can record and replay it.
3. Add two tests (already written as `test.todo` in the test file):
   - same seed → identical coordinates
   - different seeds → different coordinates (with high probability)

### 1.2 Input validation / error handling

**Risk: Medium**

`generateWorldGraph` accepts any `WorldConfig` without validating it. Passing
`cellCount: -1`, `width: 0`, or `NaN` values will silently produce incorrect
output or cause runtime errors downstream.

**What to do:**

Add a validation step at the top of `generateWorldGraph` and write tests for:

| Input | Expected behaviour |
|-------|--------------------|
| `cellCount < 0` | throw `RangeError` |
| `width <= 0` or `height <= 0` | throw `RangeError` |
| Non-finite / `NaN` dimensions | throw `TypeError` |
| `cellCount` not an integer | round or throw |

### 1.3 Cell uniqueness

**Risk: Low-Medium**

Two random points could theoretically share the same coordinates. The current
implementation does not deduplicate. While the probability is low for float
coordinates, it should be documented and — once Poisson disk sampling is
introduced — guaranteed structurally.

**What to add:**

A test asserting that no two cells share identical `(x, y)` pairs. This will
naturally drive the switch to Poisson disk sampling.

---

## Priority 2 — Voronoi Graph (next implementation milestone)

The graph topology — neighbours, edges, corners — is the structural backbone
of every subsequent simulation stage. Errors here cascade everywhere.

**Tests to write before or alongside the implementation:**

| Test | Rationale |
|------|-----------|
| Neighbour symmetry: if A ∈ B.neighbors then B ∈ A.neighbors | Asymmetric graphs break pathfinding and instability diffusion |
| All neighbour ids are valid cell ids | Out-of-range ids cause silent data corruption |
| Every edge references two distinct cell ids | Self-loops are topologically invalid |
| Every corner's coordinates are within world bounds | Out-of-bounds corners break rendering |
| Euler's formula: V − E + F = 2 (for planar graphs) | Structural sanity check for the Voronoi tessellation |
| No isolated cells (every cell has ≥ 1 neighbour) | Isolated cells can never be reached by civilisations or events |

**Recommended approach:** write these tests first as acceptance criteria, then
implement Voronoi computation until they all pass.

---

## Priority 3 — Terrain and Climate Pipeline

These stages transform the raw graph into a habitable world. Each stage has
clear invariants that should be enforced by tests.

### 3.1 Elevation field

| Test | Invariant |
|------|-----------|
| All elevations in `[0, 1]` | Downstream code can assume a normalised range |
| Spatial coherence | Adjacent cells differ by less than a configured max slope |
| Reproducibility | Same seed → same elevation field |
| Distribution sanity | At least 20% of cells are below sea-level, at least 10% above mountain threshold |

### 3.2 River and drainage system

Rivers are derived from the elevation field. Correctness errors here produce
impossible geography.

| Test | Invariant |
|------|-----------|
| Rivers only flow downhill | Monotonically decreasing elevation along any river |
| No cycles | Rivers must terminate (DFS/BFS check for cycles) |
| All rivers reach a sink | Ocean cell or basin — never a dead-end interior cell |
| Watershed partitions all cells | Every cell belongs to exactly one watershed |

### 3.3 Climate fields (temperature, moisture)

| Test | Invariant |
|------|-----------|
| Temperature decreases with elevation (above threshold) | Physical plausibility |
| Moisture is higher within N cells of a river | Physical plausibility |
| All cells have both values after computation | No missing data |

---

## Priority 4 — Biome Classification

Biome assignment is a pure function of temperature and moisture. It is one of
the most testable parts of the pipeline.

**Recommended approach: table-driven / property-based tests**

```
(low temp, low moisture)  → tundra or desert
(high temp, high moisture) → wetland or forest
(mid temp, mid moisture)  → grassland
(elevation > threshold)   → mountain regardless of other fields
(coastal cell)            → coast
```

Additional tests:
- Every cell has exactly one biome after classification.
- All assigned biomes are drawn from the defined vocabulary.
- World biome distribution is not degenerate (at least 4 distinct biomes in
  a standard 2 000-cell world).

---

## Priority 5 — Simulation Systems

### 5.1 Civilisation emergence

| Test | Invariant |
|------|-----------|
| Civilisations only seed in habitable cells | fertility + water access above threshold |
| Expansion only into adjacent cells | No teleportation |
| No two civs in same cell | Mutual exclusion invariant |
| Population pressure triggers expansion | Threshold-driven state machine |

### 5.2 Instability system

The instability system is a key emergent driver. Its unit tests should be
isolated from the civilisation and event systems:

| Test | Invariant |
|------|-----------|
| Each source type increases instability by documented amount | Numerical contracts |
| Instability ≥ threshold triggers exactly one event per evaluation | Threshold logic |
| Instability decays after an event | No runaway accumulation |

### 5.3 Event simulation

| Test | Invariant |
|------|-----------|
| War requires two distinct civs | Pre-condition |
| Plague reduces population in affected cells | Post-condition |
| Event log is ordered and non-empty after a run | Basic integration test |
| Events modify at least one field | No no-op events |

---

## Priority 6 — Anomaly System

| Test | Invariant |
|------|-----------|
| Primordial anomaly count ≈ density × cell_count (±10%) | Config respected |
| Influence radius stays within world bounds | No out-of-bounds access |
| Emergent anomalies only from catastrophic events | Causality |

---

## Priority 7 — Register and Chronicle

These are the final output stages. Integration and snapshot tests are most
valuable here.

### Registers

| Test | Invariant |
|------|-----------|
| Every cell has ≥ 1 register after computation | No missing output |
| All registers are from defined vocabulary | No arbitrary strings |
| ANCIENT correlates with long event histories | Narrative plausibility |

### Chronicle

| Test | Invariant |
|------|-----------|
| Chronicle is non-empty after a full run | Basic smoke test |
| Only high-symbolic-load events appear | Threshold respected |
| Fragments are chronologically ordered | Narrative coherence |
| All fragments are non-empty strings | Output quality |

**Recommended addition:** snapshot tests against a fixed-seed world. A stored
golden snapshot makes regressions in narrative output immediately visible.

---

## Recommended Testing Tools

| Tool | Purpose |
|------|---------|
| [Jest](https://jestjs.io/) + [ts-jest](https://kulshekhar.github.io/ts-jest/) | Unit and integration tests (already configured) |
| [fast-check](https://fast-check.dev/) | Property-based tests for terrain generation (elevation bounds, spatial coherence) |
| Jest snapshots | Golden-output tests for chronicle and register systems |
| [c8](https://github.com/bcoe/c8) or Jest's built-in coverage | Line/branch coverage reporting |

---

## Suggested Test File Layout

```
src/
  world/
    __tests__/
      generateWorldGraph.test.ts   ✅ added
      voronoiGraph.test.ts         (add when Voronoi is implemented)
      elevationField.test.ts       (add when elevation is implemented)
      rivers.test.ts
      climate.test.ts
      biomes.test.ts
  simulation/
    __tests__/
      civilisations.test.ts
      instability.test.ts
      events.test.ts
      anomalies.test.ts
  chronicle/
    __tests__/
      registers.test.ts
      chronicle.test.ts
      chronicle.snapshot.test.ts
```

---

## Coverage Targets

| Stage | Target line coverage |
|-------|---------------------|
| World graph generation | 90% |
| Terrain pipeline | 85% |
| Simulation systems | 80% |
| Chronicle / registers | 75% |
| **Overall** | **≥ 80%** |

---

## Immediate Next Steps

1. **Install dependencies:** `npm install`
2. **Verify existing tests pass:** `npm test`
3. **Implement seeded RNG** and promote the `test.todo` determinism tests to
   real assertions.
4. **Add input validation** to `generateWorldGraph` and write the corresponding
   error-case tests.
5. **Before implementing Voronoi:** write the topology tests listed in
   Priority 2 as failing tests, then make them pass (test-driven development).
