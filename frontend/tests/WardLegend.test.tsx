import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { ServiceContainer } from '../src/app/ServiceContainer';
import { WardCoverageText } from '../src/features/map/WardCoverageText';
import { BoundaryCatalog } from '../src/services/BoundaryCatalog';
import { renderApp, testServices } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

const t = (key: string, params: Readonly<Record<string, string>> = {}) => `${key}${JSON.stringify(params)}`;
const n = (value: number) => String(value);

describe('WardCoverageText', () => {
  it('gives mapped of total wards for one city', () => {
    const text = WardCoverageText.of([{ town: 'Jodhpur', mapped: 34, wards: 100 }], t, n);
    expect(text).toBe('boundaries.wardsApproxCounted{"counts":"boundaries.wardsOf{\\"mapped\\":\\"34\\",\\"wards\\":\\"100\\"}"}');
  });

  it('names each city when several are mapped, and copes with an unknown total', () => {
    const text = WardCoverageText.of([{ town: 'Jodhpur', mapped: 34, wards: 100 }, { town: 'Jaipur', mapped: 5, wards: null }], t, n);
    expect(text).toContain('Jodhpur: boundaries.wardsOf');
    expect(text).toContain('Jaipur: boundaries.wardsMapped');
  });

  it('still says approximate and unreviewed without counts', () => {
    expect(WardCoverageText.of([], t, n)).toBe('boundaries.wardsApprox{}');
  });
});

describe('Ward legend on the map', () => {
  it('says the ward areas are approximate and unreviewed, with counts from the boundary index', async () => {
    const index = { layers: { wards: { coverage: [{ body: 'jodhpur-mc', town: 'Jodhpur', mapped: 34, wards: 100 }] } } };
    const boundaries = new BoundaryCatalog('/boundaries/', async () => Response.json(index));
    const services = new ServiceContainer({ ...testServices(), boundaries });
    await renderApp(<AppRoutes />, { services });
    const button = await screen.findByRole('button', { name: 'Map areas' });
    button.click();
    (await screen.findByRole('button', { name: 'Wards' })).click();
    const legend = await screen.findByRole('region', { name: 'Map colours' });
    expect(
      within(legend).getByText('Approximate ward areas from official ward lists, unreviewed (34 of 100 wards)'),
    ).toBeInTheDocument();
  });
});
