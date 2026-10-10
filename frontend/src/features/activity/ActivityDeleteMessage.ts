import type { RemovalOutcome } from '../../domain/ActivityRemoval';

/** The toast after an Activity delete; a verified site that stays is always said plainly. */
export class ActivityDeleteMessage {
  static of(outcome: RemovalOutcome): string {
    if (outcome.verifiedKept) return 'activityDelete.verifiedKept';
    if (outcome.sitesRemoved > 0) return 'activityDelete.siteRemoved';
    return outcome.kind === 'withdraw' ? 'activityDelete.withdrawn' : 'activityDelete.done';
  }
}
