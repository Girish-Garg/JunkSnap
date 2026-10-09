export interface UploadSignRequest {
  readonly key: string;
  readonly contentType: string;
  readonly checksumBase64: string;
  readonly expiresInSeconds: number;
}

// Signs a PUT to the private originals bucket that S3 accepts only with these exact headers and bytes.
export interface UploadSigner {
  sign(request: UploadSignRequest): Promise<string>;
}
