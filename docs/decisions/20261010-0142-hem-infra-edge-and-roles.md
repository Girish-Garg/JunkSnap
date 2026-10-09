---
status: proposed
superseded_by:
area: infra
by: hem
date: 2026-10-10T01:42+05:30
---
# Stage edge, routing and Pod Identity roles as built by I1

Context: issue #10 built the per-stage stack, the Kustomize workloads and CloudFront for the server/ml split (api, worker, scores on `junksnap-server`; ml on `junksnap-ml`).

Decision:
- The ALB sends every public path to `api` and returns a fixed 404 for `/internal` and `/internal/*`; `ml` is never routed. CloudFront serves HTTPS only and forwards to the ALB over HTTP.
- Reverse geocoding uses Amazon Location Places v2 (`geo-places:ReverseGeocode`); no place index exists and `PLACE_INDEX` is dropped.
- The worker reaches ml at `ML_URL=http://ml` (replaces `AGENT_URL`; the contracts update renames it).
- `dev` allows any browser origin (S3 upload CORS `*`, empty `CORS_ORIGINS`); `demo` lists its origins.
- Roles: `ml` reads only the public bucket and `embeddings/` in the private one; Bedrock and the two secrets are one managed policy shared by api, worker and ml.
- `worker` runs 0 replicas until its SQS poller lands (issue #11).
- Accounts: Cognito pool `junksnap-<stage>-users` (Lite tier, Cognito's sender, deletion protection outside dev); its ids reach pods as `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID`.

Consequences for other lanes: code reads the env vars in the `junksnap-config` ConfigMap; any new AWS call needs a grant in `infra/aws/stage.yaml`.

Rejected alternatives: a v1 place index (legacy API); limiting the ALB to the CloudFront prefix list now (security group rule quota; revisit).
