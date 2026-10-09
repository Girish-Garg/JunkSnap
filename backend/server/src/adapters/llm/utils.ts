const MAX_REASON = 200;
const DATED_VERSION = /-(\d{8}-v\d+:\d+|v\d+:\d+)$/;
const NAMED_VERSION = /-(\d+)-(\d+)$/;

// Error name and message only: SDK and fetch errors never carry the prompt.
export function failureReason(error: unknown): string {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return text.slice(0, MAX_REASON);
}

// `...-20251001-v1:0` and `...-v1:0` keep their suffix; `...claude-sonnet-4-6` becomes 4.6.
export function bedrockVersion(model: string): string {
  const dated = DATED_VERSION.exec(model)?.[1];
  if (dated !== undefined) {
    return dated;
  }
  const named = NAMED_VERSION.exec(model);
  return named === null ? "unversioned" : `${named[1] ?? ""}.${named[2] ?? ""}`;
}
