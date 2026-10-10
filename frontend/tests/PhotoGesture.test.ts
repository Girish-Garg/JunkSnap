import { describe, expect, it } from 'vitest';
import { UlidTime } from '../src/domain/UlidTime';
import { PhotoGesture } from '../src/ui/PhotoGesture';

const CROCKFORD = '0123456789abcdefghjkmnpqrstvwxyz';

function ulidAt(millis: number): string {
  let time = '';
  for (let rest = millis, i = 0; i < 10; i += 1, rest = Math.floor(rest / 32)) time = CROCKFORD[rest % 32] + time;
  return `${time}${'0'.repeat(16)}`;
}

function drag(gesture: PhotoGesture, dx: number, dy: number, start = 0) {
  gesture.down(1, { x: 200, y: 300 }, start);
  gesture.move(1, { x: 200 + dx / 2, y: 300 + dy / 2 });
  return gesture.up(1, { x: 200 + dx, y: 300 + dy }, start + 400);
}

function tap(gesture: PhotoGesture, time: number) {
  gesture.down(1, { x: 100, y: 100 }, time);
  return gesture.up(1, { x: 101, y: 100 }, time + 50);
}

describe('PhotoGesture swipes', () => {
  it('turns a left swipe into next, a right swipe into previous and a swipe down into close', () => {
    expect(drag(new PhotoGesture(), -120, 10)).toBe('next');
    expect(drag(new PhotoGesture(), 120, -5)).toBe('previous');
    expect(drag(new PhotoGesture(), 8, 160)).toBe('close');
    expect(drag(new PhotoGesture(), -30, 0)).toBe('none');
  });

  it('follows the finger while dragging and springs back on release', () => {
    const gesture = new PhotoGesture();
    gesture.down(1, { x: 0, y: 0 }, 0);
    gesture.move(1, { x: -40, y: 5 });
    expect(gesture.view().drag).toEqual({ x: -40, y: 5 });
    gesture.up(1, { x: -40, y: 5 }, 100);
    expect(gesture.view().drag).toEqual({ x: 0, y: 0 });
  });
});

describe('PhotoGesture zoom', () => {
  it('zooms on a double tap and back out on the next one', () => {
    const gesture = new PhotoGesture();
    tap(gesture, 0);
    expect(tap(gesture, 150)).toBe('none');
    expect(gesture.view().scale).toBe(2.5);
    tap(gesture, 1000);
    tap(gesture, 1150);
    expect(gesture.view().scale).toBe(1);
  });

  it('pinches between 1x and 4x, and a drag while zoomed pans instead of paging', () => {
    const gesture = new PhotoGesture();
    gesture.down(1, { x: 100, y: 100 }, 0);
    gesture.down(2, { x: 200, y: 100 }, 0);
    gesture.move(2, { x: 300, y: 100 });
    expect(gesture.view().scale).toBe(2);
    gesture.up(2, { x: 300, y: 100 }, 100);
    expect(gesture.up(1, { x: 100, y: 100 }, 100)).toBe('none');
    expect(drag(gesture, -150, 0, 1000)).toBe('none');
    expect(gesture.view().pan).toEqual({ x: -150, y: 0 });
  });
});

describe('UlidTime', () => {
  it('reads when a report or cleanup photo was reported from its URL', () => {
    const millis = Date.UTC(2026, 9, 9, 6, 30);
    expect(UlidTime.fromPhotoUrl(`https://cdn.test/media/reports/rpt_${ulidAt(millis)}.jpg`)).toBe('2026-10-09T06:30:00.000Z');
    expect(UlidTime.fromPhotoUrl(`https://cdn.test/media/cleanups/cln_${ulidAt(millis)}.jpg`)).toBe('2026-10-09T06:30:00.000Z');
  });

  it('shows no date rather than a guess when the URL has no ULID', () => {
    expect(UlidTime.fromPhotoUrl('https://cdn.test/media/reports/rpt_jdh_1.jpg')).toBeNull();
    expect(UlidTime.fromPhotoUrl(`https://cdn.test/media/reports/rpt_${ulidAt(1000)}.jpg`)).toBeNull();
  });
});
