import { describe, expect, it } from "vitest";
import { NgeohashCells } from "../../src/adapters/sites/NgeohashCells.js";
import { ValidationError } from "../../src/domain/errors.js";
import { BoundingBox } from "../../src/domain/sites/BoundingBox.js";
import { EmbeddingVector } from "../../src/domain/sites/EmbeddingVector.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import { BboxTooLargeError } from "../../src/domain/sites/SiteErrors.js";
import { BASE_LAT, BASE_LON, northOf } from "./builders.js";
import { PAGING } from "../defaults.js";

const base = new GeoPoint(BASE_LAT, BASE_LON);

describe("GeoPoint", () => {
  it("measures haversine metres", () => {
    expect(base.distanceTo(new GeoPoint(northOf(40), BASE_LON))).toBeCloseTo(40, 0);
    expect(new GeoPoint(26.2618, 73.0035).distanceTo(new GeoPoint(26.853, 75.8156))).toBeCloseTo(286_000, -4);
    expect(base.distanceTo(base)).toBe(0);
  });
});

describe("BoundingBox.parse", () => {
  it("reads minLon,minLat,maxLon,maxLat and contains points inside", () => {
    const box = BoundingBox.parse("72.9,26.2,73.1,26.4", PAGING.bboxMaxDegrees);
    expect(box.contains(base)).toBe(true);
    expect(box.contains(new GeoPoint(26.5, 73))).toBe(false);
  });

  it("accepts exactly 1 by 1 degree", () => {
    expect(() => BoundingBox.parse("72.5,26,73.5,27", PAGING.bboxMaxDegrees)).not.toThrow();
  });

  it.each(["", "73,26,74", "73,26,74,x", "73,,74,27", "74,26,73,27", "73,27,73.5,26", "181,0,181.5,1", "1,2,3,4,5"])(
    "rejects %j as bad_request",
    (text) => {
      expect(() => BoundingBox.parse(text, PAGING.bboxMaxDegrees)).toThrow(ValidationError);
      expect(() => BoundingBox.parse(text, PAGING.bboxMaxDegrees)).not.toThrow(BboxTooLargeError);
    },
  );

  it.each(["72,26,73.01,27", "72,26,73,27.2"])("rejects %j as bbox_too_large", (text) => {
    expect(() => BoundingBox.parse(text, PAGING.bboxMaxDegrees)).toThrow(BboxTooLargeError);
  });

  it("builds a box around a point that holds its radius", () => {
    const box = BoundingBox.around(base, 40);
    expect(box.contains(new GeoPoint(northOf(39), BASE_LON))).toBe(true);
    expect(box.contains(new GeoPoint(northOf(41), BASE_LON))).toBe(false);
  });
});

describe("NgeohashCells", () => {
  const cells = new NgeohashCells();

  it("enumerates every precision-4 cell over a 1 by 1 degree box", () => {
    const covering = cells.covering(BoundingBox.parse("72.5,26,73.5,27", PAGING.bboxMaxDegrees));
    expect(covering.length).toBeGreaterThanOrEqual(4 * 7);
    expect(covering.length).toBeLessThanOrEqual(5 * 8);
    expect(new Set(covering).size).toBe(covering.length);
    for (const [lat, lon] of [[26, 72.5], [27, 73.5], [26.5, 73], [26.99, 72.51]] as const) {
      expect(covering).toContain(cells.cellOf(new GeoPoint(lat, lon)));
    }
  });

  it("covers a 40 m merge search with one to four cells, including the point's own", () => {
    const covering = cells.covering(BoundingBox.around(base, 40));
    expect(covering.length).toBeGreaterThanOrEqual(1);
    expect(covering.length).toBeLessThanOrEqual(4);
    expect(covering).toContain(cells.cellOf(base));
    expect(cells.cellOf(base)).toHaveLength(4);
  });
});

describe("EmbeddingVector", () => {
  it("computes cosine similarity", () => {
    const a = new EmbeddingVector([1, 0, 0]);
    expect(a.cosine(new EmbeddingVector([2, 0, 0]))).toBeCloseTo(1);
    expect(a.cosine(new EmbeddingVector([0, 1, 0]))).toBeCloseTo(0);
    expect(a.cosine(new EmbeddingVector([0, 0, 0]))).toBe(0);
    expect(a.cosine(new EmbeddingVector([1, 0]))).toBeNull();
  });
});
