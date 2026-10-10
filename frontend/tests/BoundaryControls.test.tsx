import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { ServiceContainer } from '../src/app/ServiceContainer';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import type { AreaApi } from '../src/services/AreaApi';
import { renderApp, testServices } from './helpers';

const seen: { last: SiteMapBindings | null } = { last: null };

// A map stand-in that records what the page asks it to draw.
vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

describe('Map areas', () => {
  it('draws one areas layer filled from the area lists, with a one-line legend and the marker key', async () => {
    await renderApp(<AppRoutes />);
    // The honesty pill stays visible beside the Legend chip; the legend opens from the chip.
    expect(await screen.findByText('Scores show after 10 verified reports')).toBeInTheDocument();
    await waitFor(() => expect(seen.last?.areaMarkers.size).toBeGreaterThan(0));
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Legend' }));
    const legend = await screen.findByRole('region', { name: 'Map legend' });
    expect(within(legend).getByText(/Seats coloured by score/)).toBeInTheDocument();
    expect(within(legend).getByText('Marker: score out of 100, then its verified reports')).toBeInTheDocument();
    expect(within(legend).getByText('Marker: number of verified reports')).toBeInTheDocument();
    expect(within(legend).getByText('Flag: pilot city data')).toBeInTheDocument();
    expect(within(legend).queryByText(/ward/i)).not.toBeInTheDocument();
    expect(within(legend).getByText('Dashed outline: seat boundary out of date')).toBeInTheDocument();
    await waitFor(() => expect(seen.last?.areaColors.get('s20-ac-128')).toBe('#e2786a'));
    expect(seen.last?.areas).toEqual({ fine: true });
    // Sardarpura has 4 verified reports and every score withheld: a grey count fill, never a score colour.
    expect(seen.last?.areaColors.get('s20-ac-127')).toBe('#c4c7c5');
    // Markers follow the same rule: the shown score, else the report count.
    expect(seen.last?.areaMarkers.get('s20-ac-128')?.value).toBe('44');
    expect(seen.last?.areaMarkers.get('s20-ac-127')?.value).toBe('4');
  });

});

describe('Map areas controls', () => {
  it('has no layer switcher; the ranking is one tap away', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    expect(screen.queryByRole('button', { name: 'Map areas' })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'City ranking' }));
    expect(await screen.findByRole('heading', { name: 'Jodhpur ranking' })).toBeInTheDocument();
  });
});

describe('Map fill when a list fails to load', () => {
  it('keeps the other lists filled', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const base = testServices();
    const areas: AreaApi = {
      scores: (kind, id) => base.areas.scores(kind, id),
      list: (kind, within, limit) =>
        within === 'rajasthan-jaipur' ? Promise.reject(new Error('offline')) : base.areas.list(kind, within, limit),
      crawl: (districtId) => base.areas.crawl(districtId),
    };
    await renderApp(<AppRoutes />, { services: new ServiceContainer({ ...base, areas }) });
    await waitFor(() => expect(seen.last?.areaColors.get('s20-ac-128')).toBe('#e2786a'));
  });
});

describe('Map legend before any score', () => {
  it('explains the pins and the n/10 sticker, and leaves out score entries no seat shows', async () => {
    const base = testServices();
    const areas: AreaApi = {
      scores: (kind, id) => base.areas.scores(kind, id),
      list: async (kind, within, limit) => ({ kind, within, total: 0, limit, areas: [] }),
      crawl: (districtId) => base.areas.crawl(districtId),
    };
    await renderApp(<AppRoutes />, { services: new ServiceContainer({ ...base, areas }) });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Legend' }));
    const legend = await screen.findByRole('region', { name: 'Map legend' });
    expect(within(legend).getByText(/^Pin: one reported site/)).toBeInTheDocument();
    expect(within(legend).getByText(/^Dashed pin: not verified yet; 1\/10/)).toBeInTheDocument();
    expect(within(legend).getByText('Stacked pin: several sites at one spot')).toBeInTheDocument();
    expect(within(legend).queryByText(/^Marker:/)).not.toBeInTheDocument();
    expect(within(legend).queryByText(/Seats coloured by score/)).not.toBeInTheDocument();
    expect(within(legend).queryByText('Flag: pilot city data')).not.toBeInTheDocument();
  });
});
