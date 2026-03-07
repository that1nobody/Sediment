#!/usr/bin/env python3
"""
Sediment Chronicle Renderer
============================
Reads data/world_state.json (produced by `npm run generate`) and renders the
structured chronicle fragments into human-readable text using the semantic
graph vocabulary engine.

Usage:
    python render_chronicle.py                     # reads data/world_state.json
    python render_chronicle.py path/to/state.json  # reads specified file
"""

import json
import random
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional

# Import the semantic graph from the sibling module in the project root.
from graph_engine import SemanticGraph, generate_chronicle_entry

DATA_DIR = Path(__file__).parent / "data"


# =========================================================================
# HELPERS
# =========================================================================

def build_register_blend(registers: List[str]) -> Dict[str, float]:
    """
    Convert a ranked register list into a weighted blend dict.
    First register (highest score) gets 50%; second 30%; third 20%.
    Weights are renormalised to sum to 1.0.
    """
    if not registers:
        return {"ANCIENT": 1.0}
    base_weights = [0.50, 0.30, 0.20]
    w = base_weights[:len(registers)]
    total = sum(w)
    return {reg: weight / total for reg, weight in zip(registers, w)}


def load_tier(load: float) -> int:
    """
    Map symbolic load to chronicle source quality tier (1 = best).

    GDD §11: low (<0.33) → ignored, medium → recorded, high (>0.66) → mythic.
    High-load events are assumed to be well-documented (tier 1) because they
    mattered enough for many accounts to survive.
    """
    if load >= 0.66:
        return 1
    elif load >= 0.50:
        return 2
    return 3


def dominant_blend(fragments: list) -> Dict[str, float]:
    """Compute a register blend from the most frequent registers in a list of fragments."""
    counts: Dict[str, int] = defaultdict(int)
    for f in fragments:
        for r in f.get("registers", []):
            counts[r] += 1
    top = sorted(counts, key=lambda r: -counts[r])[:3]
    return build_register_blend(top) if top else {"ANCIENT": 1.0}


# Faction label prefixes per organization type
ORG_LABELS = {
    "cult":      "the cult of",
    "religion":  "the faithful of",
    "mercenary": "the company of",
    "sect":      "the keepers of",
}

# Generic patient names per event type
EVENT_PATIENTS = {
    "war":                    "the old compact",
    "collapse":               "what remained",
    "famine":                 "the starving",
    "plague":                 "the afflicted",
    "cultural_transformation":"the old ways",
    "disaster":               "the settled",
}


# =========================================================================
# RENDERER
# =========================================================================

def render_chronicle(state: dict, graph: SemanticGraph) -> str:
    """
    Render a full world chronicle from a world state snapshot.

    Returns a formatted string containing the complete chronicle text.
    """
    rng = random.Random(state.get("seed", 42))
    chronicle = state.get("chronicle", [])
    cells     = state.get("cells", {})
    orgs      = {str(o["id"]): o for o in state.get("organizations", [])}

    if not chronicle:
        return "[no chronicle entries — try lowering chronicle.min_load in worldgen_config.json]\n"

    # ------------------------------------------------------------------
    # 1. Generate a site name for every referenced cell
    # ------------------------------------------------------------------
    site_names: Dict[int, str] = {}
    for fragment in chronicle:
        cid = fragment["cell_id"]
        if cid not in site_names:
            cell_data = cells.get(str(cid), {})
            regs = build_register_blend(cell_data.get("registers", []))
            site_rng = random.Random(rng.randint(0, 2 ** 32))
            site_names[cid] = graph.generate_name("site_name", regs, rng=site_rng)

    # ------------------------------------------------------------------
    # 2. Generate an era title for every aeon that appears in the chronicle
    # ------------------------------------------------------------------
    aeon_fragments: Dict[int, list] = defaultdict(list)
    for f in chronicle:
        aeon_fragments[f["aeon"]].append(f)

    era_names: Dict[int, str] = {}
    for aeon in sorted(aeon_fragments):
        blend = dominant_blend(aeon_fragments[aeon])
        era_rng = random.Random(rng.randint(0, 2 ** 32))
        era_names[aeon] = graph.generate_name("era_title", blend, rng=era_rng)

    # ------------------------------------------------------------------
    # 3. Generate names for each unique organization
    # ------------------------------------------------------------------
    org_agent_names: Dict[str, str] = {}
    for org_id_str, org in orgs.items():
        org_blend = {org["register"]: 1.0}
        org_site_rng = random.Random(rng.randint(0, 2 ** 32))
        org_site = graph.generate_name("site_name", org_blend, rng=org_site_rng)
        label = ORG_LABELS.get(org["type"], "those of")
        org_agent_names[org_id_str] = f"{label} {org_site}"

    # ------------------------------------------------------------------
    # 4. Render each chronicle fragment
    # ------------------------------------------------------------------
    lines: List[str] = []

    s = state["summary"]
    lines.append("=" * 70)
    lines.append(f"  THE CHRONICLE  ·  seed {state['seed']}")
    lines.append(
        f"  {s['cell_count']} sites · "
        f"{s['event_count']} events · "
        f"{s['chronicle_count']} entries recorded · "
        f"{s['organization_count']} organizations"
    )
    lines.append("=" * 70)

    current_aeon: Optional[int] = None

    for fragment in chronicle:
        aeon       = fragment["aeon"]
        event_type = fragment.get("event_type", "event")
        load       = fragment["load"]
        cid        = fragment["cell_id"]
        regs       = fragment.get("registers", [])

        # Era header when the aeon changes
        if aeon != current_aeon:
            current_aeon = aeon
            era = era_names.get(aeon, f"the {aeon}th aeon")
            lines.append(f"\n── {era.upper()} ──\n")

        blend     = build_register_blend(regs)
        tier      = load_tier(load)
        site_name = site_names.get(cid, "the hold")
        era_name  = era_names.get(aeon, "the unnamed age")

        # Agent name: org if present, otherwise generic
        org_id_str = str(fragment.get("organization_id", "")) if fragment.get("organization_id") is not None else None
        if org_id_str and org_id_str in org_agent_names:
            agent_name = org_agent_names[org_id_str]
        else:
            agent_name = f"those of {site_name}"

        patient_name = EVENT_PATIENTS.get(event_type, "the unnamed")

        entry_seed = rng.randint(0, 2 ** 32)
        entry = generate_chronicle_entry(
            graph,
            blend,
            tier,
            event_type=event_type,
            site_name=site_name,
            agent_name=agent_name,
            patient_name=patient_name,
            era_name=era_name,
            seed=entry_seed,
        )

        # Load marker: ✦ mythic, · medium
        marker = "✦" if load >= 0.66 else "·"
        lines.append(f"  {marker}  {entry}")

    lines.append("\n" + "=" * 70)
    return "\n".join(lines)


# =========================================================================
# MAIN
# =========================================================================

def main() -> None:
    world_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DATA_DIR / "world_state.json"

    if not world_path.exists():
        print(f"Error: {world_path} not found.")
        print("Run `npm run generate` first to produce the world state file.")
        sys.exit(1)

    with open(world_path) as f:
        state = json.load(f)

    graph = SemanticGraph()
    graph.load(str(DATA_DIR))

    output = render_chronicle(state, graph)
    print(output)


if __name__ == "__main__":
    main()
