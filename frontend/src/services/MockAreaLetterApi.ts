import { ApiError } from '../domain/ApiError';
import type { AreaLetterDraft, AreaLetterRequest } from '../domain/AreaLetter';
import type { AreaKind, AreaScores } from '../domain/AreaScores';
import type { AreaLetterApi } from './AreaLetterApi';

export interface MockAreaLetterSources {
  readonly scores: (kind: AreaKind, id: string) => Promise<AreaScores>;
  /** contracts/fixtures/area_letter_draft.jdh-1.json */
  readonly letter: () => Promise<AreaLetterDraft>;
}

// The api gives bin access for these issues only.
const BIN_ISSUES: ReadonlySet<string> = new Set(['waste_dump', 'no_bin', 'all']);

/** Mock mode: the fixture letter for any area with enough verified reports for the issue, as the api gates it. */
export class MockAreaLetterApi implements AreaLetterApi {
  readonly #sources: MockAreaLetterSources;

  constructor(sources: MockAreaLetterSources) {
    this.#sources = sources;
  }

  async letter(kind: AreaKind, id: string, request: AreaLetterRequest): Promise<AreaLetterDraft> {
    const scores = await this.#sources.scores(kind, id);
    const verified = request.issue === 'no_bin' ? scores.counts.no_bin_reports : scores.counts.verified_reports;
    if (verified < scores.min_verified_reports) {
      const message = `Not enough verified reports yet (${verified} of ${scores.min_verified_reports}) for this issue in this area.`;
      throw new ApiError(409, 'not_verified', message);
    }
    const sample = await this.#sources.letter();
    const evidence = { ...sample.evidence, bin_access: BIN_ISSUES.has(request.issue) ? sample.evidence.bin_access : null };
    return { ...sample, area: scores.area, issue: request.issue, language: request.language, evidence };
  }
}
