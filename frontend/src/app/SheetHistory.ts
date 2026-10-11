export interface SheetState {
  readonly depth: number;
  /** The paths of the in-app entries under this one, nearest last. */
  readonly trail: readonly string[];
}

/**
 * How many in-app history entries sit below the current one, and which paths they show. Kept in the router's
 * location state, so the hardware back button (Android) and the browser back button close the topmost sheet and
 * only leave at the map. A change that keeps the entry (a filter in the address) must carry this state along.
 */
export class SheetHistory {
  static depth(state: unknown): number {
    if (typeof state !== 'object' || state === null || !('depth' in state)) return 0;
    const { depth } = state;
    return typeof depth === 'number' && depth > 0 ? depth : 0;
  }

  static trail(state: unknown): readonly string[] {
    if (typeof state !== 'object' || state === null || !('trail' in state) || !Array.isArray(state.trail)) return [];
    return state.trail.filter((path): path is string => typeof path === 'string');
  }

  /** Location state for an entry pushed on top of one at `depth`. */
  static above(depth: number, trail: readonly string[] = []): SheetState {
    return { depth: depth + 1, trail };
  }

  /** Location state for an entry that replaces one at `depth`. */
  static at(depth: number, trail: readonly string[] = []): SheetState {
    return { depth, trail };
  }

  /** State for a sheet opened over `state`'s entry at `path`: one level deeper, with `path` last in its trail. */
  static over(state: unknown, path: string): SheetState {
    return SheetHistory.above(SheetHistory.depth(state), [...SheetHistory.trail(state), path]);
  }

  /** State for a sheet that takes the place of `state`'s entry: the same entries stay under it. */
  static replacing(state: unknown): SheetState {
    return SheetHistory.at(SheetHistory.depth(state), SheetHistory.trail(state));
  }

  /** How many steps back the nearest entry at `path` is, or 0 when no entry under this one shows it. */
  static stepsTo(state: unknown, path: string): number {
    const trail = SheetHistory.trail(state);
    const index = trail.lastIndexOf(path);
    return index === -1 ? 0 : Math.min(trail.length - index, SheetHistory.depth(state));
  }
}
