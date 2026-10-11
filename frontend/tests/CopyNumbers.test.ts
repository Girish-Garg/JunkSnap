import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import hi from '../src/i18n/hi.json';
import { CopyNumbers } from '../src/i18n/CopyNumbers';
import { LanguagePreference, type Language } from '../src/i18n/LanguagePreference';
import { Localization } from '../src/i18n/Localization';
import { DEFAULTS } from './config';
import { MemoryStore } from './helpers';

type Node = string | readonly Node[] | { readonly [key: string]: Node };

// Every string with its key path (list items by index), so the two languages can be compared key by key.
function strings(node: Node, prefix = ''): ReadonlyMap<string, string> {
  if (typeof node === 'string') return new Map([[prefix, node]]);
  return new Map(Object.entries(node).flatMap(([key, value]) => [...strings(value as Node, `${prefix}.${key}`)]));
}

const variables = (text: string) => [...text.matchAll(/{{(\w+)}}/g)].map((match) => match[1]).sort();

function say(language: Language, copy = CopyNumbers.of(DEFAULTS.site)) {
  const { i18n } = new Localization(new LanguagePreference(new MemoryStore()), copy);
  return (key: string) => i18n.t(key, { lng: language });
}

describe('copy numbers', () => {
  it('says what it said before the numbers were settings', () => {
    const t = say('en');
    expect(t('vote.text')).toBe('Neighbours confirm reports. Your vote counts when you are within 1 km of the site.');
    expect(t('gate.tooFarCleanup')).toBe('Go within 50 m of the site to send a cleanup photo.');
    expect(t('areaLetter.lockedShort')).toBe('Opens at 10 verified reports');
    expect(t('nobin.send')).toBe('There is no dustbin within 1 km of here');
    expect(say('hi')('vote.errors.too_far')).toBe('वोट केवल स्थल से 1 किमी के अंदर गिने जाते हैं। पास जाकर फिर कोशिश करें।');
  });

  it('follows the configured radii and threshold', () => {
    const t = say('en', CopyNumbers.of({ ...DEFAULTS.site, voteRadiusM: 800, cleanupRadiusM: 30, zoneRadiusM: 1500, flagRadiusM: 2000, minVerifiedReports: 12 }));
    expect(t('vote.errors.too_far')).toContain('within 0.8 km');
    expect(t('cleanup.text')).toContain('within 30 m');
    expect(t('vote.noBin.yes')).toContain('within 1.5 km');
    expect(t('gate.tooFarReport')).toContain('within 2 km');
    expect(t('ranking.intro')).toContain('after 12 verified reports');
  });

  it('has the same keys and the same {{variables}} in English and Hindi', () => {
    const english = strings(en as unknown as Node);
    const hindi = strings(hi as unknown as Node);
    expect([...hindi.keys()].sort()).toEqual([...english.keys()].sort());
    for (const [key, text] of english) expect([key, variables(hindi.get(key) ?? '')]).toEqual([key, variables(text)]);
  });
});
