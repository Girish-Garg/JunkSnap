import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useMapSelection } from '../src/features/map/hooks/useMapSelection';
import { testSite } from './siteBuilder';

const SITE_A = testSite({ site_id: 'site_a', coordinates: [73.0, 26.26] });
const SITE_B = testSite({ site_id: 'site_b', coordinates: [73.04, 26.27] });

function wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <MemoryRouter>
      <Routes>
        <Route path="*" element={children} />
      </Routes>
    </MemoryRouter>
  );
}

const renderSelection = () =>
  renderHook(() => ({ selection: useMapSelection([SITE_A, SITE_B]), path: useLocation().pathname }), { wrapper });

describe('useMapSelection', () => {
  it('previews a tapped pin and clears it on an empty tap', () => {
    const { result } = renderSelection();
    act(() => result.current.selection.pick('site_a'));
    expect(result.current.selection.preview?.properties.site_id).toBe('site_a');
    expect(result.current.selection.selectedId).toBe('site_a');
    act(() => result.current.selection.pick(null));
    expect(result.current.selection.preview).toBeNull();
  });

  it('opens the site sheet from Details and moves the camera there', () => {
    const { result } = renderSelection();
    act(() => result.current.selection.pick('site_b'));
    act(() => result.current.selection.openDetails(SITE_B));
    expect(result.current.path).toBe('/sites/site_b');
    expect(result.current.selection.preview).toBeNull();
    expect(result.current.selection.camera?.points).toEqual([SITE_B.geometry.coordinates]);
  });

});

describe('useMapSelection places', () => {
  it('previews a one-site place and fits a larger one', () => {
    const { result } = renderSelection();
    act(() => result.current.selection.showPlace({ sites: [SITE_A], point: null }));
    expect(result.current.selection.preview?.properties.site_id).toBe('site_a');
    act(() => result.current.selection.showPlace({ sites: [SITE_A, SITE_B], point: [73.02, 26.27] }));
    expect(result.current.selection.preview).toBeNull();
    expect(result.current.selection.camera?.points).toHaveLength(2);
  });

  it('flies to the middle of a seat with no site loaded, at seat zoom', () => {
    const { result } = renderSelection();
    act(() => result.current.selection.showPlace({ sites: [], point: [72.9, 26.1] }));
    expect(result.current.selection.preview).toBeNull();
    expect(result.current.selection.camera).toEqual({ points: [[72.9, 26.1]], zoom: 10.5 });
  });

  it('frames points for the opening view without previewing a site', () => {
    const { result } = renderSelection();
    act(() => result.current.selection.frame([[73, 26], [73.1, 26.1]]));
    expect(result.current.selection.camera).toEqual({ points: [[73, 26], [73.1, 26.1]] });
    expect(result.current.selection.preview).toBeNull();
  });
});

describe('useMapSelection stacks', () => {
  it('lists a stack pin, never next to a preview card, and a single tap clears it', () => {
    const { result } = renderSelection();
    act(() => result.current.selection.pick('site_a'));
    act(() => result.current.selection.pickStack(['site_a', 'site_b', 'site_gone']));
    expect(result.current.selection.stack?.map((site) => site.properties.site_id)).toEqual(['site_a', 'site_b']);
    expect(result.current.selection.preview).toBeNull();
    act(() => result.current.selection.pick('site_b'));
    expect(result.current.selection.stack).toBeNull();
    expect(result.current.selection.preview?.properties.site_id).toBe('site_b');
  });

  it('closes the stack list when one of its sites opens', () => {
    const { result } = renderSelection();
    act(() => result.current.selection.pickStack(['site_a', 'site_b']));
    act(() => result.current.selection.openDetails(SITE_A));
    expect(result.current.selection.stack).toBeNull();
    expect(result.current.path).toBe('/sites/site_a');
  });
});
