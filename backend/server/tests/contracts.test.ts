import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as contracts from "../src/contracts/index.gen.js";
import { ValidationError } from "../src/domain/errors.js";

const ROOT = new URL("../../../contracts/", import.meta.url);
const SCHEMA_SUFFIX = ".schema.json";

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, ROOT), "utf8"));
}

function isContractName(name: string): name is contracts.ContractName {
  return name in contracts.CONTRACT_VALIDATORS;
}

const fixtures = readdirSync(new URL("fixtures/", ROOT)).filter((file) => file.endsWith(".json"));
const schemaNames = readdirSync(new URL("schemas/", ROOT))
  .filter((file) => file.endsWith(SCHEMA_SUFFIX))
  .map((file) => file.slice(0, -SCHEMA_SUFFIX.length));

describe("contract fixtures", () => {
  it.each(fixtures)("%s validates with the generated validator", (file) => {
    const name = file.split(".")[0] ?? "";
    expect(isContractName(name), `no generated validator for ${name}`).toBe(true);
    if (isContractName(name)) {
      expect(() => contracts.CONTRACT_VALIDATORS[name](readJson(`fixtures/${file}`))).not.toThrow();
    }
  });
});

describe("generated contracts", () => {
  it("cover every schema with its current text (else run npm run gen:contracts)", () => {
    expect(Object.keys(contracts.CONTRACT_VALIDATORS).sort()).toEqual([...schemaNames].sort());
    for (const name of schemaNames) {
      const camel = name.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
      const embedded = (contracts as Record<string, unknown>)[`${camel}Schema`];
      expect(embedded, name).toEqual(readJson(`schemas/${name}${SCHEMA_SUFFIX}`));
    }
  });

  it("rejects a bad shape with a ValidationError naming the contract", () => {
    expect(() => contracts.validateSite({ type: "Feature" })).toThrow(ValidationError);
    expect(() => contracts.validateSite({ type: "Feature" })).toThrow(/^site/);
  });

  it("asserts formats, which the Python fixture check skips", () => {
    const site = readJson("fixtures/site.jdh-1.json") as { properties: Record<string, unknown> };
    site.properties.first_reported_at = "yesterday";
    expect(() => contracts.validateSite(site)).toThrow(/date-time/);
  });
});
