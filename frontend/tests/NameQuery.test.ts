import { describe, expect, it } from 'vitest';
import { NameQuery } from '../src/domain/NameQuery';

describe('NameQuery in Devanagari', () => {
  // Seat names as public/boundaries/areas_labels.geojson spells them, against their usual Hindi spelling.
  it.each([
    ['सूरसागर', 'Soorsagar'],
    ['जोधपुर', 'Jodhpur'],
    ['सरदारपुरा', 'Sardarpura'],
    ['लूणी', 'Luni'],
    ['ओसियां', 'Osian'],
    ['फलोदी', 'Phalodi'],
    ['बिलाड़ा', 'Bilara'],
    ['शेरगढ़', 'Shergarh'],
    ['लोहावट', 'Lohawat'],
    ['बायतू', 'Baytoo'],
    ['गंगानगर', 'Ganganagar'],
    ['उदयपुर', 'Udaipur'],
    ['चित्तौड़गढ़', 'Chittorgarh'],
    ['झुंझुनूं', 'Jhunjhunu'],
    ['लाडनूं', 'Ladnun'],
  ])('finds %s in %s, from the start', (hindi, name) => {
    expect(NameQuery.of(hindi).matches(name)).toBe(true);
    expect(NameQuery.of(hindi).starts(name)).toBe(true);
  });
});

describe('NameQuery in Devanagari, part typed or numbered', () => {
  it('matches while the name is still being typed', () => {
    expect(NameQuery.of('सूर').starts('Soorsagar')).toBe(true);
    expect(NameQuery.of('सरद').starts('Sardarpura')).toBe(true);
    expect(NameQuery.of('जोध').starts('Jodhpur')).toBe(true);
  });

  it('finds a ward by its number in either script of digits', () => {
    expect(NameQuery.of('वार्ड 37').matches('Ward 37')).toBe(true);
    expect(NameQuery.of('वार्ड ३७').matches('Ward 37')).toBe(true);
    expect(NameQuery.of('वार्ड ३७').matches('Ward 3')).toBe(false);
  });

  it('does not match a different name', () => {
    expect(NameQuery.of('जोधपुर').matches('Sardarpura')).toBe(false);
    expect(NameQuery.of('लूणी').matches('Bilara')).toBe(false);
  });

  it('is empty for blank text or signs with no sound', () => {
    expect(NameQuery.of('  ').empty).toBe(true);
    expect(NameQuery.of('ं').empty).toBe(true);
    expect(NameQuery.of('ं').matches('Jodhpur')).toBe(false);
  });
});

describe('NameQuery in Latin letters', () => {
  it('matches as before: the name holds the text, case and outer spaces ignored', () => {
    expect(NameQuery.of(' SARD ').matches('Sardarpura')).toBe(true);
    expect(NameQuery.of('pura').starts('Sardarpura')).toBe(false);
    expect(NameQuery.of('mandore').matches('Sardarpura')).toBe(false);
  });
});

describe('NameQuery.key', () => {
  it('folds Latin spelling variants of one name together', () => {
    expect(NameQuery.key('Soorsagar')).toBe(NameQuery.key('sursagar'));
    expect(NameQuery.key('Lohawat')).toBe(NameQuery.key('lohavat'));
    expect(NameQuery.key('Jaipur')).toBe(NameQuery.key('jaypur'));
    expect(NameQuery.key('Phalodi')).toBe(NameQuery.key('falodi'));
    expect(NameQuery.of('लक्ष्मणगढ़').matches('Rajgarh Laxmangarh')).toBe(true);
  });
});
