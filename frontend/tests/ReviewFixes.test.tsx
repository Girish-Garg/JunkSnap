import { act, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/app/AppRoutes';
import { SplashSession } from '../src/features/brand/SplashSession';
import { useExitAnimation } from '../src/ui/useExitAnimation';
import { renderApp } from './helpers';

vi.mock('../src/features/map/components/SiteMapView', () => ({ SiteMapView: () => null }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('legend caveat', () => {
  it('keeps "scores need 10 verified reports" visible while the legend is folded', async () => {
    await renderApp(<AppRoutes />);
    expect(await screen.findByText('Scores show after 10 verified reports')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Legend' })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('closing animation', () => {
  it('closes after a timeout when animationend never arrives', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const onClose = vi.fn();
    const { result } = renderHook(() => useExitAnimation(onClose));
    act(() => result.current.close());
    expect(result.current.closing).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(400));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SplashSession', () => {
  it('plays once per session and plays anyway when storage is blocked', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
    const session = new SplashSession(() => storage as unknown as Storage);
    expect(session.due()).toBe(true);
    session.played();
    expect(session.due()).toBe(false);
    const blocked = new SplashSession(() => {
      throw new Error('blocked');
    });
    expect(blocked.due()).toBe(true);
    expect(() => blocked.played()).not.toThrow();
  });
});
