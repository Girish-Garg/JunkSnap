/** MapLibre 6 needs WebGL2; some browsers (hardware acceleration off, old devices) lack it. */
export class MapSupport {
  static hasWebGl2(doc: Document = document): boolean {
    try {
      return Boolean(doc.createElement('canvas').getContext('webgl2'));
    } catch {
      return false;
    }
  }
}
