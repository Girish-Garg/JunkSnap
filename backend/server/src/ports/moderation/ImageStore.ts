// Originals live in the private bucket; blurred copies go to the public one.
export interface ImageStore {
  // Null when the object is larger than maxBytes; a presigned PUT has no size cap, so never download those.
  readOriginal(key: string, maxBytes: number): Promise<Uint8Array | null>;
  writePublic(key: string, jpeg: Uint8Array): Promise<void>;
}
