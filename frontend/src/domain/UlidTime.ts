// Crockford base32, as in the ULID spec; ids use it in lowercase (contracts/README.md, "Ids").
const ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
const ULID = /(?:rpt|cln)_([0-9a-hjkmnp-tv-z]{26})(?:\.jpg)?$/;
// Anything outside these years is not a real upload time, so it is not shown.
const EARLIEST = Date.UTC(2020, 0, 1);
const LATEST = Date.UTC(2100, 0, 1);

/**
 * When a report or cleanup id was made, read from the ULID in its public photo URL. The id comes from the
 * upload, so this is when the photo was reported, not when it was taken. Never guessed.
 */
export class UlidTime {
  static fromPhotoUrl(url: string): string | null {
    const match = ULID.exec(url.toLowerCase());
    const id = match?.[1];
    if (!id) return null;
    const millis = UlidTime.#decode(id.slice(0, 10));
    return millis >= EARLIEST && millis < LATEST ? new Date(millis).toISOString() : null;
  }

  static #decode(time: string): number {
    let value = 0;
    for (const char of time) value = value * 32 + ALPHABET.indexOf(char);
    return value;
  }
}
