"""
The Sediment — Semantic Graph Engine
=====================================
Loads category vocabulary and register pull weights.
Computes word-to-register affinity at load time.
Draws words via weighted random walk.
Assembles names from grammar patterns.

Usage:
    python graph_engine.py                     # run explorer demo
    python graph_engine.py explore DEATH 0.7 MYSTERY 0.3
    python graph_engine.py names DEATH 0.7 MYSTERY 0.3
    python graph_engine.py era DEATH 0.7 ANCIENT 0.3
"""

import json
import random
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from pathlib import Path


# =========================================================================
# DATA STRUCTURES
# =========================================================================

@dataclass
class Word:
    """A single word in the graph with all its forms and metadata."""
    key: str                        # unique identifier
    category: str                   # which category it came from
    part: str                       # "noun", "adjective", "verb"
    roles: List[str]                # grammatical roles
    voice: str = "functional"       # functional, atmospheric, chronicle
    # Forms
    sing: str = ""
    plur: str = ""
    adj: str = ""
    base: str = ""
    past: str = ""
    pp: str = ""
    gerund: str = ""
    # Computed
    affinities: Dict[str, float] = field(default_factory=dict)
    categories: List[str] = field(default_factory=list)  # all categories this word appears in

    @property
    def display(self) -> str:
        if self.part == "noun":
            return self.sing
        elif self.part == "adjective":
            return self.adj
        elif self.part == "verb":
            return self.base
        return self.key


# =========================================================================
# THE GRAPH
# =========================================================================

class SemanticGraph:

    def __init__(self):
        self.words: Dict[str, Word] = {}
        self.categories: Dict[str, List[str]] = {}  # cat_name → [word_keys]
        self.register_pulls: Dict[str, Dict[str, float]] = {}
        self.patterns: Dict[str, List[dict]] = {}

    # -----------------------------------------------------------------
    # LOADING
    # -----------------------------------------------------------------

    def load(self, data_dir: str = "data"):
        """Load all data files and compute affinities."""
        base = Path(data_dir)

        with open(base / "categories.json", "r") as f:
            cat_data = json.load(f)

        with open(base / "registers.json", "r") as f:
            self.register_pulls = json.load(f)

        with open(base / "grammar.json", "r") as f:
            self.patterns = json.load(f)

        # Parse categories into Word objects
        word_counter = 0
        # Track which words appear in multiple categories by display form
        display_to_keys = defaultdict(list)

        for cat_name, cat_info in cat_data.items():
            self.categories[cat_name] = []

            # Nouns
            for n in cat_info.get("nouns", []):
                word_counter += 1
                key = f"{cat_name}:{n['sing']}:{word_counter}"
                w = Word(
                    key=key, category=cat_name, part="noun",
                    roles=n.get("roles", []),
                    sing=n["sing"], plur=n.get("plur", n["sing"] + "s"),
                    voice="functional",
                    categories=[cat_name],
                )
                self.words[key] = w
                self.categories[cat_name].append(key)
                display_to_keys[n["sing"]].append(key)

            # Adjectives
            for a in cat_info.get("adjectives", []):
                word_counter += 1
                key = f"{cat_name}:{a['word']}:{word_counter}"
                w = Word(
                    key=key, category=cat_name, part="adjective",
                    roles=a.get("roles", []),
                    adj=a["word"],
                    voice=a.get("voice", "functional"),
                    categories=[cat_name],
                )
                self.words[key] = w
                self.categories[cat_name].append(key)
                display_to_keys[a["word"]].append(key)

            # Verbs
            for v in cat_info.get("verbs", []):
                word_counter += 1
                key = f"{cat_name}:{v['base']}:{word_counter}"
                w = Word(
                    key=key, category=cat_name, part="verb",
                    roles=v.get("roles", ["VERB_PAST", "VERB_PP", "VERB_GERUND"]),
                    base=v["base"], past=v.get("past", ""),
                    pp=v.get("pp", ""), gerund=v.get("gerund", ""),
                    voice=v.get("voice", "plain"),
                    categories=[cat_name],
                )
                self.words[key] = w
                self.categories[cat_name].append(key)
                display_to_keys[v["base"]].append(key)

        # Mark cross-membership: words with same display form in multiple categories
        for display, keys in display_to_keys.items():
            if len(keys) > 1:
                all_cats = list(set(self.words[k].category for k in keys))
                for k in keys:
                    self.words[k].categories = all_cats

        # Compute affinities
        self._compute_affinities()

        stats = self._stats()
        return stats

    def _compute_affinities(self):
        """
        For each word, compute affinity to each register.
        affinity[register] = sum(register.pull[cat] for cat in word.categories)
        Normalized by category count to prevent multi-membership inflation.
        """
        for word in self.words.values():
            cat_count = len(word.categories)
            norm = 1.0 / cat_count if cat_count > 0 else 1.0

            for reg_name, pulls in self.register_pulls.items():
                score = 0.0
                for cat in word.categories:
                    score += pulls.get(cat, 0.0)
                word.affinities[reg_name] = score * norm

    def _stats(self) -> dict:
        parts = defaultdict(int)
        for w in self.words.values():
            parts[w.part] += 1
        return {
            "total_words": len(self.words),
            "categories": len(self.categories),
            "registers": len(self.register_pulls),
            "nouns": parts["noun"],
            "adjectives": parts["adjective"],
            "verbs": parts["verb"],
        }

    # -----------------------------------------------------------------
    # DRAWING
    # -----------------------------------------------------------------

    def draw(
        self,
        registers: Dict[str, float],
        count: int = 5,
        part: Optional[str] = None,
        role: Optional[str] = None,
        voice_max: Optional[str] = None,
        exclude_displays: Optional[set] = None,
        rng: Optional[random.Random] = None,
    ) -> List[Word]:
        """
        Weighted random draw from the graph.

        registers: blend weights, e.g. {"DEATH": 0.7, "MYSTERY": 0.3}
        part: filter by "noun", "adjective", "verb"
        role: filter by grammatical role e.g. "FRONT_ADJ", "THE_NOUN"
        voice_max: maximum voice tier ("functional", "atmospheric", "chronicle")
        exclude_displays: set of display strings to skip (no repeats)
        """
        if rng is None:
            rng = random.Random()
        if exclude_displays is None:
            exclude_displays = set()

        voice_order = ["plain", "functional", "atmospheric", "weighted", "chronicle"]
        max_idx = voice_order.index(voice_max) if voice_max and voice_max in voice_order else len(voice_order) - 1

        candidates = []
        for word in self.words.values():
            # Filters
            if part and word.part != part:
                continue
            if role and role not in word.roles:
                continue
            word_voice_idx = voice_order.index(word.voice) if word.voice in voice_order else 0
            if word_voice_idx > max_idx:
                continue
            if word.display in exclude_displays:
                continue

            # Compute blended score
            score = 0.0
            for reg, weight in registers.items():
                score += word.affinities.get(reg, 0.0) * weight

            if score > 0.08:  # minimum affinity cutoff
                candidates.append((word, score))

        if not candidates:
            return []

        # Weighted random sampling without replacement
        results = []
        remaining = list(candidates)
        for _ in range(min(count, len(remaining))):
            total = sum(s for _, s in remaining)
            if total <= 0:
                break
            roll = rng.random() * total
            cumulative = 0.0
            chosen_idx = len(remaining) - 1
            for i, (w, s) in enumerate(remaining):
                cumulative += s
                if roll <= cumulative:
                    chosen_idx = i
                    break
            results.append(remaining[chosen_idx][0])
            remaining.pop(chosen_idx)

        return results

    # -----------------------------------------------------------------
    # EXPLORATION
    # -----------------------------------------------------------------

    def explore(
        self,
        registers: Dict[str, float],
        top_n: int = 15,
    ) -> Dict[str, List[Tuple[str, float]]]:
        """
        Show top-scoring words per part of speech for a register blend.
        The debug tool.
        """
        results = {"nouns": [], "adjectives": [], "verbs": []}

        for word in self.words.values():
            score = sum(
                word.affinities.get(r, 0.0) * w
                for r, w in registers.items()
            )
            if score <= 0:
                continue

            part_key = word.part + "s"  # noun→nouns, etc.
            if part_key not in results:
                part_key = "nouns"
            results[part_key].append((word.display, score, word.voice, word.categories))

        # Sort and deduplicate by display name
        for part in results:
            seen = set()
            deduped = []
            results[part].sort(key=lambda x: -x[1])
            for display, score, voice, cats in results[part]:
                if display not in seen:
                    seen.add(display)
                    deduped.append((display, score, voice, cats))
            results[part] = deduped[:top_n]

        return results

    # -----------------------------------------------------------------
    # NAME ASSEMBLY
    # -----------------------------------------------------------------

    # Good compound suffixes — short, place-like, phonetically clean
    COMPOUND_REAR_WHITELIST = {
        "bridge", "gate", "ford", "watch", "hold", "keep", "wall",
        "spire", "mark", "pass", "port", "rest", "reach", "stone",
        "ridge", "cliff", "crag", "cairn", "tower", "arch", "well",
        "den", "nest", "horn", "forge", "hearth", "tomb", "vault",
        "crypt", "pool", "shade", "hill", "bluff", "ward", "way",
        "mill", "breach", "grove", "fen", "seam", "barrow",
    }

    def generate_name(
        self,
        pattern_type: str,
        registers: Dict[str, float],
        rng: Optional[random.Random] = None,
        site_name: str = "",
    ) -> str:
        """
        Assemble a name from a grammar pattern filled by graph draws.
        """
        if rng is None:
            rng = random.Random()

        patterns = self.patterns.get(pattern_type, [])
        if not patterns:
            return "[no patterns]"

        # Weighted pattern selection
        total = sum(p["weight"] for p in patterns)
        roll = rng.random() * total
        cumulative = 0.0
        chosen_pattern = patterns[-1]["pattern"]
        for p in patterns:
            cumulative += p["weight"]
            if roll <= cumulative:
                chosen_pattern = p["pattern"]
                break

        # Fill slots
        used = set()
        result = chosen_pattern

        def fill_slot(slot_text: str) -> str:
            """Parse a slot like {FRONT_ADJ} or {OF_NOUN:plur} and fill it."""
            parts = slot_text.strip("{}").split(":")
            role = parts[0]
            modifiers = parts[1:]

            # Map role to part of speech and grammatical role
            if role in ("FRONT_ADJ", "REAR_ADJ"):
                drawn = self.draw(registers, 1, part="adjective", role=role,
                                  exclude_displays=used, rng=rng)
                if drawn:
                    used.add(drawn[0].display)
                    word = drawn[0].adj
                else:
                    return "[?]"
            elif role in ("THE_NOUN", "OF_NOUN"):
                drawn = self.draw(registers, 1, part="noun", role=role,
                                  exclude_displays=used, rng=rng)
                if drawn:
                    used.add(drawn[0].display)
                    word = drawn[0].plur if "plur" in modifiers else drawn[0].sing
                else:
                    return "[?]"
            elif role == "FRONT_COMPOUND":
                drawn = self.draw(registers, 1, part="noun", role=role,
                                  exclude_displays=used, rng=rng)
                if drawn:
                    used.add(drawn[0].display)
                    word = drawn[0].sing
                else:
                    return "[?]"
            elif role == "REAR_COMPOUND":
                # Filter through whitelist for clean compound suffixes
                drawn = self.draw(registers, 8, part="noun", role=role,
                                  exclude_displays=used, rng=rng)
                match = next((w for w in drawn if w.sing in self.COMPOUND_REAR_WHITELIST), None)
                if match:
                    used.add(match.display)
                    word = match.sing
                elif drawn:
                    used.add(drawn[0].display)
                    word = drawn[0].sing
                else:
                    return "[?]"
            elif role == "VERB_PAST":
                drawn = self.draw(registers, 1, part="verb",
                                  exclude_displays=used, rng=rng)
                if drawn:
                    used.add(drawn[0].display)
                    word = drawn[0].past
                else:
                    return "[?]"
            elif role == "SITE":
                return site_name or "the hold"
            else:
                return f"[{role}?]"

            if "upper" in modifiers:
                word = word.upper()
            return word

        # Find and replace all {SLOT} patterns
        import re
        def replacer(match):
            return fill_slot(match.group(0))

        result = re.sub(r"\{[^}]+\}", replacer, result)

        # Capitalize compound names
        if not result.startswith("the ") and not result.startswith("THE "):
            result = result[0].upper() + result[1:] if result else result

        return result

    def generate_names(
        self,
        pattern_type: str,
        registers: Dict[str, float],
        count: int = 10,
        seed: int = None,
    ) -> List[str]:
        """Generate multiple names."""
        rng = random.Random(seed)
        names = []
        for i in range(count):
            # Re-seed each name for variety but determinism
            sub_rng = random.Random(rng.randint(0, 2**32))
            name = self.generate_name(pattern_type, registers, rng=sub_rng)
            names.append(name)
        return names


# =========================================================================
# CLI
# =========================================================================

def parse_register_args(args: List[str]) -> Dict[str, float]:
    """Parse 'DEATH 0.7 MYSTERY 0.3' into dict."""
    registers = {}
    i = 0
    while i < len(args) - 1:
        try:
            reg = args[i].upper()
            weight = float(args[i + 1])
            registers[reg] = weight
            i += 2
        except (ValueError, IndexError):
            i += 1
    return registers


def print_explore(graph: SemanticGraph, registers: Dict[str, float]):
    """Print the exploration view."""
    blend_str = " + ".join(f"{r}:{w:.1f}" for r, w in registers.items())
    print(f"\n{'='*60}")
    print(f"  GRAPH EXPLORER: {blend_str}")
    print(f"{'='*60}")

    results = graph.explore(registers)

    for part_name, words in results.items():
        print(f"\n  {part_name.upper()}:")
        for display, score, voice, cats in words:
            cat_str = ", ".join(cats)
            voice_marker = {"functional": " ", "atmospheric": "~", "chronicle": "*",
                           "plain": " ", "weighted": "~"}.get(voice, " ")
            bar = "█" * int(score * 15)
            print(f"    {voice_marker} {display:20s} {score:.3f} {bar:20s}  [{cat_str}]")


def print_names(graph: SemanticGraph, registers: Dict[str, float],
                pattern_type: str, count: int = 15):
    blend_str = " + ".join(f"{r}:{w:.1f}" for r, w in registers.items())
    print(f"\n{'='*60}")
    print(f"  {pattern_type.upper()} NAMES: {blend_str}")
    print(f"{'='*60}\n")

    names = graph.generate_names(pattern_type, registers, count=count, seed=42)
    for name in names:
        print(f"    {name}")


def main():
    graph = SemanticGraph()
    stats = graph.load("data")

    args = sys.argv[1:]

    if not args:
        # Default demo: run everything
        print(f"\nLoaded: {stats['total_words']} words across "
              f"{stats['categories']} categories, {stats['registers']} registers")
        print(f"  Nouns: {stats['nouns']}  Adjectives: {stats['adjectives']}  "
              f"Verbs: {stats['verbs']}")

        test_blends = [
            ("DEATH / MYSTERY", {"DEATH": 0.7, "MYSTERY": 0.3}),
            ("DEATH / ANCIENT", {"DEATH": 0.6, "ANCIENT": 0.4}),
            ("ANCIENT / MYTHIC", {"ANCIENT": 0.5, "MYTHIC": 0.5}),
            ("WILD / FIRE", {"WILD": 0.6, "FIRE": 0.4}),
            ("MYSTERY pure", {"MYSTERY": 1.0}),
            ("EVIL / POWER", {"EVIL": 0.6, "POWER": 0.4}),
            ("DARKNESS / MAGIC", {"DARKNESS": 0.5, "MAGIC": 0.5}),
            ("VIOLENT / BEAST", {"VIOLENT": 0.6, "WILD": 0.4}),
        ]

        for label, blend in test_blends:
            print(f"\n{'─'*60}")
            print(f"  {label}")
            print(f"{'─'*60}")

            # Top words
            results = graph.explore(blend, top_n=8)
            for part_name in ["nouns", "adjectives"]:
                words = results[part_name]
                display_words = [w[0] for w in words[:8]]
                print(f"  {part_name:12s}: {', '.join(display_words)}")

            # Names
            names = graph.generate_names("site_name", blend, count=8, seed=42)
            print(f"  {'sites':12s}: {' · '.join(names[:4])}")
            print(f"               {' · '.join(names[4:8])}")

            era_names = graph.generate_names("era_title", blend, count=4, seed=99)
            print(f"  {'eras':12s}: {' · '.join(era_names[:2])}")
            print(f"               {' · '.join(era_names[2:4])}")

    elif args[0] == "explore":
        registers = parse_register_args(args[1:])
        if not registers:
            print("Usage: graph_engine.py explore DEATH 0.7 MYSTERY 0.3")
            return
        print_explore(graph, registers)

    elif args[0] == "names":
        registers = parse_register_args(args[1:])
        if not registers:
            print("Usage: graph_engine.py names DEATH 0.7 MYSTERY 0.3")
            return
        print_names(graph, registers, "site_name")

    elif args[0] == "era":
        registers = parse_register_args(args[1:])
        if not registers:
            print("Usage: graph_engine.py era DEATH 0.7 ANCIENT 0.3")
            return
        print_names(graph, registers, "era_title")

    elif args[0] == "chronicle":
        registers = parse_register_args(args[1:])
        if not registers:
            test_blends = [
                {"DEATH": 0.7, "ANCIENT": 0.3},
                {"MYSTERY": 0.6, "DARKNESS": 0.4},
                {"ANCIENT": 0.5, "MYTHIC": 0.5},
                {"VIOLENT": 0.7, "FIRE": 0.3},
            ]
            for blend in test_blends:
                print_chronicle(graph, blend)
        else:
            print_chronicle(graph, registers)

    else:
        print("Commands: explore, names, era, chronicle")
        print("Example: python graph_engine.py explore DEATH 0.7 MYSTERY 0.3")


# =========================================================================
# CHRONICLE GENERATOR
# =========================================================================

# Source quality tiers from the GDD
CHRONICLE_TEMPLATES = {
    1: [  # Good sources — functional voice
        "It is recorded that {agent} {verb_past} at {site} in {timeref}.",
        "In {timeref}, {agent} {verb_past} at {site}. The cause, as recorded, was {cause}.",
        "It is recorded that the {adj} {noun} at {site} {verb_past} in {timeref}.",
    ],
    2: [  # Decent sources — atmospheric voice
        "It was written that {agent} {verb_past}, though the account was set down long after.",
        "Chronicles state that {agent} and {patient} came to terms at {site}. The terms are not preserved.",
        "It was written that {agent} {verb_past} at {site} in {timeref}. What followed is unclear.",
    ],
    3: [  # Poor sources — atmospheric to chronicle voice
        "The stories agree only that {agent} and {patient} met at {site} and that {site} was not the same afterward.",
        "Some hold that {cause} was the beginning. Others name {agent}. Neither account survives in full.",
        "What {verb_past} at {site} left the {adj} {noun}. No other record from {timeref} survives.",
    ],
    4: [  # Fragments — chronicle voice
        "No name survives for what happened at {site}. The {adj} {noun} bears the mark of it.",
        "Fragments suggest {agent} and {patient} were the same thing by the end.",
        "In {timeref}, something {verb_past}. The next clear account does not acknowledge the gap.",
        "Of the {adj} {noun} at {site}, nothing further is recorded.",
    ],
}

TIMEREFS_BY_AGE = [
    "the first years",
    "the years before the naming",
    "the age before the records",
    "the forty-third year of {era}",
    "the last years of {era}",
    "the years after the {adj} {noun}",
    "the time when the {noun} still held",
]


def generate_chronicle_entry(
    graph: SemanticGraph,
    registers: Dict[str, float],
    tier: int,
    event_type: str = "revolt",
    site_name: str = "the Ford",
    agent_name: str = "those of Maret",
    patient_name: str = "the old names",
    era_name: str = "the Barren Century",
    seed: int = None,
):
    """Generate a single chronicle entry from a register blend and quality tier."""
    rng = random.Random(seed)
    tier = max(1, min(4, tier))

    # Voice tier based on source quality
    voice_max = {1: "functional", 2: "atmospheric", 3: "atmospheric", 4: "chronicle"}[tier]

    templates = CHRONICLE_TEMPLATES[tier]
    template = rng.choice(templates)

    used = set()

    # Draw vocabulary from graph
    verbs = graph.draw(registers, 3, part="verb", voice_max=voice_max,
                       exclude_displays=used, rng=rng)
    adjs = graph.draw(registers, 3, part="adjective", voice_max=voice_max,
                      exclude_displays=used, rng=rng)
    nouns = graph.draw(registers, 3, part="noun", voice_max=voice_max,
                       exclude_displays=used, rng=rng)

    verb_past = verbs[0].past if verbs else "fell"
    adj = adjs[0].adj if adjs else "old"
    noun = nouns[0].sing if nouns else "place"

    # Build cause phrase from graph
    cause_adjs = graph.draw(registers, 2, part="adjective", voice_max=voice_max,
                            exclude_displays=used, rng=rng)
    cause_nouns = graph.draw(registers, 2, part="noun", voice_max=voice_max,
                             exclude_displays=used, rng=rng)
    if cause_adjs and cause_nouns:
        cause = f"the {cause_adjs[0].adj} {cause_nouns[0].sing}"
    elif cause_nouns:
        cause = f"the {cause_nouns[0].sing}"
    else:
        cause = "what came before"

    # Build timeref
    timeref_template = rng.choice(TIMEREFS_BY_AGE)
    era_clean = era_name[4:].lower() if era_name.startswith("THE ") else era_name.lower()
    timeref = timeref_template.format(era=era_clean, adj=adj, noun=noun)

    # Fill template
    result = template.format(
        agent=agent_name,
        patient=patient_name,
        site=site_name,
        verb_past=verb_past,
        adj=adj,
        noun=noun,
        cause=cause,
        timeref=timeref,
    )

    return result


def print_chronicle(graph: SemanticGraph, registers: Dict[str, float]):
    """Generate a full chronicle test across all tiers."""
    blend_str = " + ".join(f"{r}:{w:.1f}" for r, w in registers.items())
    print(f"\n{'='*60}")
    print(f"  CHRONICLE TEST: {blend_str}")
    print(f"{'='*60}")

    # Generate a site name for this register blend
    site_rng = random.Random(42)
    site_name = graph.generate_name("site_name", registers, rng=site_rng)
    era_rng = random.Random(99)
    era_name = graph.generate_name("era_title", registers, rng=era_rng)

    print(f"\n  Site: {site_name}")
    print(f"  Era:  {era_name}")

    agents = [
        "those of Maret", "the people of the ford", "the old council",
        "the unnamed", "the keepers", "the exiled",
    ]
    patients = [
        "the old names", "the southern holds", "the compact",
        "what remained", "the covenant", "the watch",
    ]

    for tier in range(1, 5):
        tier_labels = {1: "GOOD SOURCES", 2: "DECENT SOURCES",
                       3: "POOR SOURCES", 4: "FRAGMENTS"}
        print(f"\n  --- Tier {tier}: {tier_labels[tier]} ---\n")
        for i in range(3):
            entry = generate_chronicle_entry(
                graph, registers, tier,
                site_name=site_name,
                agent_name=agents[(tier + i) % len(agents)],
                patient_name=patients[(tier + i + 1) % len(patients)],
                era_name=era_name,
                seed=tier * 100 + i,
            )
            print(f"    {entry}")
            print()


if __name__ == "__main__":
    main()
