import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import type { SiteMapBindings } from '../src/features/map/hooks/useSiteMap';
import { renderApp } from './helpers';

const seen = vi.hoisted(() => ({ last: null as SiteMapBindings | null }));

// A map stand-in: the tests report the basemap's progress through onBasemap, as SiteMap (BasemapWatch) does.
vi.mock('../src/features/map/components/SiteMapView', () => ({
  SiteMapView: (props: SiteMapBindings) => {
    seen.last = props;
    return null;
  },
}));

const LOADING = 'Loading the map…';
const SLOW = /^Slow connection: the map is still loading/;
const FAILED = 'The map could not load.';

// The app renders on real timers; then only setTimeout is faked, which the basemap's clock (600 ms, 8 s) runs on.
async function startLoading(): Promise<void> {
  await renderApp(<AppRoutes />);
  await waitFor(() => expect(seen.last).not.toBeNull());
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  act(() => seen.last?.onBasemap('loading'));
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const statusOf = (text: string | RegExp) => screen.getByText(text).closest('.map-status') as HTMLElement;

beforeEach(() => {
  seen.last = null;
  window.sessionStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('the basemap on a fast network', () => {
  it('shows nothing for the first 600 ms, and nothing at all once the map has drawn', async () => {
    await startLoading();
    advance(599);
    expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
    act(() => seen.last?.onBasemap('loaded'));
    advance(10_000);
    expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
    expect(screen.queryByText(SLOW)).not.toBeInTheDocument();
  });
});

describe('the basemap on a slow network', () => {
  it('says "Loading the map…" with a spinner from 600 ms', async () => {
    await startLoading();
    advance(600);
    const line = screen.getByText(LOADING).closest('.notice');
    expect(line?.querySelector('.spinner')).not.toBeNull();
    expect(line).toHaveAttribute('role', 'status');
  });

  it('says the connection is slow after 8 s and offers the list, Areas and Report', async () => {
    await startLoading();
    advance(7999);
    expect(screen.queryByText(SLOW)).not.toBeInTheDocument();
    advance(1);
    const buttons = within(statusOf(SLOW)).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['List', 'Areas', 'Report']);
  });

  it('clears the moment the map has drawn', async () => {
    await startLoading();
    advance(8000);
    expect(screen.getByText(SLOW)).toBeInTheDocument();
    act(() => seen.last?.onBasemap('loaded'));
    expect(screen.queryByText(SLOW)).not.toBeInTheDocument();
    expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
  });
});

describe('what works while the basemap is slow', () => {
  it('Areas opens without the map', async () => {
    await startLoading();
    advance(8000);
    vi.useRealTimers();
    await userEvent.setup().click(within(statusOf(SLOW)).getByRole('button', { name: 'Areas' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Areas' })).toBeInTheDocument();
  });

  it('never shows in the list the app falls back to when the map stops drawing', async () => {
    await startLoading();
    act(() => seen.last?.onFail(new Error('WebGL context lost')));
    advance(10_000);
    expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
    expect(screen.queryByText(SLOW)).not.toBeInTheDocument();
  });
});

describe('a basemap that fails to load', () => {
  it('says so at once with Try again, which asks the map for its style again', async () => {
    await startLoading();
    act(() => seen.last?.onBasemap('failed'));
    expect(screen.getByText(FAILED).closest('.notice')).toHaveAttribute('role', 'alert');
    expect(seen.last?.basemapRetries).toBe(0);
    fireEvent.click(within(statusOf(FAILED)).getByRole('button', { name: 'Try again' }));
    expect(seen.last?.basemapRetries).toBe(1);
    expect(screen.queryByText(FAILED)).not.toBeInTheDocument();
    // The new load is timed afresh: quiet, then "Loading the map…".
    advance(600);
    expect(screen.getByText(LOADING)).toBeInTheDocument();
  });
});
