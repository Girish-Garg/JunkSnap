/**
 * Sheets and dialogs that are not routes sit as extra history entries on top of their route's entry
 * (useHistoryLayer); each entry carries the tokens of every layer up to it in history.state.layers.
 */
export class HistoryLayers {
  static of(state: unknown): readonly string[] {
    if (typeof state !== 'object' || state === null || !('layers' in state)) return [];
    return Array.isArray(state.layers) ? state.layers.filter((item): item is string => typeof item === 'string') : [];
  }

  static open(): readonly string[] {
    return HistoryLayers.of(window.history.state);
  }

  /** True while a step back is on its way, so nothing else goes back a second time before it lands. */
  static leaving(): boolean {
    const state: unknown = window.history.state;
    return typeof state === 'object' && state !== null && 'unwinding' in state && state.unwinding === true;
  }

  /** Pushes the layer's entry once; StrictMode's second effect run finds it already there. */
  static push(token: string): void {
    const state: unknown = window.history.state;
    if (HistoryLayers.of(state).includes(token)) return;
    const base = typeof state === 'object' && state !== null ? state : {};
    window.history.pushState({ ...base, layers: [...HistoryLayers.of(state), token] }, '');
  }

  /** Goes back `steps` entries, marking the entry it leaves so a second request waits instead of piling on. */
  static back(steps = 1): void {
    window.history.replaceState({ ...(window.history.state as object), unwinding: true }, '');
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
