import { describe, expect, it } from 'vitest';
import { GPS_TRACK_TICK_MS, GpsTrack } from '../src/domain/GpsTrack';

const START = Date.parse('2026-10-10T04:00:00Z');
const FIX = { lat: 26.26183, lon: 73.00352, accuracy_m: 6 };

describe('GpsTrack timing', () => {
  it('puts the first fix at t_ms 0 and later fixes at their ms from the start', () => {
    const track = new GpsTrack(START, FIX);
    track.add({ ...FIX, lat: 26.2619 }, START + 1234.6);
    expect(track.fixes(5000).map((fix) => fix.t_ms)).toEqual([0, 1235]);
  });

  it('keeps t_ms strictly increasing and at most 10 fixes a second', () => {
    const track = new GpsTrack(START, FIX);
    for (let ms = 20; ms < 1000; ms += 20) track.add(FIX, START + ms);
    const times = track.fixes(1000).map((fix) => fix.t_ms);
    expect(times.length).toBeLessThanOrEqual(10);
    expect(times.every((t, i) => i === 0 || t > (times[i - 1] ?? -1))).toBe(true);
  });
});

describe('GpsTrack rate and limits', () => {
  it('pads a silent GPS so every whole second has a fix, widening accuracy with age', () => {
    const track = new GpsTrack(START, FIX);
    for (let ms = GPS_TRACK_TICK_MS; ms <= 10_000; ms += GPS_TRACK_TICK_MS) track.pad(START + ms);
    const fixes = track.fixes(10_000);
    expect(fixes.length).toBeGreaterThanOrEqual(10);
    const gaps = fixes.slice(1).map((fix, i) => fix.t_ms - (fixes[i]?.t_ms ?? 0));
    expect(Math.max(...gaps)).toBeLessThan(1000);
    expect(fixes.at(-1)?.accuracy_m).toBeGreaterThan(50);
  });

  it('drops fixes after the end of the video and caps the track at 600 fixes', () => {
    const track = new GpsTrack(START, FIX);
    for (let ms = 100; ms <= 70_000; ms += 100) track.add(FIX, START + ms);
    expect(track.fixes(60_000).length).toBe(600);
    expect(track.fixes(3_000).at(-1)?.t_ms).toBe(3_000);
  });
});
