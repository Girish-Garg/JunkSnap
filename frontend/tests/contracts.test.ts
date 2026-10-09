import { describe, expect, it } from 'vitest';
import siteSchema from '../../contracts/schemas/site.schema.json';
import { REPORT_TYPES } from '../src/domain/ReportType';

interface EnumSchema {
  readonly enum?: readonly unknown[];
}

const fixtures = import.meta.glob<{ properties: Record<string, unknown> }>('../../contracts/fixtures/site.*.json', {
  eager: true,
  import: 'default',
});
const propertiesSchema = siteSchema.properties.properties;
const known = Object.keys(propertiesSchema.properties);
const enums = Object.entries(propertiesSchema.properties as Record<string, EnumSchema>).filter(
  ([, schema]) => schema.enum !== undefined,
);

describe('site fixtures match contracts/schemas/site.schema.json', () => {
  it('has fixtures to check', () => {
    expect(Object.keys(fixtures).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(fixtures))('%s has every required property and no unknown one', (_path, fixture) => {
    const keys = Object.keys(fixture.properties);
    expect(keys).toEqual(expect.arrayContaining([...propertiesSchema.required]));
    expect(known).toEqual(expect.arrayContaining(keys));
  });

  it.each(Object.entries(fixtures))('%s uses only enum values from the schema', (_path, fixture) => {
    for (const [field, schema] of enums) expect(schema.enum).toContain(fixture.properties[field]);
  });

  it('REPORT_TYPES equals the report_type enum', () => {
    expect([...REPORT_TYPES]).toEqual(propertiesSchema.properties.report_type.enum);
  });
});
