/** MapLibre 6 needs WebGL2; some browsers (hardware acceleration off, old devices) lack it. */
export class MapSupport {
  static hasWebGl2(doc: Document = document): boolean {
    try {
      const gl = doc.createElement('canvas').getContext('webgl2');
      // Browsers cap live WebGL contexts, so release the probe at once.
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
      return Boolean(gl);
    } catch {
      return false;
    }
  }
}
