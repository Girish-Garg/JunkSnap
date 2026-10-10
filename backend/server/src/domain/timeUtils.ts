// ISO 8601 UTC without milliseconds, as every contract time is written.
export function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
