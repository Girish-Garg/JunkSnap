---
status: accepted
superseded_by:
area: process
by: gir
date: 2026-10-10T00:32+05:30
---
# Strict OOP, layered packages and enforced size limits

Context: many agents write code in parallel; small, layered, typed classes keep their work readable and mergeable.

Decision: follow docs/working.md. Layers domain, ports, services, adapters, handlers; constructor injection; immutable value objects; extension by new classes. Limits: file 250 lines (.tsx 150), class 150, function 30, params 4, complexity 8, nesting 3; enforced by ruff, ESLint, mypy --strict and scripts/check_limits.py in CI.

Consequences: Wave 0 adds ruff.toml, check_limits.py and the CI jobs before feature work.

Rejected alternatives: no limits; limits by review only.
