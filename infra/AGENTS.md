# infra: AWS and Kubernetes

JunkSnap runs on one Amazon EKS Auto Mode cluster, `junksnap`, in `ap-south-1`. Two stages share it: `dev` (namespace `junksnap-dev`, stack `junksnap-dev`) for building and `demo` (namespace and stack `junksnap-demo`) for the recording.

## Layout

- `aws/shared.yaml`: stack `junksnap-shared`, the ECR repositories `junksnap-server` and `junksnap-ml`.
- `aws/stage.yaml`: one CloudFormation template with a `Stage` parameter. It holds the per-stage AWS resources: KMS key, private originals bucket, public blurred bucket, DynamoDB tables (on demand), SQS queue plus dead-letter queue, the Secrets Manager placeholders, the Cognito user pool, the stage's EKS Pod Identity roles and CloudFront.
- `eks/`: the eksctl config for the cluster (Auto Mode, ap-south-1).
- `k8s/base/`: Kustomize base for the workloads. `k8s/overlays/dev/` and `k8s/overlays/demo/` set the namespace and stage config; `deploy.py` writes `k8s/deploy/<stage>/` (gitignored) on top with the image tags and stack outputs.

## Workloads

| Workload | Image | Kind | Exposed |
|---|---|---|---|
| `api` | `junksnap-server` (TypeScript) | Deployment | every public route through the ALB, letters included |
| `worker` | `junksnap-server` | Deployment | none; long-polls SQS and calls `ml` over HTTP |
| `scores` | `junksnap-server` | CronJob | none |
| `ml` | `junksnap-ml` (Python) | Deployment | none; `POST /internal/verify` at `http://ml` |

CloudFront sits in front of the ALB for HTTPS. Amplify hosts the web app. Images live in ECR. Environment variable names come from `contracts/README.md`; values come from the stack outputs.

## Commands (dev only)

```
uv run scripts/deploy.py dev
aws cloudformation validate-template --template-body file://infra/aws/stage.yaml --profile junksnap --region ap-south-1
kubectl kustomize infra/k8s/overlays/dev
```

`deploy.py` deploys both stacks, pushes both images tagged with the git short SHA and `stage-<stage>` (never expired by ECR), writes and applies `k8s/deploy/<stage>/`, and points CloudFront at the ALB. `--origins` sets the browser origins for S3 uploads and API CORS; demo requires it. The ALB accepts traffic only from CloudFront's origin-facing prefix list.

Render with `kubectl kustomize` and read the output before every apply.

## Conventions

- Tag every resource `project=junksnap` and `stage=<stage>`. Names start with `junksnap-<stage>`.
- Pods get AWS access only through EKS Pod Identity: one role per workload, least privilege. No access keys in pods, images, manifests or ConfigMaps.
- Secrets (OpenAI and OpenRouter keys) live in Secrets Manager. The human stores the values; templates only create the placeholder.
- Originals stay private under KMS. The blurred bucket is the only public image store.
- Only `api` is routed publicly (letters included); `ml` and `/internal/*` never are.
- Every queue has a dead-letter queue. Failed reports end in a "needs review" status, never silently dropped.
- The demo deny rules in `.claude/settings.json` match any command text containing `junksnap-demo` or `overlays/demo` (also `overlays\demo`). So stage overlay files with `git add infra/`, and pass PR or commit text with `--body-file` or `-F`.

## Stop and ask before you

- create or delete the cluster, or add any paid resource (NAT gateways, extra node pools, provisioned capacity).
- change billing, budgets, account settings or Bedrock model access (human only).

## Never

- Deploy, apply or change anything in `demo`. The human deploys `demo` from a clean `main`. Agents are denied commands that mention it.
- Type or commit credentials, kubeconfig files or `.env` files.
- Leave resources running after judging: the human tears down both stacks and the cluster.
