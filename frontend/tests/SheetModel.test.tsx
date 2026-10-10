import { act, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { BBox } from '../src/domain/BBox';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import { HistoryLayers } from '../src/ui/HistoryLayers';
import { TopLayer } from '../src/ui/TopLayer';
import { useExitAnimation } from '../src/ui/useExitAnimation';
import { useHistoryLayer } from '../src/ui/useHistoryLayer';
import { MemoryStore, renderApp, testServices } from './helpers';

const seen: { last: SiteMapBindings | null } = { last: null };

// A map stand-in: the test plays the map's part (loading a view, tapping pins and the empty map).
vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

const heading = (name: string) => screen.queryByRole('heading', { level: 2, name });
const layers = () => HistoryLayers.open().length;

// A resident whose mock session survived a reload, so letters open without the sign-in sheet.
function signedIn() {
  const store = new MemoryStore();
  store.setItem('junksnap.session', 'resident@example.com');
  return testServices(store);
}

async function loadMap(route = '/', services = testServices()): Promise<void> {
  await renderApp(<AppRoutes />, { route, services });
  await waitFor(() => expect(seen.last).not.toBeNull());
  act(() => seen.last?.onViewChange({ bbox: new BBox(72.5, 26, 76, 27.2) }));
  await waitFor(() => expect(seen.last?.sites.length).toBeGreaterThan(2));
}

// The reported bug: a sheet that is not a route stayed open under the next sheet and came back on close.
describe('opening a sheet replaces the map-level sheets under it', () => {
  it('closes Filters when a tab opens, so closing the tab shows the bare map', async () => {
    const user = userEvent.setup();
    await loadMap();
    await user.click(screen.getByRole('button', { name: /Filters/ }));
    expect(heading('Filters')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Areas' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Areas' })).toBeInTheDocument();
    expect(heading('Filters')).not.toBeInTheDocument();
    expect(layers()).toBe(0);
    await user.click(screen.getByRole('button', { name: 'Close areas' }));
    await waitFor(() => expect(heading('Areas')).not.toBeInTheDocument());
    expect(heading('Filters')).not.toBeInTheDocument();
  });

  it('closes the stack list when a tab opens', async () => {
    const user = userEvent.setup();
    await loadMap();
    act(() => seen.last?.onPickStack(['site_jdh_1', 'site_jpr_1']));
    expect(await screen.findByRole('heading', { level: 2, name: '2 sites at this spot' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Areas' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Areas' })).toBeInTheDocument();
    expect(heading('2 sites at this spot')).not.toBeInTheDocument();
    expect(layers()).toBe(0);
  });

});

describe('the preview card', () => {
  it('has a history entry, so back closes it, and Details leaves none behind', async () => {
    const user = userEvent.setup();
    await loadMap();
    act(() => seen.last?.onPick('site_jdh_1'));
    expect(await screen.findByRole('button', { name: 'Details' })).toBeInTheDocument();
    await waitFor(() => expect(layers()).toBe(1));
    act(() => window.history.back());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Details' })).not.toBeInTheDocument());
    act(() => seen.last?.onPick('site_jdh_1'));
    await user.click(await screen.findByRole('button', { name: 'Details' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Waste dump' })).toBeInTheDocument();
    expect(layers()).toBe(0);
  });
});

describe('close and back pop exactly one level', () => {
  it('returns from an area letter to its area, then to the list, never pushing a sheet again', async () => {
    const user = userEvent.setup();
    await loadMap('/areas', signedIn());
    // The Jodhpur assembly seat has the 10 verified reports a letter needs (#120); its row comes first.
    const [jodhpur] = await screen.findAllByRole('link', { name: /^Jodhpur/ });
    await user.click(jodhpur as HTMLElement);
    expect(await screen.findByRole('heading', { level: 2, name: 'Jodhpur' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Draft a letter about this area' }));
    expect(await screen.findByRole('heading', { level: 2, name: /Letter about/ })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Close letter' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Jodhpur' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close area' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Areas' })).toBeInTheDocument();
  });

  it('a double tap on close goes back once', async () => {
    const user = userEvent.setup();
    await loadMap('/areas');
    await user.click(await screen.findByRole('link', { name: /Sardarpura/ }));
    const close = await screen.findByRole('button', { name: 'Close area' });
    await user.dblClick(close);
    expect(await screen.findByRole('heading', { level: 2, name: 'Areas' })).toBeInTheDocument();
  });
});

describe('a map tap with a sheet open (phones)', () => {
  it('closes only the topmost sheet, like Escape', async () => {
    const user = userEvent.setup();
    await loadMap('/sites/site_jdh_1');
    expect(await screen.findByRole('heading', { level: 2, name: 'Waste dump' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Letter' }));
    expect(heading('Sign in')).toBeInTheDocument();
    act(() => seen.last?.onPick(null));
    await waitFor(() => expect(heading('Sign in')).not.toBeInTheDocument());
    expect(heading('Waste dump')).toBeInTheDocument();
    act(() => seen.last?.onPickArea({ kind: 'assembly', id: 's20-ac-128' }));
    await waitFor(() => expect(heading('Waste dump')).not.toBeInTheDocument());
    expect(TopLayer.covering()).toBe(0);
  });

  it('opens another pin in place of the open site sheet', async () => {
    await loadMap('/sites/site_jdh_1');
    expect(await screen.findByRole('heading', { level: 2, name: 'Waste dump' })).toBeInTheDocument();
    act(() => seen.last?.onPick('site_jpr_1'));
    expect(await screen.findByRole('heading', { level: 2, name: 'Open construction' })).toBeInTheDocument();
  });
});

describe('history layers', () => {
  it('a layer closed without history (a cleared preview) takes its entry with it', async () => {
    const onClose = vi.fn();
    const { rerender } = renderHook(({ open }) => useHistoryLayer('test', open, onClose), { initialProps: { open: true } });
    expect(layers()).toBe(1);
    rerender({ open: false });
    await waitFor(() => expect(layers()).toBe(0));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('unwind closes every open layer, then runs the next step once', async () => {
    const closed = vi.fn();
    renderHook(() => [useHistoryLayer('a', true, closed), useHistoryLayer('b', true, closed)]);
    expect(layers()).toBe(2);
    const next = vi.fn();
    act(() => HistoryLayers.unwind(next));
    await waitFor(() => expect(next).toHaveBeenCalledTimes(1));
    expect(closed).toHaveBeenCalledTimes(2);
    expect(layers()).toBe(0);
  });
});

describe('useExitAnimation', () => {
  it('closes once even when animationend and the fallback timer both fire', () => {
    vi.useFakeTimers();
    const matchMedia = vi.fn(() => ({ matches: true }) as unknown as MediaQueryList);
    vi.stubGlobal('matchMedia', matchMedia);
    const onClose = vi.fn();
    const { result } = renderHook(() => useExitAnimation(onClose));
    act(() => result.current.close());
    const element = document.createElement('aside');
    act(() => result.current.onAnimationEnd({ target: element, currentTarget: element } as never));
    act(() => vi.advanceTimersByTime(1000));
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
