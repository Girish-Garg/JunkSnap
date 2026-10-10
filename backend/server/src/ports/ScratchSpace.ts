// Local temp files for one scan; the processor removes its directory when done.
export interface ScratchSpace {
  create(label: string): Promise<string>;
  read(path: string): Promise<Uint8Array>;
  remove(dir: string): Promise<void>;
}
