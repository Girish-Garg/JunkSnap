// Snap photos received after `since` (ISO time); scan frames never count.
export interface SnapCounter {
  byDevice(deviceToken: string, since: string): Promise<number>;
  byUser(userId: string, since: string): Promise<number>;
}
