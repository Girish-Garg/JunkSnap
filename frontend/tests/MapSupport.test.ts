import { describe, expect, it, vi } from 'vitest';
import { MapSupport } from '../src/features/map/MapSupport';

const docWith = (getContext: () => unknown) =>
  ({ createElement: () => ({ getContext }) }) as unknown as Document;

describe('MapSupport', () => {
  it('reports WebGL2 and releases the probe context', () => {
    const loseContext = vi.fn();
    const doc = docWith(() => ({ getExtension: () => ({ loseContext }) }));
    expect(MapSupport.hasWebGl2(doc)).toBe(true);
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it('reports no WebGL2 when the browser returns no context', () => {
    expect(MapSupport.hasWebGl2(docWith(() => null))).toBe(false);
  });

  it('reports no WebGL2 when probing throws', () => {
    const doc = docWith(() => {
      throw new Error('Canvas blocked');
    });
    expect(MapSupport.hasWebGl2(doc)).toBe(false);
  });
});
