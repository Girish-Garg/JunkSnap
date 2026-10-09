---
status: proposed
superseded_by:
area: infra
by: hem
date: 2026-10-10T01:31+05:30
---
# The worker runs the report pipeline from SQS; no Step Functions

Context: services now run on Kubernetes (20261010-0130-hem-kubernetes-eks-stack.md). Handover decision 6 ran the pipeline in Step Functions Express behind SQS.

Decision:
- The `worker` reads the SQS reports queue and runs one `ReportPipeline` service per message: the steps in order (docs/architecture.md section 3), with the signals in parallel threads. Agent steps go through the `agent` service's POST /internal/verify and POST /internal/brands.
- A failed message is retried through SQS. When its `ApproximateReceiveCount` reaches the max receive count, the worker itself marks the report `needs_review` before the message moves to the dead-letter queue, so the phone never waits forever.
- Every step is idempotent per report id. Moderation and verification results are written keyed by report id. Site merge records which report ids it has merged and skips repeats, so retries cannot inflate counts.

Consequences for other lanes: this replaces only the orchestration part of handover decision 6; the stacked verification design stays. I1 builds no Step Functions state machine.

Rejected alternatives: Step Functions Express behind SQS.
