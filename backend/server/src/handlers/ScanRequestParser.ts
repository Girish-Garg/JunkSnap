import type { IncomingHttpHeaders } from "node:http";
import { z } from "zod";
import { validateScanSession, type ScanSession } from "../contracts/scanSessionPending.js";
import { ValidationError } from "../domain/errors.js";
import type { ScanPresignRequest } from "../services/ScanUploadPresigner.js";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// The scan presign body is inline in contracts/README.md, so it has no generated validator.
const PresignBody = z.strictObject({
  content_type: z.enum(["video/webm", "video/mp4"]),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  size_bytes: z.number().int().min(1),
  duration_ms: z.number().int().min(1),
  device_token: z.string().regex(UUID_V4),
});

export class ScanRequestParser {
  presign(body: unknown): ScanPresignRequest {
    const result = PresignBody.safeParse(body);
    if (!result.success) {
      throw new ValidationError(z.prettifyError(result.error));
    }
    return result.data;
  }

  // TODO(#34): set user_id from the verified token; a user_id in the body is never trusted.
  session(body: unknown): ScanSession {
    const session = { ...validateScanSession(body) };
    delete session.user_id;
    return session;
  }

  deviceToken(headers: IncomingHttpHeaders): string | undefined {
    const value = headers["x-device-token"];
    return typeof value === "string" ? value : undefined;
  }
}
