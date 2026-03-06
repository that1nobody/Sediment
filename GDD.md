# Procedural World Chronicle

## Game Design Document

Version: 0.1\
Status: Pre‑implementation design

------------------------------------------------------------------------

# 1. Vision

A procedural world‑history generator.

The system simulates a world over long spans of time.\
The player interacts with that history through three stances:

1.  Trickster --- shaping historical forces
2.  Archivist --- reading the chronicle
3.  Direct --- inhabiting moments inside the world

Stories are not authored. They emerge from simulated environmental and
social processes.

------------------------------------------------------------------------

# 2. Core Loop

Trickster → Archivist → Direct → Archivist → Next Aeon

Each mode interacts with the same persistent world state.

------------------------------------------------------------------------

# 3. World Generation Pipeline

Poisson disk sampling → Voronoi graph → elevation → rivers → moisture →
temperature → biomes → civilizations → instability → events → anomalies
→ registers → chronicle

Registers describe the world state rather than driving the simulation.

------------------------------------------------------------------------

# 4. World Topology

The world is represented as a Voronoi spatial graph generated from
Poisson‑disk‑sampled points.

Graph elements: - cells (primary simulation unit) - edges - corners

Cells represent geographic regions of the world.

------------------------------------------------------------------------

# 5. Environmental Fields

Fields mapped across the graph:

-   elevation
-   temperature
-   moisture
-   fertility
-   instability
-   anomaly influence

Fields blend across neighboring cells, producing soft regional
transitions.

------------------------------------------------------------------------

# 6. Civilizations

Civilizations emerge in cells where conditions allow settlement.

Key factors: - fertility - water access - resources - travel friction

Expansion creates migration, trade routes, and conflicts.

------------------------------------------------------------------------

# 7. Instability

Historical change is driven by accumulating pressures:

-   famine
-   frontier stress
-   faction conflict
-   authority collapse
-   anomaly effects

When instability thresholds are crossed, events occur.

------------------------------------------------------------------------

# 8. Events

Events modify the world state.

Examples: - famine - war - plague - disaster - cultural transformation -
civilization collapse

Events update environmental and social fields.

------------------------------------------------------------------------

# 9. Anomalies

Persistent distortions of natural conditions.

Two origins:

Primordial --- generated during world creation.\
Emergent --- created by catastrophic historical events.

Anomalies influence nearby regions.

------------------------------------------------------------------------

# 10. Register System

Registers describe the symbolic tone of a location.

Derived from:

-   biome influence
-   historical events
-   anomaly signals

Example registers:

ANCIENT\
DEATH\
MYSTERY\
MAGIC\
WILD\
VIOLENT

Registers affect narrative language and myth generation.

------------------------------------------------------------------------

# 11. Event Significance

Each event produces a symbolic load value.

Low load → ignored\
Medium load → recorded\
High load → mythic

Mythic events influence later generations.

------------------------------------------------------------------------

# 12. Event Ledger

Structure:

Site → Events → Ledger

The ledger accumulates historical memory for the world.

------------------------------------------------------------------------

# 13. Design Principles

1.  Geography precedes history.
2.  History emerges from environmental pressure.
3.  Registers interpret history rather than driving it.
4.  Player influence is catalytic rather than deterministic.
