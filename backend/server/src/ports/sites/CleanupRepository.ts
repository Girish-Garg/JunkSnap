import type { CleanupFinish, CleanupRecord } from "../../domain/sites/Cleanup.js";

export interface CleanupRepository {
  get(cleanupId: string): Promise<CleanupRecord | null>;
  // Leaves an existing record with the same id untouched.
  create(record: CleanupRecord): Promise<void>;
  // Only moves a record that is still checking.
  finish(cleanupId: string, result: CleanupFinish): Promise<void>;
}
