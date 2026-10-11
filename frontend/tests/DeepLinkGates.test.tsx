import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { renderApp } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

describe('a letter link for a site', () => {
  it('offers the draft on an unverified site, with a note that it is not verified yet (decision 20261011-1750)', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1/letter' });
    expect(await screen.findByRole('button', { name: 'Draft letter' })).toBeInTheDocument();
    expect(await screen.findByText('This spot is not verified yet. The letter says how many residents have reported it.')).toBeInTheDocument();
  });

  it('notes it in Hindi too', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_jpr_1/letter', language: 'hi' });
    expect(await screen.findByText('यह जगह अभी सत्यापित नहीं है। पत्र में लिखा है कि कितने निवासियों ने इसकी सूचना दी है।')).toBeInTheDocument();
  });

  it('offers the draft on a verified site, with no note', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1/letter' });
    expect(await screen.findByRole('button', { name: 'Draft letter' })).toBeInTheDocument();
    expect(screen.queryByText(/not verified yet/)).not.toBeInTheDocument();
  });

  it('says so for a site that does not exist, in Hindi', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_missing/letter', language: 'hi' });
    expect(await screen.findByText('यह स्थल अब नक्शे पर नहीं है, या लिंक गलत है।')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'वापस' })).toBeInTheDocument();
  });
});

describe('a cleanup link for a site', () => {
  it('says a cleanup photo is already being checked, instead of opening the camera', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_1/cleanup' });
    expect(await screen.findByText('A cleanup photo for this site is already being checked.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take photo' })).not.toBeInTheDocument();
  });

  it('says a site that left the map takes no more photos', async () => {
    await renderApp(<AppRoutes />, { route: '/sites/site_jdh_5/cleanup' });
    expect(await screen.findByText('This site is off the map, so it takes no more letters or cleanup photos.')).toBeInTheDocument();
  });
});

describe('a letter link for an area', () => {
  it('says letters open at 10 verified reports for an area below that', async () => {
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-54/letter' });
    expect(await screen.findByText('Letters open once this area has 10 verified reports.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Draft letter' })).not.toBeInTheDocument();
  });

  it('offers the draft for an area with 10 verified reports', async () => {
    await renderApp(<AppRoutes />, { route: '/areas/assembly/s20-ac-128/letter' });
    expect(await screen.findByRole('button', { name: 'Draft letter' })).toBeInTheDocument();
  });
});
