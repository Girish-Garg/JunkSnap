/**
 * Sheets and dialogs that are not routes sit as extra history entries on top of their route's entry
 * (useHistoryLayer); each entry carries the tokens of every layer up to it in history.state.layers.
 */
// A step back that has not landed after this long is not coming.
const PENDING_POP_MS = 1000;

export class HistoryLayers {
  static of(state: unknown): readonly string[] {
    if (typeof state !== 'object' || state === null || !('layers' in state)) return [];
    return Array.isArray(state.layers) ? state.layers.filter((item): item is string => typeof item === 'string') : [];
  }

  static open(): readonly string[] {
    return HistoryLayers.of(window.history.state);
  }

  /**
   * True while a step back is on its way, so nothing else goes back a second time before it lands. The mark
   * holds the time it was set: a step back lands within a frame or two, so an old mark (an entry reached
   * again with the browser's forward button, or a step back that went nowhere) no longer counts.
   */
  static leaving(): boolean {
    const state: unknown = window.history.state;
    if (typeof state !== 'object' || state === null || !('unwinding' in state)) return false;
    return typeof state.unwinding === 'number' && Date.now() - state.unwinding < PENDING_POP_MS;
  }

  /** Pushes the layer's entry once; StrictMode's second effect run finds it already there. */
  static push(token: string): void {
    const state: unknown = window.history.state;
    if (HistoryLayers.of(state).includes(token)) return;
    // The new entry starts clean: a leaving mark belongs to the entry it was set on.
    const base: Record<string, unknown> = typeof state === 'object' && state !== null ? { ...state } : {};
    delete base.unwinding;
    window.history.pushState({ ...base, layers: [...HistoryLayers.of(state), token] }, '');
  }

  /** Goes back `steps` entries, marking the entry it leaves so a second request waits instead of piling on. */
  static back(steps = 1): void {
    window.history.replaceState({ ...(window.history.state as object), unwinding: Date.now() }, '');
    window.history.go(-steps);
  }

  /**
   * Takes every open layer off the stack in one step, then runs `then` (a route change that replaces them).
   * Each layer's own popstate listener closes it first, so nothing is left under the next sheet. A step back
   * already on its way is waited for, so two requests never pop two levels.
   */
  static unwind(then: () => void): void {
    if (HistoryLayers.leaving()) {
      HistoryLayers.afterPop(() => HistoryLayers.unwind(then));
      return;
    }
    const count = HistoryLayers.open().length;
    if (count === 0) {
      then();
      return;
    }
    HistoryLayers.afterPop(then);
    HistoryLayers.back(count);
  }

  /** Runs `then` once the next step back has landed. */
  static afterPop(then: () => void): void {
    const listener = () => {
      window.removeEventListener('popstate', listener);
      then();
    };
    window.addEventListener('popstate', listener);
  }
}
