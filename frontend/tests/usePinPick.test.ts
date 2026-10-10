import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SiteFeature } from '../src/domain/Site';
import { usePinPick } from '../src/features/map/hooks/usePinPick';
import { testSite } from './siteBuilder';

const SITE_A = testSite({ site_id: 'site_a' });
const SITE_B = testSite({ site_id: 'site_b', report_type: 'contaminated_water' });
const SITE_C = testSite({ site_id: 'site_c', report_type: 'open_construction' });

const render = (loaded: readonly SiteFeature[]) =>
  renderHook(({ sites }) => usePinPick(sites), { initialProps: { sites: loaded } });

describe('usePinPick stacks', () => {
  it('drops a site from an open list once it is withdrawn or cleared, and closes the list once it is empty', () => {
    const { result, rerender } = render([SITE_A, SITE_B, SITE_C]);
    act(() => result.current.pickStack(['site_a', 'site_b', 'site_c']));
    expect(result.current.stack).toHaveLength(3);
    // site_a was withdrawn (gone from GET /sites); site_b is still in the list but cleared.
    const cleared = testSite({ site_id: 'site_b', report_type: 'contaminated_water', status: 'cleaned' });
    rerender({ sites: [cleared, SITE_C] });
    expect(result.current.stack?.map((site) => site.properties.site_id)).toEqual(['site_c']);
    rerender({ sites: [] });
    expect(result.current.stack).toBeNull();
  });

  it('never lists a removed site', () => {
    const removed = testSite({ site_id: 'site_r', status: 'removed', verification: 'unverified' });
    const { result } = render([SITE_A, removed]);
    act(() => result.current.pickStack(['site_a', 'site_r']));
    expect(result.current.stack?.map((site) => site.properties.site_id)).toEqual(['site_a']);
  });
});
