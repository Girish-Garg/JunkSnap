import type { MessageHandler } from "./MessageHandler.js";

// Handles `kind: scan` messages; the scans task implements it and parses its own body.
export type ScanProcessor = MessageHandler;
