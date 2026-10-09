// site.schema.json report_type, in legend order.
export const REPORT_TYPES = [
  'waste_dump',
  'no_bin',
  'contaminated_water',
  'open_construction',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];
