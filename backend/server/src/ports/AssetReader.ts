// Paths are relative to the assets root and use forward slashes, e.g. "boundaries/india_outline.geojson".
export interface AssetReader {
  readBytes(path: string): Promise<Uint8Array>;
  readText(path: string): Promise<string>;
  readJson(path: string): Promise<unknown>;
}
