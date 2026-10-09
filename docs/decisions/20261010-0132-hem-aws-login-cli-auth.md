---
status: proposed
superseded_by:
area: infra
by: hem
date: 2026-10-10T01:32+05:30
---
# CLI auth with `aws login`, not an IAM user access key

Context: the handover asked the human to create an IAM user and a long-lived CLI access key.

Decision: the human runs `aws login --profile junksnap`. It is a root session; short-lived credentials refresh automatically, and nothing is saved as a long-lived key. Agents never run billing or account commands.

Consequences for other lanes: handover section 3 and AGENTS.md change. There is no access key to delete after judging.

Rejected alternatives: an IAM user with an access key (a long-lived secret on disk). Revisit: an IAM user can use `aws login` too.
