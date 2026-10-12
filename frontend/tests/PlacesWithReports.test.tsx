import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { AreaKey } from '../src/domain/AreaKey';
import { DEFAULT_CITY } from '../src/domain/AreaListing';
import type { BBox } from '../src/domain/BBox';
import { PILOT_DISTRICT } from '../src/domain/PilotAreas';
import { ReportedPlaces, type ReportedPlace } from '../src/domain/ReportedPlaces';
import type { SiteFeature } from '../src/domain/Site';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import type { Language } from '../src/i18n/LanguagePreference';
import { DEFAULTS } from './config';
import { renderApp } from './helpers';
import { CENTRAL, CITY_VIEW, countRow, desktopMedia, ELSEWHERE, inCity, JAIPUR_SITE, JAIPUR_VIEW, placesRig, ROWS, RowsApi, SITES, WEST_A, WEST_B, type Rig } from './placesRig';

const seen = vi.hoisted(() => ({ last: null as SiteMapBindings | null }));

// A map stand-in that records what the page asks it to draw; the tests move it by calling onViewChange.
vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

const LIMITS = DEFAULTS.limits;
const TITLE = 'Places with reports';
const ALL = { districts: [...(ROWS['district/rajasthan-jaipur'] ?? []), ...(ROWS['district/rajasthan-jodhpur'] ?? [])], seats: ROWS['assembly/rajasthan-jodhpur'] ?? [] };
const names = (places: readonly ReportedPlace[]) => places.map((place) => `${place.area.kind} ${place.area.name} ${String(place.count)}`);

interface Shown {
  readonly rig?: Rig;
  readonly language?: Language;
  /** Sites the view must have loaded before the test goes on. */
  readonly sites?: number;
}

async function showMap(view: BBox, { rig = placesRig(), language = 'en', sites = 0 }: Shown = {}) {
  const user = userEvent.setup();
  await renderApp(<AppRoutes />, { services: rig.services, language });
  await waitFor(() => expect(seen.last).not.toBeNull());
  act(() => seen.last?.onViewChange({ bbox: view, byUser: true }));
  await waitFor(() => expect(seen.last?.sites).toHaveLength(sites));
  return user;
}

async function openPlaces(user: ReturnType<typeof userEvent.setup>, title = TITLE) {
  await user.click(screen.getByRole('button', { name: title }));
  return screen.findByRole('complementary', { name: title });
}

// Each row as [name, kind line, count]; the count is '' when the row shows none.
const rowsOf = (sheet: HTMLElement) =>
  within(within(sheet).getByRole('list')).getAllByRole('button').map((row) => [
    row.querySelector('strong')?.textContent,
    row.querySelector('.site-row__meta')?.textContent,
    row.querySelector('.place-row__count')?.textContent ?? '',
  ]);

const sheetGone = () => waitFor(() => expect(screen.queryByRole('complementary', { name: TITLE })).not.toBeInTheDocument());

beforeEach(() => {
  seen.last = null;
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ReportedPlaces, the list', () => {
  it('lists the pilot city, its seats that have sites and the other districts, most sites first', () => {
    expect(names(ReportedPlaces.of(ALL, PILOT_DISTRICT, LIMITS))).toEqual(['district Jodhpur 45', 'assembly Soorsagar 36', 'assembly Jodhpur 9', 'district Jaipur 1']);
  });

  it('counts the sites on the map: open and reopened, never cleared ones', () => {
    const row = countRow('district', 'rajasthan-jodhpur', 'Jodhpur', 4);
    expect(ReportedPlaces.count({ ...row, counts: { ...row.counts, sites: 9, reopened_sites: 2, cleaned_sites: 3 } })).toBe(6);
  });

  it('keeps to the configured number of seats and of rows', () => {
    expect(names(ReportedPlaces.of(ALL, PILOT_DISTRICT, { placesListed: 6, placeSeats: 1 }))).toEqual(['district Jodhpur 45', 'assembly Soorsagar 36', 'district Jaipur 1']);
    expect(names(ReportedPlaces.of(ALL, PILOT_DISTRICT, { placesListed: 2, placeSeats: 3 }))).toEqual(['district Jodhpur 45', 'assembly Soorsagar 36']);
  });

  it('always lists the pilot city: with no rows it has no count, and a district row still at zero takes its seats\' sum', () => {
    expect(names(ReportedPlaces.of({ districts: [], seats: [] }, PILOT_DISTRICT, LIMITS))).toEqual(['district Jodhpur null']);
    const seeded = { districts: [countRow('district', 'rajasthan-jodhpur', 'Jodhpur', 0)], seats: ALL.seats };
    expect(names(ReportedPlaces.of(seeded, PILOT_DISTRICT, LIMITS))[0]).toBe('district Jodhpur 45');
  });

  it('names the pilot district the ranking and the map fill already ask for', () => {
    expect(PILOT_DISTRICT.id).toBe(DEFAULT_CITY.id);
  });
});

describe('ReportedPlaces, a short list', () => {
  const busier = { districts: [countRow('district', 'rajasthan-jaipur', 'Jaipur', 60), ...(ROWS['district/rajasthan-jodhpur'] ?? [])], seats: ALL.seats };

  it('never drops the pilot city, however many sites another district has', () => {
    expect(names(ReportedPlaces.of(busier, PILOT_DISTRICT, { placesListed: 1, placeSeats: 3 }))).toEqual(['district Jodhpur 45']);
    expect(names(ReportedPlaces.of(busier, PILOT_DISTRICT, { placesListed: 2, placeSeats: 3 }))).toEqual(['district Jaipur 60', 'district Jodhpur 45']);
    const uncounted = { districts: busier.districts.slice(0, 1), seats: [] };
    expect(names(ReportedPlaces.of(uncounted, PILOT_DISTRICT, { placesListed: 1, placeSeats: 3 }))).toEqual(['district Jodhpur null']);
  });
});

describe('ReportedPlaces, where the map goes', () => {
  it('frames a place on its own sites, each once, and the pilot city on its bounds while none is known', () => {
    const [city, soorsagar] = ReportedPlaces.of(ALL, PILOT_DISTRICT, LIMITS);
    if (!city || !soorsagar) throw new Error('two places expected');
    expect(ReportedPlaces.frame(soorsagar, [...SITES, ...SITES], DEFAULTS.pilot)).toEqual([WEST_A, WEST_B]);
    expect(ReportedPlaces.frame(city, SITES, DEFAULTS.pilot)).toEqual([WEST_A, WEST_B, CENTRAL]);
    expect(ReportedPlaces.frame(city, [], DEFAULTS.pilot)).toEqual(DEFAULTS.pilot.frame());
  });

  it('takes the map nowhere for a seat or another district none of whose sites the app holds', () => {
    const [, soorsagar] = ReportedPlaces.of(ALL, PILOT_DISTRICT, LIMITS);
    if (!soorsagar) throw new Error('a seat expected');
    // A rural seat of the district has its sites outside the city: the city's bounds would not show them.
    expect(ReportedPlaces.frame(soorsagar, [SITES[2] as SiteFeature], DEFAULTS.pilot)).toEqual([]);
    const jaipur = { area: new AreaKey('district', 'rajasthan-jaipur', 'Jaipur'), count: 1, pilot: false };
    expect(ReportedPlaces.frame(jaipur, [], DEFAULTS.pilot)).toEqual([]);
  });
});

describe('Places with reports on a phone', () => {
  it('lists the places with their counts, most sites first', async () => {
    const sheet = await openPlaces(await showMap(CITY_VIEW, { sites: 3 }));
    await waitFor(() => expect(rowsOf(sheet)).toHaveLength(3));
    expect(rowsOf(sheet)).toEqual([
      ['Jodhpur', 'District · Pilot city', '45 sites'],
      ['Soorsagar', 'Assembly seat', '36 sites'],
      ['Jodhpur', 'Assembly seat', '9 sites'],
    ]);
    expect(within(sheet).getByRole('list', { name: 'Places and their site counts' })).toBeInTheDocument();
  });

  it('fits the map to the place picked and closes the list', async () => {
    const user = await showMap(CITY_VIEW, { sites: 3 });
    const sheet = await openPlaces(user);
    await user.click(await within(sheet).findByRole('button', { name: /Soorsagar/ }));
    expect(seen.last?.camera?.points).toEqual([WEST_A, WEST_B]);
    await sheetGone();
  });

  it('lists a district beside the pilot when the map is on its sites, and goes there', async () => {
    const user = await showMap(JAIPUR_VIEW, { sites: 1 });
    const sheet = await openPlaces(user);
    await waitFor(() => expect(rowsOf(sheet).at(-1)).toEqual(['Jaipur', 'District', '1 site']));
    await user.click(within(sheet).getByRole('button', { name: /Jaipur/ }));
    expect(seen.last?.camera?.points).toEqual([JAIPUR_SITE]);
  });
});

describe('Places with reports by keyboard', () => {
  it('opens from a real button with a name, and a row takes Enter', async () => {
    const user = await showMap(CITY_VIEW, { sites: 3 });
    const button = screen.getByRole('button', { name: TITLE });
    expect(button).toHaveTextContent('Places');
    button.focus();
    await user.keyboard('{Enter}');
    const sheet = await screen.findByRole('complementary', { name: TITLE });
    (await within(sheet).findByRole('button', { name: /Soorsagar/ })).focus();
    await user.keyboard('{Enter}');
    expect(seen.last?.camera?.points).toEqual([WEST_A, WEST_B]);
    await sheetGone();
  });
});

describe('Places with reports from another city', () => {
  // Over Jaipur's site the map asks nothing about the pilot city, so the one GET /sites over it is the list's own.
  it('takes the map to the pilot city\'s own sites, with no location and signed out', async () => {
    const rig = placesRig();
    const user = await showMap(JAIPUR_VIEW, { rig, sites: 1 });
    const sheet = await openPlaces(user);
    await waitFor(() => expect(rig.cityLoaded()).toBe(true));
    await act(async () => undefined);
    await user.click(within(sheet).getByRole('button', { name: /District · Pilot city/ }));
    expect(seen.last?.camera?.points).toEqual([WEST_A, WEST_B, CENTRAL]);
    expect(seen.last?.userLocation).toBeNull();
  });

  it('opens on its own address too', async () => {
    await renderApp(<AppRoutes />, { services: placesRig().services, route: '/places' });
    const sheet = await screen.findByRole('complementary', { name: TITLE });
    expect(await within(sheet).findByText('45 sites')).toBeInTheDocument();
  });
});

describe('Places with reports when the area list fails', () => {
  it('still lists the pilot city, with no count and a line that says so, and goes to it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = await showMap(ELSEWHERE, { rig: placesRig(new RowsApi(ROWS, true)) });
    const sheet = await openPlaces(user);
    expect(await within(sheet).findByText('Some counts could not be loaded.')).toBeInTheDocument();
    expect(rowsOf(sheet)).toEqual([['Jodhpur', 'District · Pilot city', '']]);
    await user.click(within(sheet).getByRole('button', { name: /Jodhpur/ }));
    expect(inCity(seen.last?.camera?.points)).toBe(true);
  });

  it('lists the pilot city before any count has arrived', async () => {
    const never = new RowsApi();
    vi.spyOn(never, 'list').mockReturnValue(new Promise<never>(() => undefined));
    const sheet = await openPlaces(await showMap(ELSEWHERE, { rig: placesRig(never) }));
    expect(rowsOf(sheet)).toEqual([['Jodhpur', 'District · Pilot city', '']]);
    expect(within(sheet).getByRole('status')).toHaveTextContent('Loading counts');
  });
});

describe('Places with reports in Hindi', () => {
  it('names the button, the list and its counts in Hindi; area names stay as the data has them', async () => {
    const user = await showMap(CITY_VIEW, { language: 'hi', sites: 3 });
    expect(screen.getByRole('button', { name: 'रिपोर्ट वाली जगहें' })).toHaveTextContent('जगहें');
    const sheet = await openPlaces(user, 'रिपोर्ट वाली जगहें');
    await waitFor(() => expect(rowsOf(sheet)).toHaveLength(3));
    expect(rowsOf(sheet).slice(0, 2)).toEqual([
      ['Jodhpur', 'ज़िला · पायलट शहर', '45 स्थल'],
      ['Soorsagar', 'विधानसभा क्षेत्र', '36 स्थल'],
    ]);
    expect(within(sheet).getByRole('list', { name: 'जगहें और उनके स्थलों की गिनती' })).toBeInTheDocument();
  });
});

describe('Places with reports on desktop', () => {
  beforeEach(desktopMedia);

  it('sits beside Filters in the side panel, lists the places, and a pick moves the map and closes it', async () => {
    const user = await showMap(CITY_VIEW, { sites: 3 });
    const button = screen.getByRole('button', { name: TITLE });
    expect(button.parentElement).toBe(screen.getByRole('button', { name: /Filters/ }).parentElement);
    const sheet = await openPlaces(user);
    await waitFor(() => expect(rowsOf(sheet).map(([name, , count]) => `${String(name)} ${String(count)}`)).toEqual(['Jodhpur 45 sites', 'Soorsagar 36 sites', 'Jodhpur 9 sites']));
    await user.click(within(sheet).getByRole('button', { name: /Soorsagar/ }));
    expect(seen.last?.camera?.points).toEqual([WEST_A, WEST_B]);
    await sheetGone();
  });

  it('a second press with the list open opens no second copy', async () => {
    const user = await showMap(CITY_VIEW, { sites: 3 });
    await openPlaces(user);
    await user.click(screen.getByRole('button', { name: TITLE }));
    expect(screen.getAllByRole('complementary', { name: TITLE })).toHaveLength(1);
    await user.keyboard('{Escape}');
    await sheetGone();
    expect(await screen.findByRole('heading', { level: 2, name: /In view/ })).toBeInTheDocument();
  });
});
