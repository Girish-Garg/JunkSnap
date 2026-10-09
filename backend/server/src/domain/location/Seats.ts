export interface AreaRef {
  readonly id: string;
  readonly name: string;
}

// The boundary file's pc_id: the Lok Sabha seat this assembly seat belongs to.
export interface AssemblySeat extends AreaRef {
  readonly lokSabhaId: string;
}

// outdated: the shape predates a re-delimitation (Assam, Jammu and Kashmir, Ladakh); null: the MP is unknown.
export type LokSabhaStatus = "current" | "outdated" | null;

export interface LokSabhaSeat extends AreaRef {
  readonly state: string;
  readonly status: LokSabhaStatus;
}

// Assembly seats exist only where we have assembly polygons (Rajasthan).
export interface SeatMatch {
  readonly assembly: AssemblySeat | null;
  readonly lokSabha: LokSabhaSeat;
}

export type Office = "councillor" | "mla" | "mp";

export interface Representative {
  readonly office: Office;
  readonly seat_id: string;
  readonly as_of: string;
  readonly source: string;
}
