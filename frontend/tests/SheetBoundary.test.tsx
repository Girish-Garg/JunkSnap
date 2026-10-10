import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { ErrorBoundary } from '../src/ui/ErrorBoundary';
import { renderApp } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

// The ranking sheet crashes while `crashing` is set; Try again renders it again.
const crash = vi.hoisted(() => ({ crashing: true }));
vi.mock('../src/features/ranking/components/RankingRoute', () => ({
  RankingRoute: () => {
    if (crash.crashing) throw new Error('Ranking blew up');
    return <h2>Ranking is back</h2>;
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  crash.crashing = true;
});

function quietConsole() {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  return vi.spyOn(console, 'warn').mockImplementation(() => undefined);
}

describe('a crash inside a route sheet', () => {
  it('shows "Something went wrong" with Try again, keeps the app alive, and reports it with a tag', async () => {
    const warn = quietConsole();
    await renderApp(<AppRoutes />, { route: '/ranking' });
    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText(/The map and everything else still work/)).toBeInTheDocument();
    // The map page and its tabs are still there.
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith('[junksnap:error]', expect.objectContaining({ where: 'sheet', category: 'unknown', message: 'Ranking blew up' }));
  });

  it('recovers when Try again renders the sheet without the crash', async () => {
    quietConsole();
    const user = userEvent.setup();
    await renderApp(<AppRoutes />, { route: '/ranking' });
    await screen.findByRole('heading', { name: 'Something went wrong' });
    crash.crashing = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Ranking is back' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Something went wrong' })).not.toBeInTheDocument();
  });

  it('says it in Hindi in the Hindi app', async () => {
    quietConsole();
    await renderApp(<AppRoutes />, { route: '/ranking', language: 'hi' });
    expect(await screen.findByRole('heading', { name: 'कुछ गड़बड़ हो गई' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'फिर कोशिश करें' })).toBeInTheDocument();
  });
});

describe('ErrorBoundary', () => {
  it('renders nothing without a fallback, as the map uses it, and tells its parent', () => {
    quietConsole();
    const onError = vi.fn();
    const Boom = () => {
      throw new Error('map crashed');
    };
    const { container } = render(
      <ErrorBoundary onError={onError}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'map crashed' }));
  });
});
