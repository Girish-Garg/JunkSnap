// One ward city file on local disk: city is the file name without .json, path is absolute.
export interface WardFile {
  readonly city: string;
  readonly path: string;
}

// Lists the ward city files to read, at most one per city.
export interface WardFileSource {
  files(): Promise<readonly WardFile[]>;
}
