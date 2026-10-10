// 0 to 1; 0.5 for a device or user never seen before.
export interface ReputationReader {
  ofDevice(deviceToken: string): Promise<number>;
  ofUser(userId: string): Promise<number>;
}
