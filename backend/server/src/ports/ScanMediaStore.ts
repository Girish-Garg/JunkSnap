export interface DownloadedVideo {
  readonly bytes: number;
  readonly sha256Hex: string;
}

// The private originals bucket; nothing here is ever public.
export interface ScanMediaStore {
  // Throws InvalidVideoError when nothing was uploaded under the key.
  downloadVideo(key: string, toPath: string): Promise<DownloadedVideo>;
  putOriginal(key: string, jpeg: Uint8Array, sha256Hex: string): Promise<void>;
}
