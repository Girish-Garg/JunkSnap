import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { renderApp } from './helpers';

const COLLECTING = /We're collecting official ward data for this area/;

// A map stand-in that reports the opening Jodhpur view, so the map loads its sites.
vi.mock('../src/features/map/components/SiteMapView', async () => {
  const { useEffect } = await import('react');
  const { BBox } = await import('../src/domain/BBox');
  const view = { bbox: BBox.around([73.02, 26.27], 0.99), clamped: false };
  return {
    SiteMapView: ({ onViewChange }: { onViewChange: (next: typeof view) => void }) => {
      useEffect(() => onViewChange(view), [onViewChange]);
      return null;
    },
  };
});

describe('Areas list', () => {
  it('lists the areas of the sites on the map by kind and filters them by name', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/areas' });
    expect(await screen.findByRole('link', { name: /Sardarpura/ })).toHaveAttribute('href', '/areas/assembly/s20-ac-127');
    expect(screen.getByRole('heading', { name: 'Lok Sabha seats' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Districts' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Find an area'), 'sard');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('sends an unknown area kind back to the list', async () => {
    await renderApp(<AppRoutes />, { route: '/areas/state/rajasthan' });
    expect(await screen.findByRole('heading', { name: 'Areas' })).toBeInTheDocument();
  });
});

describe('Area page', () => {
  it('shows scores with counts, the pilot flag, diagnosis, insights and the area sites', async () => {
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-128' });
    const scores = await screen.findByRole('region', { name: 'Scores' });
    expect(within(scores).getByText('41')).toBeInTheDocument();
    expect(within(scores).getAllByText('From 14 verified reports')).toHaveLength(3);
    expect(screen.getByText('Pilot city')).toBeInTheDocument();
    expect(screen.getByText('Too few bins')).toBeInTheDocument();
    expect(screen.getByText('48.2%')).toBeInTheDocument();
    expect(screen.getByText('16.7% · 1 of 6 sites')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Waste dump/ })).toHaveAttribute('href', '/sites/site_jdh_1');
  });

  it('withholds every score below 10 verified reports and still shows the counts', async () => {
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-54' });
    expect(await screen.findAllByText('Not enough reports yet (0 of 10 verified)')).toHaveLength(5);
    expect(screen.getAllByText('No score yet')).toHaveLength(3);
    expect(screen.queryByText('What the reports show')).not.toBeInTheDocument();
    expect(screen.queryByText('Pilot city')).not.toBeInTheDocument();
  });

  it('says so when an area has no reports', async () => {
    await renderApp(<AppRoutes />, { route: '/areas/ward/jodhpur-mc-w99' });
    expect(await screen.findByText('No reports in this area yet.')).toBeInTheDocument();
  });
});

describe('Crawl banner on area pages and the list', () => {
  it('shows on a district page while its ward crawl is queued', async () => {
    await renderApp(<AppRoutes />, { route: '/areas/district/rajasthan-jodhpur' });
    expect(await screen.findByText(COLLECTING)).toBeInTheDocument();
    expect(screen.getByText(/^Expected by /)).toBeInTheDocument();
  });

  it('shows on a seat page whose sites on the map share one district', async () => {
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-128' });
    expect(await screen.findByText(COLLECTING)).toBeInTheDocument();
  });

  it('shows under each district in the Areas list', async () => {
    await renderApp(<AppRoutes />, { route: '/areas' });
    const districts = (await screen.findByRole('heading', { name: 'Districts' })).closest('section');
    if (!districts) throw new Error('No district group');
    expect(await within(districts).findByText(COLLECTING)).toBeInTheDocument();
  });
});

describe('Area page language and links', () => {
  it('reads in Hindi', async () => {
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-54', language: 'hi' });
    expect(await screen.findAllByText('अभी पर्याप्त रिपोर्ट नहीं (10 में से 0 सत्यापित)')).toHaveLength(5);
  });

  it('opens an area page from the site sheet location', async () => {
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_2' });
    await user.click(await screen.findByRole('link', { name: 'Sardarpura' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Sardarpura' })).toBeInTheDocument();
    expect(screen.getByText('Assembly seat (MLA)')).toBeInTheDocument();
  });
});
