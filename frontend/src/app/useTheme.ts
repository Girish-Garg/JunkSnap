import { useCallback, useSyncExternalStore } from 'react';
import type { Theme } from '../services/ThemePreference';
import { useMediaQuery } from '../ui/useMediaQuery';
import { useServices } from './useServices';

/** The chosen theme, a setter, and whether the page is dark right now (Dark, or System on a dark device). */
export function useTheme() {
  const { theme } = useServices();
  const subscribe = useCallback((listener: () => void) => theme.subscribe(listener), [theme]);
  const current = useSyncExternalStore(subscribe, () => theme.current(), () => theme.current());
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const set = useCallback((next: Theme) => theme.set(next), [theme]);
  return { theme: current, set, dark: current === 'dark' || (current === 'system' && systemDark) };
}
