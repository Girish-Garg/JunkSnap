# Lane `agent`: complaint agent and legal corpus

Holder: see `.claude/roster.json`. The holder adds conventions here as the lane learns them. Keep it under about 60 lines.

- Strands Agents, pinned in this lane's own package (not the public Lambda layer). Set `model_id` and `region_name` explicitly; the SDK default points at another region.
- Tools: `get_site_evidence`, `search_rules` (wraps Bedrock Knowledge Base `Retrieve`), `lookup_authority` (static JSON), `save_draft`. Structured output: `{draft_text, citations[{doc, rule, page, quote}], authority, evidence_refs}`.
- Rules are data, not prompt text: a hand-checked rules JSON (rule number, exact text, page, situation tags). Code picks the clauses and the addressees; the model writes the prose around them.
- The verifier checks that every quoted string appears word for word in the hashed e-Gazette text. Keep a template-based draft as a fallback.
- Cite as: Solid Waste Management Rules, 2026, S.O. 388(E) dated 27.01.2026, in force 01.04.2026. Environmental compensation is rule 17; rule 21 is accident reporting. Quote no rupee amounts under the 2026 Rules.
- Hash every uploaded photo and fetched artifact with SHA-256 at the moment of capture.
- Served from a Lambda Function URL with a 120-second timeout (API Gateway cuts off at 29 seconds).
- Tests stub Bedrock. Live model calls are manual checks and the smoke test only.
- Every Python lane needs `ruff` and `pytest` as dev dependencies and at least one test, or CI fails.
