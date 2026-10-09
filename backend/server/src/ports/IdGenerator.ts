export interface IdGenerator {
  // A lowercase ULID, the suffix of every contract id.
  next(): string;
}
