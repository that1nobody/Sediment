# World Generation

This document describes the procedural world generation pipeline used by
the engine.

------------------------------------------------------------------------

## Overview

World generation proceeds through a sequence of deterministic stages.

Each stage derives new structures from the previous layer.

Pipeline:

Poisson disk sampling → Voronoi graph → elevation → rivers → moisture →
temperature → biomes → civilizations → instability → events → anomalies
→ registers → chronicle

Registers describe the resulting world state rather than driving the
simulation.

------------------------------------------------------------------------

## 1. Spatial Distribution

Seed points are generated using Poisson disk sampling.

Purpose: - evenly distributed world regions - avoids clustering
artifacts - produces natural spacing

Output: - set of spatial seed points

------------------------------------------------------------------------

## 2. Voronoi Graph

The Poisson points are used to generate a Voronoi diagram.

Graph elements:

cells -- primary simulation regions\
edges -- boundaries between regions\
corners -- shared vertex points

Cells represent geographic regions of the world.

------------------------------------------------------------------------

## 3. Elevation Field

Elevation defines terrain height across the world.

Possible generation approaches:

-   midpoint displacement
-   fractal noise
-   layered noise fields

Elevation values are sampled at graph corners or cells.

Derived structures:

-   mountain ranges
-   basins
-   coastlines

------------------------------------------------------------------------

## 4. River and Drainage System

Rivers are computed by flowing water downhill through the elevation
field.

Typical process:

1.  determine flow direction
2.  accumulate water volume
3.  form river channels
4.  merge tributaries

Outputs:

-   river networks
-   watersheds
-   drainage basins

------------------------------------------------------------------------

## 5. Climate Fields

Two primary climate fields are derived.

Temperature: - latitude - elevation - ocean influence

Moisture: - rainfall - river proximity - evaporation

These fields combine to determine biome conditions.

------------------------------------------------------------------------

## 6. Biome Classification

Biomes classify environmental conditions.

Typical biome types:

tundra\
forest\
grassland\
desert\
wetland\
mountain\
coast

Biome values influence:

-   fertility
-   resource distribution
-   habitability

------------------------------------------------------------------------

## 7. Civilization Emergence

Civilizations arise in cells with suitable conditions.

Factors:

-   fertility
-   water access
-   travel friction
-   resource availability

Settlements expand to neighboring cells when population pressure
increases.

------------------------------------------------------------------------

## 8. Instability Generation

Instability represents historical tension.

Sources:

-   famine
-   frontier stress
-   faction conflict
-   authority collapse
-   anomaly effects

Instability accumulates until thresholds trigger events.

------------------------------------------------------------------------

## 9. Event Simulation

Events modify world state.

Examples:

war\
famine\
plague\
migration\
cultural shifts\
civilization collapse

Events alter environmental and social fields.

------------------------------------------------------------------------

## 10. Anomalies

Anomalies are persistent distortions in the world.

Two origins exist:

Primordial anomalies -- generated during world creation\
Emergent anomalies -- created by catastrophic events

Anomalies influence nearby regions.

------------------------------------------------------------------------

## 11. Register Calculation

Registers describe symbolic qualities of locations.

Derived from:

-   biome signals
-   historical events
-   anomaly influence

Example registers:

ANCIENT\
DEATH\
MYSTERY\
MAGIC\
WILD

Registers influence narrative tone and myth generation.

------------------------------------------------------------------------

## 12. Chronicle Generation

The chronicle assembles historical fragments produced by the simulation.

Fragments include:

-   myths
-   rumors
-   records
-   archaeological traces

Only events above a symbolic load threshold appear in the chronicle.
