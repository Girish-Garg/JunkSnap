import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';
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

afterEach(() => cleanup());
