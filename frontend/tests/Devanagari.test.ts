import { describe, expect, it } from 'vitest';
import { Devanagari } from '../src/domain/Devanagari';

describe('Devanagari.toLatin', () => {
  // Jodhpur district seats from public/boundaries/areas_labels.geojson, in their usual Hindi spelling.
  it.each([
    ['सूरसागर', 'sursagar'],
    ['जोधपुर', 'jodhpur'],
    ['सरदारपुरा', 'sardarpura'],
    ['लूणी', 'luni'],
    ['ओसियां', 'osiyan'],
    ['फलोदी', 'phalodi'],
    ['बिलाड़ा', 'bilara'],
    ['शेरगढ़', 'shergarh'],
    ['लोहावट', 'lohavat'],
    ['भोपालगढ़', 'bhopalgarh'],
  ])('reads %s as %s', (hindi, latin) => {
    expect(Devanagari.toLatin(hindi)).toBe(latin);
  });
});

describe('Devanagari.toLatin letters', () => {
  it('reads vowel signs and independent vowels, folding long vowels into short ones', () => {
    expect(Devanagari.toLatin('उदयपुर')).toBe('udaypur');
    expect(Devanagari.toLatin('चित्तौड़गढ़')).toBe('chittaurgarh');
    expect(Devanagari.toLatin('ऐ ओ ऋषि')).toBe('ai o rishi');
  });

  it('gives a nukta letter its own sound, precomposed or combining', () => {
    expect(Devanagari.toLatin('बिला\u095Cा')).toBe('bilara');
    expect(Devanagari.toLatin('बिलाड\u093Cा')).toBe('bilara');
    expect(Devanagari.toLatin('ज़िला फ़ोन')).toBe('zila fon');
  });

  it('reads anusvara as n, or m before p, b and m, and chandrabindu as n', () => {
    expect(Devanagari.toLatin('गंगा')).toBe('ganga');
    expect(Devanagari.toLatin('सांभर')).toBe('sambhar');
    expect(Devanagari.toLatin('चंपा')).toBe('champa');
    expect(Devanagari.toLatin('माँ')).toBe('man');
  });
});

describe('Devanagari.toLatin inherent a', () => {
  it('drops the inherent a at the end of a word and between two vowels, never in the first syllable', () => {
    expect(Devanagari.toLatin('कमल')).toBe('kamal');
    expect(Devanagari.toLatin('किशनगढ़')).toBe('kishangarh');
    expect(Devanagari.toLatin('पचपदरा')).toBe('pachpadra');
  });

  it('keeps the a after a final cluster of y, r, l or v, and drops it after others', () => {
    expect(Devanagari.toLatin('मित्र')).toBe('mitra');
    expect(Devanagari.toLatin('वार्ड')).toBe('vard');
  });
});

describe('Devanagari with other text', () => {
  it('turns Devanagari digits into ASCII and passes Latin letters through in lower case', () => {
    expect(Devanagari.toLatin('वार्ड ३७')).toBe('vard 37');
    expect(Devanagari.toLatin('Ward 12')).toBe('ward 12');
  });

  it('drops signs with no sound of their own', () => {
    expect(Devanagari.toLatin('़् ।')).toBe(' ');
  });

  it('knows Devanagari text from Latin text', () => {
    expect(Devanagari.has('पावटा')).toBe(true);
    expect(Devanagari.has('Ward ३')).toBe(true);
    expect(Devanagari.has('Paota')).toBe(false);
  });
});
