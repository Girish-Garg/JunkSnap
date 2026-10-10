import { describe, expect, it } from 'vitest';
import { GPS_TRACK_TICK_MS, GpsTrack } from '../src/domain/GpsTrack';

const START = Date.parse('2026-10-10T04:00:00Z');
const FIX = { lat: 26.26183, lon: 73.00352, accuracy_m: 6 };
const taken = (takenAtMs: number, fix = FIX) => ({ fix, takenAtMs });

describe('GpsTrack timing', () => {
  it('places each fix at the time the GPS took it, not when it arrived', () => {
    const track = new GpsTrack(START, taken(START));
    track.add(taken(START + 1234.6, { ...FIX, lat: 26.2619 }));
    expect(track.fixes(5000).map((fix) => fix.t_ms)).toEqual([0, 1235]);
    expect(track.fixes(5000)[1]?.accuracy_m).toBe(6);
  });

  it('widens the first fix at t_ms 0 by how old it is when recording starts', () => {
    const track = new GpsTrack(START, taken(START - 2000));
    expect(track.fixes(1000)[0]).toEqual({ t_ms: 0, lat: FIX.lat, lon: FIX.lon, accuracy_m: 36 });
  });

  it('keeps t_ms strictly increasing and at most 10 fixes a second', () => {
    const track = new GpsTrack(START, taken(START));
    for (let ms = 20; ms < 1000; ms += 20) track.add(taken(START + ms));
    track.add(taken(START + 500));
    const times = track.fixes(1000).map((fix) => fix.t_ms);
    expect(times.length).toBeLessThanOrEqual(10);
    expect(times.every((t, i) => i === 0 || t > (times[i - 1] ?? -1))).toBe(true);
  });
});

describe('GpsTrack rate and limits', () => {
  it('pads a silent GPS so no gap reaches 1 s, widening by 15 m per second of age', () => {
    const track = new GpsTrack(START, taken(START));
    for (let ms = GPS_TRACK_TICK_MS; ms <= 10_000; ms += GPS_TRACK_TICK_MS) track.pad(START + ms);
    const fixes = track.fixes(10_000);
    const gaps = fixes.slice(1).map((fix, i) => fix.t_ms - (fixes[i]?.t_ms ?? 0));
    expect(Math.max(...gaps)).toBeLessThan(1000);
    expect(fixes.find((fix) => fix.t_ms === 2000)?.accuracy_m).toBe(36);
    expect(fixes.at(-1)?.accuracy_m).toBe(156);
  });

  it('pads from the newest fix even when an older one arrives late', () => {
    const track = new GpsTrack(START, taken(START));
    track.add(taken(START + 2000, { ...FIX, lat: 26.3 }));
    track.add(taken(START + 1500, { ...FIX, lat: 26.1 }));
    track.pad(START + 3000);
    expect(track.fixes(3000).at(-1)).toMatchObject({ t_ms: 3000, lat: 26.3, accuracy_m: 21 });
  });

  it('drops fixes after the end of the video and caps the track at 600 fixes', () => {
    const track = new GpsTrack(START, taken(START));
    for (let ms = 100; ms <= 70_000; ms += 100) track.add(taken(START + ms));
    expect(track.fixes(60_000).length).toBe(600);
    expect(track.fixes(3_000).at(-1)?.t_ms).toBe(3_000);
  });
});
