import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { BBox } from '../src/domain/BBox';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import type { Language } from '../src/i18n/LanguagePreference';
import { DEFAULTS } from './config';
import { renderApp } from './helpers';
import { CENTRAL, desktopMedia, ELSEWHERE, inCity, JAIPUR_VIEW, OPENING, placesRig, WEST_A, WEST_B, type Rig } from './placesRig';

const seen = vi.hoisted(() => ({ last: null as SiteMapBindings | null }));

// A map stand-in that records what the page asks it to draw; the tests move it by calling onViewChange.
vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

const CHIP = 'Reports are in Jodhpur · View';
const JUMP = "See Jodhpur's reports";
const EMPTY_CARD = 'No sites on the map here right now';
const EMPTY_TOAST = 'No reports here yet.';
const CITY_SITES = [WEST_A, WEST_B, CENTRAL];

interface Opened {
  readonly rig?: Rig;
  readonly language?: Language;
  readonly route?: string;
}

async function open({ rig = placesRig(), language = 'en', route = '/' }: Opened = {}) {
  const user = userEvent.setup();
  await renderApp(<AppRoutes />, { services: rig.services, language, route });
  await waitFor(() => expect(seen.last).not.toBeNull());
  return { user, rig };
}

const moveTo = (bbox: BBox) => act(() => seen.last?.onViewChange({ bbox, byUser: true }));
const chip = () => screen.queryByRole('button', { name: CHIP });
const field = () => screen.getByRole('searchbox');

// The city's own sites are in, so a jump fits them, not just the city's bounds.
async function cityKnown(rig: Rig): Promise<void> {
  await waitFor(() => expect(rig.cityLoaded()).toBe(true));
  await act(async () => undefined);
}

beforeEach(() => {
  seen.last = null;
  window.sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('the map still opens on Jodhpur', () => {
  it('shows no chip there and never moves by itself, however far the map is taken', async () => {
    await open();
    moveTo(OPENING);
    await waitFor(() => expect(seen.last?.sites).toHaveLength(1));
    expect(chip()).not.toBeInTheDocument();
    moveTo(ELSEWHERE);
    expect(await screen.findByRole('button', { name: CHIP })).toBeInTheDocument();
    expect(seen.last?.camera).toBeNull();
  });

  it('says nothing over sites of another place, or on the city itself', async () => {
    await open();
    moveTo(JAIPUR_VIEW);
    await waitFor(() => expect(seen.last?.sites).toHaveLength(1));
    expect(chip()).not.toBeInTheDocument();
    // Inside the city the card has Zoom out for that, so it does not offer the jump.
    moveTo(OPENING);
    await waitFor(() => expect(seen.last?.sites[0]?.geometry.coordinates).toEqual(CENTRAL));
    expect(await screen.findByRole('region', { name: /on the map here/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: JUMP })).not.toBeInTheDocument();
  });
});

describe('the chip on a phone, away from the pilot city with no site in view', () => {
  it('recentres on the city\'s reports, then goes away', async () => {
    const { user, rig } = await open();
    moveTo(ELSEWHERE);
    const button = await screen.findByRole('button', { name: CHIP });
    await cityKnown(rig);
    await user.click(button);
    expect(seen.last?.camera?.points).toEqual(CITY_SITES);
    moveTo(OPENING);
    await waitFor(() => expect(chip()).not.toBeInTheDocument());
  });

  it('goes to the city at once, before its sites are known: the whole city is framed', async () => {
    const { user } = await open();
    moveTo(ELSEWHERE);
    await user.click(await screen.findByRole('button', { name: CHIP }));
    expect(inCity(seen.last?.camera?.points)).toBe(true);
  });

  it('stays beside the toast once the few-reports card is closed', async () => {
    const { user } = await open();
    moveTo(ELSEWHERE);
    await user.click(within(await screen.findByRole('region', { name: EMPTY_CARD })).getByRole('button', { name: 'Hide this tip' }));
    const toast = (await screen.findByText(EMPTY_TOAST)).closest('.map-status');
    expect(within(toast as HTMLElement).getByRole('button', { name: CHIP })).toBeInTheDocument();
  });
});

describe('the few-reports card away from the pilot city', () => {
  it('offers the same way back', async () => {
    const { user, rig } = await open();
    moveTo(ELSEWHERE);
    const card = await screen.findByRole('region', { name: EMPTY_CARD });
    await cityKnown(rig);
    await user.click(within(card).getByRole('button', { name: JUMP }));
    expect(seen.last?.camera?.points).toEqual(CITY_SITES);
  });

  it('reads in Hindi, like the chip', async () => {
    await open({ language: 'hi' });
    moveTo(ELSEWHERE);
    expect(await screen.findByRole('button', { name: 'रिपोर्टें जोधपुर में हैं · देखें' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'जोधपुर की रिपोर्टें देखें' })).toBeInTheDocument();
  });
});

describe('desktop, away from the pilot city with no site in view', () => {
  beforeEach(desktopMedia);

  it('floats the chip with the toast over the map, and it recentres on the city', async () => {
    const { user, rig } = await open();
    moveTo(ELSEWHERE);
    const toast = (await screen.findByText(EMPTY_TOAST)).closest('.map-status');
    await cityKnown(rig);
    await user.click(within(toast as HTMLElement).getByRole('button', { name: CHIP }));
    expect(seen.last?.camera?.points).toEqual(CITY_SITES);
  });

  it('offers the way back in the side panel\'s empty list', async () => {
    const { user, rig } = await open();
    moveTo(ELSEWHERE);
    const panel = (await screen.findByText('All clear here')).closest('section');
    await cityKnown(rig);
    await user.click(within(panel as HTMLElement).getByRole('button', { name: JUMP }));
    expect(seen.last?.camera?.points).toEqual(CITY_SITES);
  });
});

describe('search field over the map', () => {
  it('names the pilot city while the map is on it, from the first moment', async () => {
    await open();
    expect(field()).toHaveAttribute('placeholder', 'Search Jodhpur');
    moveTo(OPENING);
    expect(field()).toHaveAttribute('placeholder', 'Search Jodhpur');
    expect(field()).toHaveAccessibleName('Search Jodhpur: wards, seats and places');
  });

  it('says what it searches once the map is elsewhere, and names the city again on the way back', async () => {
    await open();
    moveTo(JAIPUR_VIEW);
    expect(field()).toHaveAttribute('placeholder', 'Search a seat or town');
    expect(field()).toHaveAccessibleName('Search wards, seats and places');
    moveTo(DEFAULTS.pilot.bounds);
    expect(field()).toHaveAttribute('placeholder', 'Search Jodhpur');
  });

  it('reads in Hindi both ways', async () => {
    await open({ language: 'hi' });
    expect(field()).toHaveAttribute('placeholder', 'जोधपुर में खोजें');
    moveTo(ELSEWHERE);
    expect(field()).toHaveAttribute('placeholder', 'सीट या शहर खोजें');
    expect(field()).toHaveAccessibleName('वार्ड, क्षेत्र और जगहें खोजें');
  });
});

describe('search field on other tabs', () => {
  it.each(['/areas', '/account'])('says what it searches on %s, where the map is not what the screen is about', async (route) => {
    desktopMedia();
    await open({ route });
    moveTo(OPENING);
    expect(field()).toHaveAttribute('placeholder', 'Search a seat or town');
    expect(field()).toHaveAccessibleName('Search wards, seats and places');
  });

  it('keeps the city on a sheet that belongs to the map', async () => {
    await open({ route: '/places' });
    moveTo(OPENING);
    expect(field()).toHaveAttribute('placeholder', 'Search Jodhpur');
  });
});
