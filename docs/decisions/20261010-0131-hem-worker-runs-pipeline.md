---
status: proposed
superseded_by:
area: infra
by: hem
date: 2026-10-10T01:31+05:30
---
# The worker runs the report pipeline from SQS; no Step Functions

Context: services now run on Kubernetes (20261010-0130-hem-kubernetes-eks-stack.md). Handover decision 6 ran the pipeline in Step Functions Express behind SQS.

Decision: the `worker` reads the SQS reports queue and runs one `ReportPipeline` service per message. It runs the steps in order (docs/architecture.md section 3), with the signals in parallel threads. Agent steps go through the `agent` service's POST /internal/verify and POST /internal/brands. A failed message is retried through SQS; after the last retry it goes to the dead-letter queue and the report gets status "needs review".

Consequences for other lanes: this replaces only the orchestration part of handover decision 6; the stacked verification design stays. I1 builds no Step Functions state machine.

Rejected alternatives: Step Functions Express behind SQS.
