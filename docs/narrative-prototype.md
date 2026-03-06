# Sediment Narrative Prototype: Data Files & Usage Guide

These three JSON files power the register-driven name and chronicle generation from the Sediment game design document.

## Purpose

- `data/categories.json`: vocabulary source (`nouns`, `adjectives`, `verbs`) grouped by semantic categories like `EARTH`, `AETHER`, and others.
- `data/registers.json`: pull weights that connect registers (`DEATH`, `MYSTERY`, `ANCIENT`, etc.) to categories and bias word selection.
- `data/grammar.json`: named patterns (`site_name`, `era_title`, etc.) with slots like `{FRONT_ADJ}`, `{THE_NOUN:plur}`, `{OF_NOUN}`.

## Quick start (`graph_engine.py`)

1. Place all three files in a folder called `data/`.
2. Put `graph_engine.py` in the parent folder.
3. Run examples:

```bash
python graph_engine.py explore DEATH 1.0
python graph_engine.py names DEATH 0.7 MYSTERY 0.3
python graph_engine.py era VIOLENT 0.6 FIRE 0.4
python graph_engine.py chronicle DEATH 0.7 MYSTERY 0.3
```

Use any register blend with weights summing to roughly `1.0`.

## Expected outputs

- `explore`: lists drawn words biased by the register blend.
- `names`: generated place names (for example, `the Rugged Cairn`, `Rift of Weathered Stone`).
- `era`: era titles in uppercase style (for example, `THE AGE OF FRACTURED MOUNTAINS`).
- `chronicle`: sample chronicle entries in four tiers of source quality (clear records to vague fragments).

## Editing tips

- Add more categories to `data/categories.json` following the existing structure.
- Adjust pull weights in `data/registers.json` to shift flavor (`higher number = stronger influence`).
- Add or modify patterns in `data/grammar.json` to create new name styles.

The current vocabulary is strongest in landscape (`EARTH`) and uncanny/ethereal (`AETHER`) flavor, so consider expanding other registers as needed.

## Project direction

This is the language-generation backend for Sediment's emergent chronicles.

A natural next step is porting the runtime logic to TypeScript so it can run directly from the world simulation pipeline.
