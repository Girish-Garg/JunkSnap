import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FiltersButton } from '../src/features/map/components/FiltersButton';
import { SearchBar } from '../src/features/map/components/SearchBar';
import en from '../src/i18n/en.json';
import hi from '../src/i18n/hi.json';
import { LocaleFormatter } from '../src/i18n/LocaleFormatter';
import { MemoryStore, renderApp, testServices } from './helpers';

function keysOf(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]: [string, unknown]) =>
    typeof child === 'object' && child !== null ? keysOf(child, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

const topOfMap = (
  <>
    <SearchBar sites={[]} onPickPlace={() => undefined} />
    <FiltersButton activeCount={0} onOpen={() => undefined} />
  </>
);

describe('language toggle in the search field', () => {
  it('flips labels from English to Hindi and remembers the choice', async () => {
    const store = new MemoryStore();
    const user = userEvent.setup();
    await renderApp(topOfMap, { services: testServices(store) });
    expect(screen.getByPlaceholderText('Search Jodhpur')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filters/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'हिन्दी' }));

    expect(screen.getByPlaceholderText('जोधपुर में खोजें')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /फ़िल्टर/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Filters/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'हिन्दी' })).toHaveAttribute('aria-pressed', 'true');
    expect(store.getItem('junksnap.language')).toBe('hi');
  });
});

describe('translations and formats', () => {
  it('has a Hindi string for every English label', () => {
    expect(keysOf(hi).sort()).toEqual(keysOf(en).sort());
  });

  it('formats numbers, distances and dates per locale', () => {
    const english = new LocaleFormatter('en');
    const hindi = new LocaleFormatter('hi');
    expect(english.number(123456)).toBe('1,23,456');
    expect(english.distance(347)).toBe('350 m');
    expect(english.distance(1234)).toBe('1.2 km');
    expect(english.dateTime('2026-10-09T03:40:00Z')).toMatch(/Oct/);
    expect(hindi.dateTime('2026-10-09T03:40:00Z')).toMatch(/अक्टू|अक्तू/);
  });
});
