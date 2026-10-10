/**
 * How many in-app history entries sit below the current one. Kept in the router's location state, so the
 * hardware back button (Android) and the browser back button close the topmost sheet and only leave at the map.
 */
export class SheetHistory {
  static depth(state: unknown): number {
    if (typeof state !== 'object' || state === null || !('depth' in state)) return 0;
    const { depth } = state;
    return typeof depth === 'number' && depth > 0 ? depth : 0;
  }

  /** Location state for an entry pushed on top of one at `depth`. */
  static above(depth: number): { readonly depth: number } {
    return { depth: depth + 1 };
  }

  /** Location state for an entry that replaces one at `depth`. */
  static at(depth: number): { readonly depth: number } {
    return { depth };
  }
}
