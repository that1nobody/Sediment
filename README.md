# Sediment Engine

Procedural world-history generator.

This project simulates a world evolving across long spans of time and
produces an emergent chronicle describing that world.

## Core Concept

The simulation runs in layered stages:

1.  World generation
2.  Environmental simulation
3.  Civilization emergence
4.  Instability accumulation
5.  Historical events
6.  Register interpretation
7.  Chronicle generation

The player interacts with the system through three roles:

-   Trickster
-   Archivist
-   Direct

See `GDD.md` for the full design document.

For narrative-generation data file structure and command examples, see `docs/narrative-prototype.md`.

## Development workflow

Use feature branches instead of committing directly to `main`.

Example:

```bash
git checkout main
git pull
git checkout -b feat/your-change
```

See `CONTRIBUTING.md` for the full workflow.
