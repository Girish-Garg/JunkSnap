import { describe, expect, it } from "vitest";
import { Box } from "../../src/domain/moderation/Box.js";
import { IndianPlatePattern } from "../../src/domain/moderation/IndianPlatePattern.js";
import { PlateTextScanner, type TextLine } from "../../src/domain/moderation/PlateTextScanner.js";
import { box } from "./fakes.js";

const pattern = new IndianPlatePattern();

function line(text: string, at: Box, words: string[] = []): TextLine {
  const width = at.width / Math.max(1, words.length);
  return { text, box: at, words: words.map((word, i) => ({ text: word, box: box(at.left + i * width, at.top, width, at.height) })) };
}

describe("IndianPlatePattern", () => {
  it.each(["AP13 W 9238", "TN07BT 2349", "WB-25 D 2676", "MH 12 AB 1234", "dl 3c ab 1234", "RJ19.CA.0001", "22 BH 1234 AA"])(
    "reads %s as a plate",
    (text) => {
      expect(pattern.isPlate(text)).toBe(true);
    },
  );

  it.each(["Call: 0251 2808 052", "2 BHK 66.95 LAKHS", "AB12CD3456", "Ward No. 49", "HERCULES", "XX12AB1234"])(
    "does not read %s as a plate",
    (text) => {
      expect(pattern.isPlate(text)).toBe(false);
    },
  );

  it("knows the two halves of a two-line plate", () => {
    expect(pattern.isTopLine("WB '25")).toBe(true);
    expect(pattern.isTopLine("MH12AB")).toBe(true);
    expect(pattern.isBottomLine("D 2676")).toBe(true);
    expect(pattern.isBottomLine("0.2676")).toBe(true);
    expect(pattern.isTopLine("the 500")).toBe(false);
  });
});

describe("PlateTextScanner", () => {
  const scanner = new PlateTextScanner();

  it("takes a whole line that is a plate", () => {
    const plate = box(0.4, 0.6, 0.1, 0.03);
    expect(scanner.plateBoxes([line("AP13 W 9238", plate), line("MERCHANT SHOP", box(0.1, 0.1, 0.3, 0.05))])).toEqual([plate]);
  });

  it("finds a run of words inside a longer line and boxes only those words", () => {
    const found = scanner.plateBoxes([line("IND KA 01 AB 1234 OK", box(0, 0.5, 0.6, 0.04), ["IND", "KA", "01", "AB", "1234", "OK"])]);
    expect(found).toHaveLength(1);
    expect(found[0]?.left).toBeCloseTo(0.1);
    expect(found[0]?.right).toBeCloseTo(0.5);
  });

  it("pairs a top line with the bottom line just below it, even when OCR lists them apart", () => {
    const top = box(0.5, 0.40, 0.06, 0.03);
    const bottom = box(0.495, 0.435, 0.07, 0.03);
    const found = scanner.plateBoxes([line("WB '25", top), line("the 500", box(0.1, 0.1, 0.1, 0.03)), line("D 2676", bottom)]);
    expect(found).toEqual([Box.enclosing([top, bottom])]);
  });

  it("does not pair lines far apart", () => {
    expect(scanner.plateBoxes([line("WB 25", box(0.1, 0.1, 0.06, 0.03)), line("2676", box(0.6, 0.8, 0.06, 0.03))])).toEqual([]);
  });

  it("counts a plate once when line and words both match", () => {
    const plate = box(0.4, 0.6, 0.2, 0.03);
    expect(scanner.plateBoxes([line("MH 12 AB 1234", plate, ["MH", "12", "AB", "1234"])])).toHaveLength(1);
  });
});

describe("Box", () => {
  it("grows by a fraction around its centre and stays inside the image", () => {
    const grown = box(0.4, 0.4, 0.2, 0.2).grow(0.15);
    expect(grown.left).toBeCloseTo(0.385);
    expect(grown.width).toBeCloseTo(0.23);
    const edge = box(0, 0.9, 0.1, 0.1).grow(0.5);
    expect([edge.left, edge.bottom]).toEqual([0, 1]);
  });

  it("maps fractions to whole pixels", () => {
    expect(box(0.25, 0.5, 0.5, 0.25).toPixels(200, 100)).toEqual({ left: 50, top: 50, width: 100, height: 25 });
    expect(box(0.5, 0.5, 0, 0.1).toPixels(200, 100)).toBeNull();
  });

  it("measures overlap against the smaller box", () => {
    expect(box(0, 0, 0.5, 0.5).overlapOfSmaller(box(0.25, 0.25, 0.1, 0.1))).toBeCloseTo(1);
    expect(box(0, 0, 0.1, 0.1).overlapOfSmaller(box(0.5, 0.5, 0.1, 0.1))).toBe(0);
  });
});
