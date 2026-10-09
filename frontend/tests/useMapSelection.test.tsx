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

  it('previews a one-site place and fits a larger one', () => {
    const { result } = renderSelection();
    act(() => result.current.selection.showPlace({ name: 'Ward 37', kind: 'ward', sites: [SITE_A] }));
    expect(result.current.selection.preview?.properties.site_id).toBe('site_a');
    act(() => result.current.selection.showPlace({ name: 'Jodhpur', kind: 'town', sites: [SITE_A, SITE_B] }));
    expect(result.current.selection.preview).toBeNull();
    expect(result.current.selection.camera?.points).toHaveLength(2);
  });
});
