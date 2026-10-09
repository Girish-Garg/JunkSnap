import { ValidationError } from "./errors.js";

const HEX = /^[0-9a-f]{64}$/;

export class Sha256Digest {
  readonly hex: string;

  private constructor(hex: string) {
    this.hex = hex;
  }

  static fromHex(hex: string): Sha256Digest {
    if (!HEX.test(hex)) {
      throw new ValidationError("sha256 must be 64 lowercase hex characters");
    }
    return new Sha256Digest(hex);
  }

  // S3 wants base64 of the raw digest bytes, never base64 of the hex text.
  base64(): string {
    return Buffer.from(this.hex, "hex").toString("base64");
  }
}
