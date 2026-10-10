import { describe, expect, it } from 'vitest';
import fixture from '../../contracts/fixtures/area_letter_draft.jdh-1.json';
import schema from '../../contracts/schemas/area_letter_draft.schema.json';
import { AREA_ISSUES, type AreaLetterDraft } from '../src/domain/AreaLetter';

const draft: AreaLetterDraft = fixture as unknown as AreaLetterDraft;
const keys = (value: object) => Object.keys(value).sort();

describe('area_letter_draft matches the frontend type', () => {
  it('has exactly the schema top-level and evidence fields', () => {
    expect(keys(draft)).toEqual([...schema.required].sort());
    expect(keys(draft.evidence)).toEqual([...schema.properties.evidence.required].sort());
  });

  it('has the worst-site fields, the measured-score fields and the bin access fields', () => {
    const site = schema.properties.evidence.properties.worst_sites.items;
    expect(keys(draft.evidence.worst_sites[0] ?? {})).toEqual([...site.required].sort());
    expect(keys(draft.evidence.scores[0] ?? {})).toEqual(['name', 'value', 'verified_reports']);
    expect(keys(draft.evidence.bin_access ?? {})).toEqual(['sites_measured', 'sites_without_bin_within_3km']);
  });

  it('addresses offices as a list and uses the issues the api accepts', () => {
    expect(Array.isArray(draft.to)).toBe(true);
    expect(draft.to.length).toBeGreaterThan(0);
    expect([...AREA_ISSUES]).toEqual(schema.properties.issue.enum);
  });
});
