import { describe, expect, it } from 'vitest';
import verification from '../../contracts/fixtures/verification_result.jdh-1.json';
import { RationaleSanitizer } from '../src/domain/RationaleSanitizer';

const clean = (text: string | null | undefined) => RationaleSanitizer.clean(text);

describe('RationaleSanitizer', () => {
  it('keeps a plain reason as it is', () => {
    expect(clean(verification.judge.rationale)).toBe(verification.judge.rationale);
    expect(clean('Garbage heap about 40 m long beside a drain, 2 bags burst.')).toBe('Garbage heap about 40 m long beside a drain, 2 bags burst.');
  });

  it.each([
    ['https link', 'Waste pile near the gate, see https://example.com/x?y=1 for more.', 'Waste pile near the gate, see for more.'],
    ['www link', 'Plastic waste on the plot www.example.in/page beside a wall.', 'Plastic waste on the plot beside a wall.'],
    ['bare domain', 'Plastic waste on the plot, details at dumpwatch.org today.', 'Plastic waste on the plot, details at today.'],
    ['email', 'Mixed waste on the roadside; write to someone@example.com about it.', 'Mixed waste on the roadside; write to about it.'],
  ])('strips a %s', (_case, raw, expected) => {
    expect(clean(raw)).toBe(expected);
  });

  it.each([
    ['Indian mobile', 'Waste dumped by the wall, call +91 98290 12345 for pickup.'],
    ['landline', 'Waste dumped by the wall, call (0291) 254-3210 for pickup.'],
    ['plain digits', 'Waste dumped by the wall, call 9829012345 for pickup.'],
  ])('strips a phone number: %s', (_case, raw) => {
    expect(clean(raw)).toBe('Waste dumped by the wall, call for pickup.');
  });
});

describe('RationaleSanitizer length and fallback', () => {
  it('caps long text at a word boundary with an ellipsis', () => {
    const long = `Plastic bags and food waste${' spread over the open plot'.repeat(12)}.`;
    const result = clean(long);
    expect(result).not.toBeNull();
    expect(result?.length).toBeLessThanOrEqual(RationaleSanitizer.MAX_LENGTH);
    expect(result?.endsWith('…')).toBe(true);
    const kept = result?.slice(0, -1) ?? '';
    expect(long.startsWith(kept)).toBe(true);
    expect(long.charAt(kept.length)).toBe(' ');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['blank', '   \n\t '],
    ['only a link', 'https://example.com/a'],
    ['only a phone number', '+91 98290 12345'],
    ['too short', 'Waste.'],
  ])('falls back (null) for %s', (_case, raw) => {
    expect(clean(raw)).toBeNull();
  });
});

describe('RationaleSanitizer name guard', () => {
  it.each([
    ['an English honorific', 'Waste outside the house of Mr. Sharma on the corner.'],
    ['a Hindi honorific', 'Waste outside श्री Sharma ji ka ghar on the corner.'],
    ['a naming phrase', 'The owner, named in the sign, left waste on the plot.'],
    ['a first and last name', 'Waste left outside the shop of Ramesh Kumar by the road.'],
    ['a name at the start', 'Ramesh Kumar left the waste beside the wall.'],
    ['a capitalised brand', 'Packets of SAMPLE NAMKEEN spread over the plot.'],
    ['Devanagari text', 'Waste beside रमेश की दुकान on the corner.'],
    ['a number plate', 'Waste next to a scooter with plate rj 19 ca 1234 on the road.'],
  ])('never shows text with %s', (_case, raw) => {
    expect(clean(raw)).toBeNull();
  });

  it('removes control and zero-width characters', () => {
    const zeroWidth = String.fromCharCode(0x200b);
    const bell = String.fromCharCode(7);
    expect(clean(`Waste${zeroWidth} pile on the${bell} roadside verge.`)).toBe('Waste pile on the roadside verge.');
  });
});
