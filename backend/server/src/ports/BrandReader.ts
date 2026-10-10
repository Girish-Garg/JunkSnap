import type { BrandLabel } from "../contracts/index.gen.js";

export interface BrandReadRequest {
  readonly reportId: string;
  readonly blurredKey: string;
}

// Brands task: labels readable at confidence 0.8 or more, empty otherwise.
export interface BrandReader {
  read(request: BrandReadRequest): Promise<BrandLabel[]>;
}
