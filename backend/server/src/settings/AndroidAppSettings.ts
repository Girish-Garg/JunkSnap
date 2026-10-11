import { z } from "zod";
import { parseEnv, splitList, type Env } from "./utils.js";

// The Android app's package id (applicationId in apps/android-tauri/src-tauri/gen/android/app/build.gradle.kts).
export const ANDROID_PACKAGE = "com.junksnap.app";

// One SHA-256 certificate fingerprint as assetlinks.json and `keytool -list` write it: 32 hex bytes joined by colons.
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

// Accepts upper or lower case, with or without colons; anything but exactly 64 hex digits stays as given and fails FINGERPRINT.
function colonHex(value: string): string {
  const hex = value.replace(/:/g, "").toUpperCase();
  if (!/^[0-9A-F]{64}$/.test(hex)) return value;
  return hex.match(/../g)?.join(":") ?? hex;
}

const AndroidEnv = z.object({
  ANDROID_CERT_SHA256: z
    .string()
    .optional()
    .transform((value) => splitList(value ?? "").map(colonHex))
    .pipe(z.array(z.string().regex(FINGERPRINT, "a SHA-256 certificate fingerprint, AA:BB:...:FF"))),
  ANDROID_HANDOFF_WAIT_MS: z.coerce.number().int().min(0).max(30_000).default(2_000),
});

// The Android app (contracts/README.md): the package the share pages open, and the signing certificates that
// /.well-known/assetlinks.json vouches for. No fingerprint, no assetlinks (404), and app links stay unverified.
export class AndroidAppSettings {
  readonly packageName = ANDROID_PACKAGE;
  readonly certFingerprints: readonly string[];
  // How long a share page waits for the app to open before it sends an Android browser to the web app.
  readonly handoffWaitMs: number;

  private constructor(certFingerprints: readonly string[], handoffWaitMs: number) {
    this.certFingerprints = certFingerprints;
    this.handoffWaitMs = handoffWaitMs;
  }

  static fromEnv(env: Env): AndroidAppSettings {
    const values = parseEnv(AndroidEnv, env);
    return new AndroidAppSettings(values.ANDROID_CERT_SHA256, values.ANDROID_HANDOFF_WAIT_MS);
  }
}
