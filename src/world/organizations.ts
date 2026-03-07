import type { RNG } from './rng'
import type { OrgType, WorldGraph } from './types'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OrganizationConfig {
  /**
   * Maximum number of organizations to seed.
   * Actual count is capped by available settled cells.  Default 12.
   */
  maxOrganizations?: number
  /**
   * Maximum number of cells each organization operates in.
   * Organizations expand via BFS from their origin.  Default 3.
   */
  orgSpread?: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_TYPES: OrgType[] = ['cult', 'religion', 'mercenary', 'sect']

/**
 * Primary register amplified by each organization type.
 * Chosen to reflect the symbolic character of each kind of group.
 */
const ORG_REGISTERS: Record<OrgType, string> = {
  cult:      'MYSTERY',
  religion:  'MYTHIC',
  mercenary: 'VIOLENT',
  sect:      'EVIL',
}

// ---------------------------------------------------------------------------
// Pipeline stage
// ---------------------------------------------------------------------------

/**
 * Seeds small, specialized organizations (cults, religions, mercenary companies,
 * sects) in settled territory and marks the cells they operate in.
 *
 * Unlike civilizations, organizations:
 *   - May overlap with civilization-claimed cells and with each other
 *   - May also seed in unclaimed wilderness (nomadic sects, wandering cults)
 *   - Carry fast-drift instability — they are inherently volatile
 *   - Amplify a primary register in every cell they occupy
 *
 * Writes into `graph.organizations` and sets `cell.organizations` on each
 * affected cell.
 *
 * Requires `applyEvents` (and all preceding stages) to have run first so that
 * collapse/war events can bias org placement toward interesting sites.
 *
 * @param graph  World graph mutated in place.
 * @param rng    Seeded RNG for reproducible placement.
 * @param config Tuning parameters; all fields have sensible defaults.
 */
export function applyOrganizations(
  graph: WorldGraph,
  rng: RNG,
  config: OrganizationConfig = {},
): void {
  const { maxOrganizations = 12, orgSpread = 3 } = config

  const cells = graph.cells
  if (cells.length === 0) return

  // -------------------------------------------------------------------------
  // 1. Build candidate pool: prefer cells touched by high-load events
  //    (collapse / war); fill up from general settled territory.
  // -------------------------------------------------------------------------

  const eventCells = new Set<number>()
  for (const event of graph.events) {
    if (event.load > 0.50 && (event.type === 'collapse' || event.type === 'war')) {
      eventCells.add(event.cellId)
    }
  }

  const dramatic = cells.filter(c => !c.ocean && eventCells.has(c.id))
  const settled = cells.filter(c => !c.ocean && c.civilization !== undefined && !eventCells.has(c.id))
  const wilderness = cells.filter(c => !c.ocean && c.civilization === undefined && !eventCells.has(c.id))

  // Weighted candidate order: dramatic sites first, then settled, then wilderness
  const candidates = [...dramatic, ...settled, ...wilderness]

  // Shuffle within each tier to avoid systematic bias
  const shuffle = (arr: typeof candidates) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  const origins = shuffle([
    ...shuffle(dramatic),
    ...shuffle(settled),
    ...shuffle(wilderness),
  ]).slice(0, maxOrganizations)

  // -------------------------------------------------------------------------
  // 2. Seed each organization from its origin cell
  // -------------------------------------------------------------------------

  for (let orgId = 0; orgId < origins.length; orgId++) {
    const origin = origins[orgId]
    const type = ORG_TYPES[Math.floor(rng() * ORG_TYPES.length)]
    // Organizations start highly unstable (40–90 %)
    const instability = 0.40 + rng() * 0.50
    const register = ORG_REGISTERS[type]

    // BFS spread from origin (can enter any non-ocean cell, including wilderness)
    const orgCells: number[] = [origin.id]
    const visited = new Set<number>([origin.id])
    const queue: number[] = [origin.id]

    while (queue.length > 0 && orgCells.length < orgSpread) {
      const cur = queue.shift()!
      for (const nid of cells[cur].neighbors) {
        if (!visited.has(nid) && !cells[nid].ocean && orgCells.length < orgSpread) {
          visited.add(nid)
          orgCells.push(nid)
          queue.push(nid)
        }
      }
    }

    // Mark cells with this org's membership
    for (const cid of orgCells) {
      if (!cells[cid].organizations) cells[cid].organizations = []
      cells[cid].organizations!.push(orgId)
    }

    graph.organizations.push({ id: orgId, type, cells: orgCells, instability, register })
  }
}
