// The JSON the LLM returns for the brand judge, one verdict per case.
export interface JudgeAnswerVerdict {
  readonly case_id: string;
  readonly brand: string | null;
  readonly confidence: number;
  readonly text_seen: string;
}

export interface JudgeAnswer {
  readonly verdicts: readonly JudgeAnswerVerdict[];
}
