import type { SiteRules } from '../config/SiteRules';

/** The numbers the copy names, as i18next variables every string can use; a call's own params still win. */
export type CopyValues = Readonly<Record<string, number>>;

const METRES_PER_KM = 1000;

/**
 * The config's site rules as the copy says them: {{voteKm}}, {{flagKm}} and {{zoneKm}} in kilometres,
 * {{cleanupM}} in metres and {{minReports}} verified reports, so a changed VITE_ variable changes the words too.
 */
export class CopyNumbers {
  static of(rules: SiteRules): CopyValues {
    return {
      voteKm: rules.voteRadiusM / METRES_PER_KM,
      flagKm: rules.flagRadiusM / METRES_PER_KM,
      zoneKm: rules.zoneRadiusM / METRES_PER_KM,
      cleanupM: rules.cleanupRadiusM,
      minReports: rules.minVerifiedReports,
    };
  }
}
