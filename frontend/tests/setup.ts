import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';
import { HistoryLayers } from '../src/ui/HistoryLayers';
import { preloadFixtures } from './fixturePreload';

// Most tests render the whole app in jsdom, so a findBy or waitFor waits for React renders of every sheet and
// for the mock services, not for one small component. On an idle machine those waits take 0.05 to 0.5 s; with
// three suites sharing the CPU (CI, or other worktrees testing at once) about 90 per suite took over 1 s, Testing
// Library's default, and the slowest 4.2 s; 13 calls had raised their own timeout to 3 s, which was too short
// too. A wait still ends as soon as its check passes, so this bound only sets how long a broken test takes to fail.
configure({ asyncUtilTimeout: 10_000 });

beforeAll(preloadFixtures);

// jsdom has no object URLs; the Snap review preview uses them.
if (typeof URL.createObjectURL !== 'function') {
  Object.assign(URL, { createObjectURL: () => 'blob:test-photo', revokeObjectURL: () => undefined });
}

// jsdom has no canvas; report WebGL2 as present so map tests reach their mocked map view. Fallback tests override this.
HTMLCanvasElement.prototype.getContext = (() => ({ getExtension: () => null })) as unknown as HTMLCanvasElement['getContext'];

// Taken before any test installs fake timers, so the wait below never hangs on a faked clock.
const realTimeout = globalThis.setTimeout;
const realImmediate = globalThis.setImmediate;
// jsdom lands a step back two queued tasks after history.go(); the rest is margin, and it bounds a step that never lands.
const LANDING_TURNS = 50;

/**
 * The tests of a file share one window, so one history. A test that ends with a sheet or card open unmounts it, and
 * the layer then takes its entry with it a task later (useHistoryLayer's dropLater), a step back that jsdom lands
 * two tasks after that. The next test must not start while it is in flight: on a loaded runner its first entry was
 * pushed on top of the old test's entry, the step back landed on that stale entry, and the navigation that waited
 * for it never ran (SiteStack's "opens a site sheet from a row" failing in CI with the bare map on screen).
 */
async function settleHistory(): Promise<void> {
  // Timers of one delay fire in the order they were set, so this one fires after every dropLater of the unmount.
  await new Promise((resolve) => realTimeout(resolve, 0));
  for (let turn = 0; turn < LANDING_TURNS && HistoryLayers.leaving(); turn += 1) {
    await new Promise((resolve) => realImmediate(resolve));
  }
}

afterEach(async () => {
  cleanup();
  await settleHistory();
});
