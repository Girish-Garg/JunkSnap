export interface DeviceReputation {
  // 0 to 1; an unknown device has 0.5.
  reputationOf(deviceToken: string): Promise<number>;
}
