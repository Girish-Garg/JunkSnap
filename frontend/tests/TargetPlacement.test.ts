import { describe, expect, it } from 'vitest';
import { GeoBearing } from '../src/domain/GeoBearing';
import { GROUND_CAP_M, HIGH_CAP_M, TargetPlacement } from '../src/domain/TargetPlacement';
import { CompassHeading } from '../src/services/CompassHeading';

const ORIGIN = { lat: 26.26183, lon: 73.00352 };
const at = (bearing: number, metres: number) => GeoBearing.offset(ORIGIN, bearing, metres);

describe('GeoBearing', () => {
  it('walks a distance along a bearing and measures it back', () => {
    const east = at(90, 250);
    expect(GeoBearing.metres(ORIGIN, east)).toBeCloseTo(250, 3);
    expect(GeoBearing.between(ORIGIN, east)).toBeCloseTo(90, 3);
    expect(GeoBearing.between(ORIGIN, at(315, 80))).toBeCloseTo(315, 3);
  });
});

describe('TargetPlacement moves', () => {
  it('starts right here, with nothing to send', () => {
    const placement = TargetPlacement.here(ORIGIN);
    expect(placement.target).toBeNull();
    expect(placement.spot).toEqual(ORIGIN);
    expect(placement.distanceM).toBe(0);
    expect(placement.capM).toBe(GROUND_CAP_M);
  });

  it('moves the pin where it was dropped or tapped, and shows the distance to 5 m', () => {
    const placement = TargetPlacement.here(ORIGIN).moveTo(at(40, 122));
    expect(placement.target).not.toBeNull();
    expect(placement.distanceM).toBe(122);
    expect(placement.shownM).toBe(120);
    expect(placement.capped).toBe(false);
  });

  it('treats a pin within 10 m of the reporter as right here', () => {
    const here = TargetPlacement.here(ORIGIN);
    const dropped = here.moveTo(at(200, 8));
    expect(dropped.target).toBeNull();
    // A new spot object, so the map puts the dropped pin back on the reporter.
    expect(dropped.spot).not.toBe(here.spot);
    expect(dropped.spot).toEqual(ORIGIN);
  });
});

describe('TargetPlacement cap', () => {
  it('stops a pin dragged past 300 m at 300 m on the same line, and says so', () => {
    const placement = TargetPlacement.here(ORIGIN).moveTo(at(135, 800));
    expect(placement.capped).toBe(true);
    expect(placement.distanceM).toBe(GROUND_CAP_M);
    expect(GeoBearing.between(ORIGIN, placement.spot)).toBeCloseTo(135, 1);
    expect(placement.moveTo(at(135, 200)).capped).toBe(false);
  });

  it('reaches 500 m from up high and pulls the pin back in on the ground', () => {
    const high = TargetPlacement.here(ORIGIN).withHighView(true).moveTo(at(0, 450));
    expect(high).toMatchObject({ capped: false, distanceM: 450, capM: HIGH_CAP_M });
    expect(high.moveTo(at(0, 900)).distanceM).toBe(HIGH_CAP_M);
    const ground = high.withHighView(false);
    expect(ground).toMatchObject({ capped: true, distanceM: GROUND_CAP_M, high: false });
  });

  it('keeps sent coordinates to 6 decimals, inside the server cap of 500 m', () => {
    const { target } = TargetPlacement.here(ORIGIN).withHighView(true).moveTo(at(77, 5000));
    expect(target?.lat.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(6);
    expect(GeoBearing.metres(ORIGIN, target ?? ORIGIN)).toBeLessThan(HIGH_CAP_M + 0.5);
  });

  it('forgets the pin on reset but keeps the high view', () => {
    const reset = TargetPlacement.here(ORIGIN).withHighView(true).moveTo(at(90, 200)).reset();
    expect(reset).toMatchObject({ target: null, high: true, capped: false });
  });
});

describe('CompassHeading', () => {
  it('reads iOS compass headings and absolute Android alphas, never relative ones', () => {
    expect(CompassHeading.headingOf({ alpha: 10, webkitCompassHeading: 75 })).toBe(75);
    expect(CompassHeading.headingOf({ alpha: 90, absolute: true })).toBe(270);
    expect(CompassHeading.headingOf({ alpha: 90, absolute: false })).toBeNull();
    expect(CompassHeading.headingOf({ alpha: null, absolute: true })).toBeNull();
  });

  it('calls back on orientation events until stopped', () => {
    const target = new EventTarget();
    const seen: number[] = [];
    const stop = new CompassHeading(target).watch((degrees) => seen.push(degrees));
    target.dispatchEvent(Object.assign(new Event('deviceorientationabsolute'), { alpha: 30, absolute: true }));
    stop();
    target.dispatchEvent(Object.assign(new Event('deviceorientationabsolute'), { alpha: 60, absolute: true }));
    expect(seen).toEqual([330]);
  });
});
