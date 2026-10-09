export interface ImageFacts {
  readonly format: string;
  readonly width: number;
  readonly height: number;
}

// Every method throws InvalidImageError when the bytes do not decode.
export interface ImageCodec {
  describe(bytes: Uint8Array): Promise<ImageFacts>;
  // Fully decodes and auto-orients, then returns side x side grayscale pixels, row-major.
  grayscale(bytes: Uint8Array, side: number): Promise<Uint8Array>;
  // An auto-oriented JPEG without metadata of at most maxBytes, at full size when that fits.
  uprightBelow(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array>;
}
