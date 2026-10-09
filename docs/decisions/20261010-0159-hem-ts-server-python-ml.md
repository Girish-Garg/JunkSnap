---
status: accepted
superseded_by:
area: process
by: hem
date: 2026-10-10T01:59+05:30
---
# Only the ML service is Python; everything else is one TypeScript server

Context: two Python packages split the backend by topic. Confirmed in chat on 10 Oct: keep Python only where the ML libraries are.

Decision:
- `backend/ml/`: Python, FastAPI service `ml`, one cluster-internal route `POST /internal/verify`: stacked verification (Rekognition labels, YOLO, embeddings, type classifier, meta-learner, the vision judge as the last step) and insights. Training and dataset tooling live in `backend/ml/training/`.
- `backend/server/`: TypeScript on Node 24, one project and one image (`junksnap-server`) running three workloads, each from its own entry file: `api` (`web.ts`; every public route, including `POST /sites/{id}/letters`), `worker` (`worker.ts`; SQS pipeline: moderation and blur, authenticity, calls `ml` to verify, brand labels, location, site merge) and `scores` (`scores.ts`; CronJob).
- TypeScript is 6.0.3 in `backend/server` and `frontend`, not 7: typescript-eslint 8.71 supports only `typescript <6.1`, and TS 7 has no JS compiler API for type-aware lint.
- Data tooling scripts (ward crawler, rule checks) may stay Python.
- `backend/agent` is being renamed to `backend/ml` by another PR. `backend/pipeline` is retired and is deleted once the TS server lands.

Consequences for other lanes: replaces the workload and package mapping in 20261010-0130 (EKS, namespaces and Kustomize still stand), the `agent` steps in 20261010-0131 and the letters routing in 20261010-0115. `/internal/brands` is gone; brands run in the worker. Workloads: `api`, `worker`, `ml`, `scores`; images `junksnap-server` and `junksnap-ml`.

Rejected alternatives: all Python (the original split); all TypeScript (no good YOLO and training stack).
