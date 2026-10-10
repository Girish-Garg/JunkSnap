// A local gate in the shape of fe-124's action-availability model (ActionAvailability, SITE_GATES), which is
// not on main yet; once it lands, this becomes SITE_GATES.addPhoto and these rules move into GateRules.

/** signIn: the reason goes away after sign-in, so a tap opens it and then runs the action. */
export type AddPhotoAvailability =
  | { readonly enabled: true }
  | { readonly enabled: false; readonly reason: string; readonly params?: Readonly<Record<string, number>>; readonly remedy?: 'signIn' };

export interface AddPhotoFacts {
  readonly signedIn: boolean;
  /** The site is off the map (cleared, withdrawn, expired, rejected) and takes no new photo. */
  readonly closed: boolean;
  /** Metres between the person's last known location and the site; null when the app does not know. */
  readonly distanceM: number | null;
  /** How far from the site a photo can still join it (SitePhotoPreset.limitM). */
  readonly limitM: number;
}

// The map's fix is older and rougher than the photo's own, so only clearly too far blocks; Send checks the photo's fix.
export const ADD_PHOTO_MARGIN_M = 100;

/** Whether "Add a photo" works now, and why not: closed first, then too far, then sign-in (which a tap can fix). */
export class AddPhotoGate {
  static decide(facts: AddPhotoFacts): AddPhotoAvailability {
    if (facts.closed) return { enabled: false, reason: 'addPhoto.closed' };
    if (facts.distanceM !== null && facts.distanceM > facts.limitM + ADD_PHOTO_MARGIN_M) {
      return { enabled: false, reason: 'addPhoto.tooFar', params: { limit: facts.limitM } };
    }
    if (!facts.signedIn) return { enabled: false, reason: 'addPhoto.signIn', remedy: 'signIn' };
    return { enabled: true };
  }
}
