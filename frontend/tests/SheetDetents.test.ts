import { describe, expect, it } from 'vitest';
import { SheetDetents } from '../src/ui/SheetDetents';

const CONTAINER_PX = 800;

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

  it('cycles peek, half, full and back on tap', () => {
    expect(SheetDetents.cycle('peek')).toBe('half');
    expect(SheetDetents.cycle('half')).toBe('full');
    expect(SheetDetents.cycle('full')).toBe('peek');
  });
});
