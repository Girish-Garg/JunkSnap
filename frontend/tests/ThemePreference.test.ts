import { describe, expect, it } from 'vitest';
import { BasemapTheme } from '../src/features/map/BasemapTheme';
import { ThemePreference } from '../src/services/ThemePreference';
import { MemoryStore } from './helpers';

describe('ThemePreference', () => {
  it('defaults to System and leaves the choice to prefers-color-scheme', () => {
    const root = document.createElement('html');
    const theme = new ThemePreference(new MemoryStore(), root);
    theme.apply();
    expect(theme.current()).toBe('system');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('saves Light or Dark, marks the root, and tells listeners', () => {
    const store = new MemoryStore();
    const root = document.createElement('html');
    const theme = new ThemePreference(store, root);
    let heard = 0;
    theme.subscribe(() => heard++);
    theme.set('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(new ThemePreference(store, null).current()).toBe('dark');
    theme.set('system');
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(heard).toBe(2);
  });

  it('ignores a stored value it does not know', () => {
    const store = new MemoryStore();
    store.setItem('junksnap.theme', 'purple');
    expect(new ThemePreference(store, null).current()).toBe('system');
  });
});

describe('BasemapTheme dark', () => {
  it('gives the land, water and labels their night colours', () => {
    expect(BasemapTheme.paint({ id: 'background', type: 'background' }, true)).toEqual({ 'background-color': '#1d1a16' });
    expect(BasemapTheme.paint({ id: 'water', type: 'fill' }, true)).toEqual({ 'fill-color': '#1a3440' });
    expect(BasemapTheme.paint({ id: 'label_city', type: 'symbol' }, true)).toMatchObject({ 'text-color': '#c9bdaa' });
  });
});
