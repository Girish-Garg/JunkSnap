export interface VideoUpload {
  readonly key: string;
  readonly contentType: string;
  readonly sha256Hex: string;
  readonly sizeBytes: number;
}

export interface SignedUpload {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

// A private PUT URL that accepts exactly the declared bytes.
export interface ScanUploadSigner {
  sign(upload: VideoUpload): Promise<SignedUpload>;
}
