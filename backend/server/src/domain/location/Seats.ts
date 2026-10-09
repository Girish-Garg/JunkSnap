export interface AreaRef {
  readonly id: string;
  readonly name: string;
}

// An outdated shape predates its state's re-delimitation (Assam, Jammu and Kashmir, Ladakh).
export type LokSabhaStatus = "current" | "outdated";

export interface LokSabhaSeat extends AreaRef {
  readonly status: LokSabhaStatus;
}

// Assembly seats exist only where we have assembly polygons (Rajasthan).
export interface SeatMatch {
  readonly assembly: AreaRef | null;
  readonly lokSabha: LokSabhaSeat;
}

export type Office = "councillor" | "mla" | "mp";

export interface Representative {
  readonly office: Office;
  readonly seat_id: string;
  readonly as_of: string;
  readonly source: string;
}
