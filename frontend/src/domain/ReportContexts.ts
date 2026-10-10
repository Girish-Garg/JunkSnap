import type { ReportType } from './ReportType';
import type { SiteContext } from './Site';

// report_upload.schema.json allOf: the contexts each report type allows, in picker order.
export const REPORT_CONTEXTS: Readonly<Record<ReportType, readonly SiteContext[]>> = {
  waste_dump: ['vacant_plot', 'roadside', 'drain', 'other'],
  no_bin: ['no_bin', 'no_pickup'],
  contaminated_water: ['stagnant', 'sewage', 'foam', 'choked_drain'],
  open_construction: ['uncovered_debris', 'dusty_site'],
  overflowing_bin: ['overflowing', 'damaged'],
};
