# infra: AWS and Kubernetes

JunkSnap runs on one Amazon EKS Auto Mode cluster, `junksnap`, in `ap-south-1`. Two stages share it: `dev` (namespace `junksnap-dev`, stack `junksnap-dev`) for building and `demo` (namespace and stack `junksnap-demo`) for the recording.

## Layout

- `aws/shared.yaml`: stack `junksnap-shared`, the ECR repositories `junksnap-server`, `junksnap-ml` and `junksnap-crawler`.
- `aws/stage.yaml`: one CloudFormation template with a `Stage` parameter. It holds the per-stage AWS resources: KMS key, private originals bucket (photos, scan videos, embeddings), public blurred bucket, DynamoDB tables (on demand, including `scans` and `users`), SQS queue plus dead-letter queue, the Cognito user pool and app client (email sign-in, no client secret), the Secrets Manager placeholders, the stage's EKS Pod Identity roles and CloudFront. Amazon Location Places v2 needs no resource; the worker role gets `geo-places:ReverseGeocode`.
- `eks/`: the eksctl config for the cluster (Auto Mode, ap-south-1).
- `k8s/base/`: Kustomize base for the workloads. `k8s/overlays/dev/` and `k8s/overlays/demo/` set the namespace and stage config; `deploy.py` writes `k8s/deploy/<stage>/` (gitignored) on top with the image tags and stack outputs.

## Workloads

| Workload | Image (code) | Kind | Exposed |
|---|---|---|---|
| `api` | `junksnap-server` (`backend/server`; default command `node dist/handlers/web.js`) | Deployment, Fastify | every public route through the ALB, letters included |
| `worker` | `junksnap-server` (command `node dist/handlers/worker.js`) | Deployment | none; long-polls SQS and calls `ml` over HTTP |
| `scores` | `junksnap-server` (command `node dist/handlers/scores.js`) | CronJob | none |
| `ml` | `junksnap-ml` (`backend/ml`) | Deployment, FastAPI | none; `POST /internal/verify` at `http://ml`, inside the cluster only |
| `crawler` | `junksnap-crawler` (`data/ward_crawler`) | CronJob, hourly | none; crawls queued and due districts from the `crawls` table into `crawl/` |

Decision 20261010-0159. CloudFront sits in front of the ALB for HTTPS. Amplify hosts the web app. Images live in ECR repositories `junksnap-server` and `junksnap-ml`. The `ml` role may read only `media/` in the public bucket and write only `embeddings/` in the private one. Environment variable names come from `contracts/README.md`; values come from the stack outputs.

## Commands (dev only)

```
uv run scripts/deploy.py dev --origins https://dev.<amplify-app-id>.amplifyapp.com,http://localhost:5173
uv run scripts/deploy_web.py dev     # Amplify app built from frontend/, no Git connection
uv run scripts/smoke_report.py <cloudfront-url>
aws cloudformation validate-template --template-body file://infra/aws/stage.yaml --profile junksnap --region ap-south-1
kubectl kustomize infra/k8s/overlays/dev
```

`deploy.py` deploys both stacks, pushes both images tagged with the git short SHA and `stage-<stage>` (never expired by ECR; the server image gets `data/` at `/app/data` through the named build context `data`), writes and applies `k8s/deploy/<stage>/`, and points CloudFront at the ALB. For `demo` it also turns on the stack's termination protection. `--origins` sets the browser origins for S3 uploads and API CORS; demo requires it. The ALB accepts traffic only from CloudFront's origin-facing prefix list.

Render with `kubectl kustomize` and read the output before every apply.

## Conventions

- Tag every resource `project=junksnap` and `stage=<stage>`. Names start with `junksnap-<stage>`.
- Pods get AWS access only through EKS Pod Identity: one role per workload, least privilege. No access keys in pods, images, manifests or ConfigMaps.
- Secrets (OpenAI and OpenRouter keys) live in Secrets Manager. The human stores the values; templates only create the placeholder.
- Originals stay private under KMS. The blurred bucket is the only public image store.
- Only the `api` public routes are reachable from outside the cluster (letters included); `ml` and `/internal/*` never are.
- Every queue has a dead-letter queue. Failed reports end in a "needs review" status, never silently dropped.
- The demo deny rules in `.claude/settings.json` match any command text containing `junksnap-demo` or `overlays/demo` (also `overlays\demo`). So stage overlay files with `git add infra/`, and pass PR or commit text with `--body-file` or `-F`.

## Stop and ask before you

- create or delete the cluster, or add any paid resource (NAT gateways, extra node pools, provisioned capacity).
- change billing, budgets, account settings or Bedrock model access (human only).

## Never

- Deploy, apply or change anything in `demo`. The human deploys `demo` from a clean `main`. Agents are denied commands that mention it.
- Type or commit credentials, kubeconfig files or `.env` files.
- Leave resources running after judging: the human tears down both stacks and the cluster. The KMS key, both buckets, every table and the user pool are `Retain`, so they outlive a deleted stack and are deleted by hand; in `demo` turn off the stack's termination protection and the tables' and user pool's deletion protection first.
