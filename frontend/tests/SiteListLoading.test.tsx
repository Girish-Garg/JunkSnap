import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { BBox } from '../src/domain/BBox';
import type { SiteFeature } from '../src/domain/Site';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import type { MapView } from '../src/features/map/SiteMap';
import { DEFAULTS } from './config';
import { renderApp, testServices } from './helpers';
import { ListApi } from './listApi';
import { testSite } from './siteBuilder';

const seen = vi.hoisted(() => ({ last: null as SiteMapBindings | null }));

vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

// Records every GET /sites box, and can fail the pilot city's own request a number of times.
class CountingApi extends ListApi {
  readonly boxes: BBox[] = [];
  #failures: number;

  constructor(sites: readonly SiteFeature[], pilotFailures = 0) {
    super(sites);
    this.#failures = pilotFailures;
  }

  override async listSites(bbox: BBox): Promise<readonly SiteFeature[]> {
    this.boxes.push(bbox);
    const pilot = bbox.toQuery() === DEFAULTS.pilot.bounds.toQuery();
    if (pilot && this.#failures > 0) {
      this.#failures -= 1;
      throw new Error('network down');
    }
    return super.listSites(bbox);
  }

  pilotRequests(): number {
    return this.boxes.filter((box) => box.toQuery() === DEFAULTS.pilot.bounds.toQuery()).length;
  }
}

// 35 sites across the middle of Jodhpur, one minute apart, so "newest" puts site_00 first.
const MANY = Array.from({ length: 35 }, (_, n) =>
  testSite({
    site_id: `site_${String(n).padStart(2, '0')}`,
    coordinates: [73.0 + n * 0.001, 26.27],
    last_reported_at: `2026-10-10T10:${String(59 - n).padStart(2, '0')}:00Z`,
  }),
);
const JODHPUR_VIEW = new BBox(72.95, 26.2, 73.1, 26.4);
const ELSEWHERE = new BBox(80, 20, 80.05, 20.05);
const NEAR_JODHPUR_EMPTY = new BBox(73.3, 26.5, 73.35, 26.55);

async function render(api: CountingApi, view: MapView) {
  await renderApp(<AppRoutes />, { services: new ServiceContainer({ ...testServices(), api }) });
  await waitFor(() => expect(seen.last).not.toBeNull());
  act(() => seen.last?.onViewChange(view));
}

async function openList(api: CountingApi, view: MapView) {
  const user = userEvent.setup();
  await render(api, view);
  await user.click(screen.getByRole('button', { name: 'List view' }));
  return user;
}

const rows = () => within(screen.getByRole('list', { name: 'Sites, in the order you chose' })).getAllByRole('button');

describe('site list paging', () => {
  it('shows 30 rows, then the rest on "Show 5 more"', async () => {
    const user = await openList(new CountingApi(MANY), { bbox: JODHPUR_VIEW, byUser: true });
    expect(await screen.findByRole('heading', { level: 2, name: '35 sites in view' })).toBeInTheDocument();
    expect(rows()).toHaveLength(30);
    await user.click(screen.getByRole('button', { name: 'Show 5 more' }));
    expect(rows()).toHaveLength(35);
    expect(screen.queryByRole('button', { name: /Show \d+ more/ })).not.toBeInTheDocument();
  });
});

describe('requests for the pilot city', () => {
  it('reuses the search around an empty opening view: no second request', async () => {
    const api = new CountingApi(MANY);
    await render(api, { bbox: NEAR_JODHPUR_EMPTY });
    await waitFor(() => expect(seen.last?.camera?.points).toHaveLength(36));
    expect(api.pilotRequests()).toBe(0);
    // One query for the view and one around it, nothing more.
    expect(api.boxes).toHaveLength(2);
  });

  it('asks nothing for a list that has rows of its own', async () => {
    const api = new CountingApi(MANY);
    await openList(api, { bbox: JODHPUR_VIEW, byUser: true });
    await screen.findByRole('heading', { level: 2, name: '35 sites in view' });
    expect(api.pilotRequests()).toBe(0);
  });

  it('asks once for a list over an empty view far away, however often it renders', async () => {
    const api = new CountingApi(MANY);
    const user = await openList(api, { bbox: ELSEWHERE, byUser: true });
    expect(await screen.findByRole('heading', { level: 2, name: /Sites in Jodhpur/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Most backed' }));
    await user.click(screen.getByRole('button', { name: 'Newest' }));
    expect(api.pilotRequests()).toBe(1);
  });
});

describe('when the pilot city cannot load', () => {
  it('shows the could-not-load picture with a retry, which loads the sites', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const api = new CountingApi(MANY, 1);
    const user = await openList(api, { bbox: ELSEWHERE, byUser: true });
    expect(await screen.findByText("Could not load Jodhpur's sites.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 2, name: /Sites in Jodhpur/ })).toHaveTextContent('35');
    expect(api.pilotRequests()).toBe(2);
    expect(logged).toHaveBeenCalledWith('Could not load the pilot city sites', expect.any(Error));
    logged.mockRestore();
  });
});
