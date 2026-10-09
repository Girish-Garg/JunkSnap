# backend/pipeline: moderation, authenticity, location, sites, scores

Python package `pipeline`, laid out per docs/working.md: `src/pipeline/{domain,ports,adapters,services,handlers}/`, tests in `tests/unit` and `tests/contract`.

- Moderation: Rekognition moderation gate; blur faces and number plates before any public copy; the original stays private (KMS). No photos of people dumping.
- Authenticity: inside-India check, fresh timestamp, perceptual-hash duplicate check, per-device token and rate limit, reporter reputation.
- Location: Amazon Location reverse geocoding plus point-in-polygon for assembly and Lok Sabha seats; wards only where open ward maps exist. Representatives carry an as-of date and a source; no party field.
- Sites: merge verified reports within ~40 m of the same type (plus embedding similarity when available); lifecycle open -> cleaned (ML-checked after-photo only) -> reopened.
- Scores: city, citizen and bin-access per area, formulas versioned in docs/decisions; at least 10 verified reports before a score shows; counts always returned; pilot flag; never invented history.
- Output shapes come from contracts/; never import backend/agent.
- Tests stub every AWS call; adapter integration tests run only with RUN_AWS_TESTS=1.
