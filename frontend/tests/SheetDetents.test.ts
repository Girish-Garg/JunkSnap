import { describe, expect, it } from 'vitest';
import { SheetDetents } from '../src/ui/SheetDetents';

const CONTAINER_PX = { heightPx: 800, topInsetPx: 0 };

describe('SheetDetents', () => {
  it('snaps a slow drag to the nearest height', () => {
    expect(SheetDetents.settle('half', 180, 0.1, CONTAINER_PX)).toBe('peek');
    expect(SheetDetents.settle('half', 420, 0.1, CONTAINER_PX)).toBe('half');
    expect(SheetDetents.settle('half', 700, 0.1, CONTAINER_PX)).toBe('full');
  });

  it('moves one step on a flick, and stops at the ends', () => {
    expect(SheetDetents.settle('peek', 200, 1.5, CONTAINER_PX)).toBe('half');
    expect(SheetDetents.settle('half', 380, -1.5, CONTAINER_PX)).toBe('peek');
    expect(SheetDetents.step('full', 1)).toBe('full');
  });

  it('keeps half tall enough on a short phone for the action row above Report, never above full', () => {
    // 640 px phone: 572 px over the nav bar, so half is 400 px, not 286.
    const phone = { heightPx: 572, topInsetPx: 0 };
    expect(SheetDetents.px('half', phone)).toBe(400);
    expect(SheetDetents.px('half', CONTAINER_PX)).toBe(400);
    expect(SheetDetents.px('half', { heightPx: 1000, topInsetPx: 0 })).toBe(500);
    expect(SheetDetents.px('half', { heightPx: 300, topInsetPx: 0 })).toBe(SheetDetents.px('full', { heightPx: 300, topInsetPx: 0 }));
    expect(SheetDetents.settle('half', 390, 0.1, phone)).toBe('half');
    expect(SheetDetents.css('half')).toBe('min(max(50%, 400px), calc(100% - 80px - env(safe-area-inset-top)))');
  });

  it('cycles peek, half, full and back on tap', () => {
    expect(SheetDetents.cycle('peek')).toBe('half');
    expect(SheetDetents.cycle('half')).toBe('full');
    expect(SheetDetents.cycle('full')).toBe('peek');
  });
});
