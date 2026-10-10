import { createHash } from "node:crypto";

// One-way and the same for site notes and report notes, so a person's notes count once; never shown or logged.
export function authorHash(personId: string): string {
  return createHash("sha256").update(`junksnap-note-author:${personId}`).digest("hex");
}
