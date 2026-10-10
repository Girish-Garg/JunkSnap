import type { ModerationEvidence, UploadEvidence, VerificationEvidence } from '../domain/ReportEvidence';

/** One report's evidence as GET /reports/{id} returns it: what was sent, moderation and verification. */
export interface ReportEvidenceSet {
  readonly report: UploadEvidence;
  readonly moderation: ModerationEvidence;
  readonly verification: VerificationEvidence;
}

export type ReportEvidenceLoader = () => Promise<ReportEvidenceSet>;

/** The fixtures behind mock mode's GET /reports/{id} (contracts/README.md: built from jdh-1 and jpr-1). */
export interface ReportEvidenceLoaders {
  /** A snap that passed every check: report_upload, moderation_result and verification_result jdh-1. */
  readonly snap: ReportEvidenceLoader;
  /** A scan frame the models sent to neighbours: the jpr-1 set. */
  readonly frame: ReportEvidenceLoader;
}

export const reportEvidenceLoaders: ReportEvidenceLoaders = {
  snap: async () => ({
    report: (await import('../../../contracts/fixtures/report_upload.jdh-1.json')).default as unknown as UploadEvidence,
    moderation: (await import('../../../contracts/fixtures/moderation_result.jdh-1.json')).default as unknown as ModerationEvidence,
    verification: (await import('../../../contracts/fixtures/verification_result.jdh-1.json')).default as unknown as VerificationEvidence,
  }),
  frame: async () => ({
    report: (await import('../../../contracts/fixtures/report_upload.jpr-1.json')).default as unknown as UploadEvidence,
    moderation: (await import('../../../contracts/fixtures/moderation_result.jpr-1.json')).default as unknown as ModerationEvidence,
    verification: (await import('../../../contracts/fixtures/verification_result.jpr-1.json')).default as unknown as VerificationEvidence,
  }),
};
