import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import { ServiceContainer } from '../src/app/ServiceContainer';
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

describe('Map boundary controls', () => {
  it('opens on assembly seats filled from the area list, with a legend saying what the fill means', async () => {
    await renderApp(<AppRoutes />);
    const legend = await screen.findByRole('region', { name: 'Map colours' });
    expect(within(legend).getByText('Assembly seats')).toBeInTheDocument();
    expect(within(legend).getByText('Score, darker is worse')).toBeInTheDocument();
    expect(within(legend).getByText('Verified reports, no score yet')).toBeInTheDocument();
    expect(within(legend).getByText('A score shows after 10 verified reports.')).toBeInTheDocument();
    await waitFor(() => expect(seen.last?.areaColors.get('s20-ac-128')).toBe('#e2786a'));
    expect(seen.last?.boundary).toBe('assembly');
    // Sardarpura has 4 verified reports and every score withheld: a grey count fill, never a score colour.
    expect(seen.last?.areaColors.get('s20-ac-127')).toBe('#c4c7c5');
  });

});

describe('Map fill when a city fails to load', () => {
  it('keeps one city filled when the other city fails to load', async () => {
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

describe('Map layer switcher', () => {
  it('switches layers, marks outdated seats in the legend and turns boundaries off', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />);
    await user.click(await screen.findByRole('button', { name: 'Map areas' }));
    const panel = screen.getByRole('group', { name: 'Areas on the map' });
    expect(within(panel).queryByRole('button', { name: 'Wards' })).not.toBeInTheDocument();
    expect(within(panel).getByText('Ward map not available yet.')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Lok Sabha' }));
    expect(await screen.findByText('Outdated seat boundary')).toBeInTheDocument();
    expect(seen.last?.boundary).toBe('loksabha');
    await user.click(within(panel).getByRole('button', { name: 'Off' }));
    expect(screen.queryByRole('region', { name: 'Map colours' })).not.toBeInTheDocument();
    expect(seen.last?.boundary).toBeNull();
    expect(within(panel).getByRole('link', { name: 'City ranking' })).toHaveAttribute('href', '/ranking');
  });
});
