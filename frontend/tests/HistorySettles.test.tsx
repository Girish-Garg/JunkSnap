import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { BBox } from '../src/domain/BBox';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import { HistoryLayers } from '../src/ui/HistoryLayers';
import { renderApp } from './helpers';

const seen: { last: SiteMapBindings | null } = { last: null };

vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

/**
 * The tests of a file share one window, so one history, and they run in the order written. A sheet still open when
 * a test ends gives its history entry back a task after the unmount (useHistoryLayer's dropLater), a step back
 * that jsdom lands two tasks later. tests/setup.ts waits for it after every test: started while that step was in
 * flight, the next test pushed its first entry on top of the old one and the step landed on the wrong entry, which
 * is how SiteStack's "opens a site sheet from a row" failed on a loaded CI runner with the bare map on screen.
 */
describe('the history between two tests of one file', () => {
  it('may be left with a sheet open and its entry on the stack (the stack list)', async () => {
    await renderApp(<AppRoutes />);
    await waitFor(() => expect(seen.last).not.toBeNull());
    act(() => seen.last?.onViewChange({ bbox: new BBox(72.5, 26, 76, 27.2) }));
    await waitFor(() => expect(seen.last?.sites.length).toBeGreaterThan(2));
    act(() => seen.last?.onPickStack(['site_jdh_1', 'site_jpr_1']));
    expect(await screen.findByRole('heading', { level: 2, name: '2 sites at this spot' })).toBeInTheDocument();
    expect(HistoryLayers.open()).toHaveLength(1);
  });

  it('has settled before the next test runs its first line: no entry left, no step back in flight', () => {
    expect(HistoryLayers.open()).toEqual([]);
    expect(HistoryLayers.leaving()).toBe(false);
  });
});
