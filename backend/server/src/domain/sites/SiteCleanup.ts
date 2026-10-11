import { CLEANED_QUORUM, Clearance, type ClearanceView } from "./Clearance.js";
import { AlreadyCleanedError, CleanupPendingError, InvalidTransitionError } from "./SiteErrors.js";
import type { CleanupConfirmation, SiteInternals, SiteProperties } from "./SiteTypes.js";
import type { VoteTally } from "./VoteTally.js";

export interface SiteParts {
  readonly props: SiteProperties;
  readonly internals: SiteInternals;
}

// An after-photo the models passed: its blurred copy and its uploader's cleared word.
export interface AfterPhoto extends CleanupConfirmation {
  readonly cleanupId: string;
  readonly photoUrl: string;
}

// Sites already off the active map take no cleared words.
const SETTLED: ReadonlySet<string> = new Set(["cleaned", "removed", "expired"]);
const NO_CLEARANCE: ClearanceView = { count: 0, needed: CLEANED_QUORUM, still_there: 0 };

// The cleanup half of a site's lifecycle (decision 20261010-1855): one after-photo is one person's word; 3 people clear it.
export class SiteCleanup {
  readonly #parts: SiteParts;

  constructor(parts: SiteParts) {
    this.#parts = parts;
  }

  awaits(cleanupId: string): boolean {
    const { props, internals } = this.#parts;
    return props.cleanup_status === "checking" && internals.pendingCleanupId === cleanupId;
  }

  start(cleanupId: string): SiteParts {
    const { props, internals } = this.#parts;
    if (props.status === "cleaned") {
      throw new AlreadyCleanedError("This site is already marked cleared");
    }
    if (this.awaits(cleanupId)) {
      return this.#parts;
    }
    if (props.cleanup_status === "checking") {
      throw new CleanupPendingError("An after-photo for this site is still being checked");
    }
    return { props: { ...props, cleanup_status: "checking" }, internals: { ...internals, pendingCleanupId: cleanupId } };
  }

  // The photo counts once for its uploader (a second photo replaces the first); the site waits for others to agree.
  accept(photo: AfterPhoto, tally: VoteTally): SiteParts {
    this.#assertAwaits(photo.cleanupId);
    const { props, internals } = this.#parts;
    const others = internals.cleanupPeople.filter((entry) => entry.person !== photo.person);
    const cleanupPeople = [...others, { person: photo.person, at: photo.at }];
    // Cleared votes may have settled the site while the photo was being checked.
    const cleanupStatus = props.status === "cleaned" ? "accepted" : "pending_confirmation";
    const pending: SiteParts = {
      props: { ...props, cleanup_status: cleanupStatus, cleanup_photo_url: photo.photoUrl },
      internals: { ...internals, cleanupPeople, pendingCleanupId: null },
    };
    return new SiteCleanup(pending).settle(tally);
  }

  // An earlier person's photo still counts, so the site stays pending rather than rejected.
  reject(cleanupId: string): SiteParts {
    this.#assertAwaits(cleanupId);
    const { props, internals } = this.#parts;
    const pending = props.status !== "cleaned" && (props.clearance?.count ?? 0) > 0 && internals.cleanupPeople.length > 0;
    const cleanupStatus = pending ? "pending_confirmation" : "rejected";
    return { props: { ...props, cleanup_status: cleanupStatus }, internals: { ...internals, pendingCleanupId: null } };
  }

  // Recounts the cleared words; the site is cleaned once enough different people say so.
  settle(tally: VoteTally): SiteParts {
    const { props, internals } = this.#parts;
    if (SETTLED.has(props.status)) {
      return this.#parts;
    }
    const clearance = Clearance.of(tally, internals.cleanupPeople, props.last_reported_at);
    const shown = clearance.count > 0 || props.clearance !== undefined ? { clearance: clearance.view() } : {};
    const at = clearance.clearedAt();
    if (at === null) {
      return { props: { ...props, ...shown, ...SiteCleanup.#idle(props, clearance.count) }, internals };
    }
    const cleanup_status = props.cleanup_status === "pending_confirmation" ? "accepted" : props.cleanup_status;
    const cleaned = { status: "cleaned", cleaned_at: at, cleaned_by: clearance.byPhoto() ? "after_photo" : "votes" } as const;
    return { props: { ...props, ...shown, ...cleaned, cleanup_status }, internals };
  }

  // Nobody's word counts any more (a newer report, or the uploader said still there): no longer pending.
  static #idle(props: SiteProperties, count: number): Partial<SiteProperties> {
    return count === 0 && props.cleanup_status === "pending_confirmation" ? { cleanup_status: "none" } : {};
  }

  // A photo the models passed means waste is back: a cleaned site reopens. A pending site keeps its words here;
  // the merger then recounts them with the votes (settle), so only words after the newest report still count.
  reopen(): SiteParts {
    const { props, internals } = this.#parts;
    if (props.status !== "cleaned") {
      return this.#parts;
    }
    const reset = props.clearance === undefined ? {} : { clearance: NO_CLEARANCE };
    // Cleared votes may have cleaned the site mid-check; that after-photo stays checking, so its result still lands.
    const checking = props.cleanup_status === "checking" && internals.pendingCleanupId !== null;
    return { props: { ...props, ...reset, status: "reopened", cleanup_status: checking ? "checking" : "none" }, internals };
  }

  #assertAwaits(cleanupId: string): void {
    if (!this.awaits(cleanupId)) {
      throw new InvalidTransitionError(`${this.#parts.props.site_id} is not waiting for ${cleanupId}`);
    }
  }
}
