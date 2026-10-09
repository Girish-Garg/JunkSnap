import { describe, expect, it } from 'vitest';
import { LocationPresenter } from '../src/features/site/LocationPresenter';
import { testSite } from './siteBuilder';

// Returns the key and params, so the rules are tested apart from the wording.
const translate = (key: string, params?: Readonly<Record<string, string>>) => (params ? `${key}(${params.name})` : key);
const presenterFor = (location: Parameters<typeof testSite>[0]) =>
  new LocationPresenter(testSite(location).properties.location, translate);

describe('LocationPresenter', () => {
  it('lists ward, MLA seat and MP seat', () => {
    expect(presenterFor({}).line()).toBe('Ward 37 · site.mla(Sardarpura) · site.mp(Jodhpur)');
  });

  it('says when there is no ward map or assembly map', () => {
    const presenter = presenterFor({ location: { ward: null, assembly_seat: null } });
    expect(presenter.line()).toBe('site.noWard · site.noAssembly · site.mp(Jodhpur)');
    expect(presenter.facts().map((fact) => fact.value)).toContain('site.noAssembly');
  });

  it('leaves out an MP seat whose boundary is outdated', () => {
    const presenter = presenterFor({ location: { loksabha_seat: { id: 's03-pc-4', name: 'Guwahati', status: 'outdated' } } });
    expect(presenter.line()).toBe('Ward 37 · site.mla(Sardarpura)');
    expect(presenter.facts().at(-1)).toEqual({ label: 'site.loksabhaSeat', value: 'site.seatOutdated' });
  });
});
