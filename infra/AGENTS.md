# infra: AWS and Kubernetes

JunkSnap runs on one Amazon EKS Auto Mode cluster, `junksnap`, in `ap-south-1`. Two stages share it: `dev` (namespace `junksnap-dev`, stack `junksnap-dev`) for building and `demo` (namespace and stack `junksnap-demo`) for the recording.

## Layout

- `aws/stage.yaml`: one CloudFormation template with a `Stage` parameter. It holds the per-stage AWS resources: private originals bucket (KMS), public blurred bucket, DynamoDB tables (on demand), SQS queue plus dead-letter queue, an Amazon Location resource, the Secrets Manager placeholders and the stage's EKS Pod Identity roles.
- `eks/`: the eksctl config for the cluster (Auto Mode, ap-south-1).
- `k8s/base/`: Kustomize base for the workloads. `k8s/overlays/dev/` and `k8s/overlays/demo/` set the namespace, image tags and stage config.

## Workloads

| Workload | Package | Kind | Exposed |
|---|---|---|---|
| `api` | `pipeline` | Deployment, FastAPI | public routes through the ALB |
| `agent` | `agent` | Deployment, FastAPI | public `POST /sites/{id}/letters`; other routes cluster-internal |
| `worker` | `pipeline` | Deployment | none; long-polls SQS and calls `agent` over HTTP |
| `scores` | `pipeline` | CronJob | none |

CloudFront sits in front of the ALB for HTTPS. Amplify hosts the web app. Images live in ECR. Environment variable names come from `contracts/README.md`; values come from the stack outputs.

## Commands (dev only)

```
aws cloudformation validate-template --template-body file://infra/aws/stage.yaml --profile junksnap --region ap-south-1
aws cloudformation deploy --template-file infra/aws/stage.yaml --stack-name junksnap-dev --parameter-overrides Stage=dev --capabilities CAPABILITY_NAMED_IAM --profile junksnap --region ap-south-1
kubectl kustomize infra/k8s/overlays/dev
kubectl apply -k infra/k8s/overlays/dev
```

Render with `kubectl kustomize` and read the output before every apply.

## Conventions

- Tag every resource `project=junksnap` and `stage=<stage>`. Names start with `junksnap-<stage>`.
- Pods get AWS access only through EKS Pod Identity: one role per workload, least privilege. No access keys in pods, images, manifests or ConfigMaps.
- Secrets (OpenAI and OpenRouter keys) live in Secrets Manager. The human stores the values; templates only create the placeholder.
- Originals stay private under KMS. The blurred bucket is the only public image store.
- Only the `agent` letters route and the `api` public routes are reachable from outside the cluster.
- Every queue has a dead-letter queue. Failed reports end in a "needs review" status, never silently dropped.
- The demo deny rules in `.claude/settings.json` match any command text containing `junksnap-demo` or `overlays/demo` (also `overlays\demo`). So stage overlay files with `git add infra/`, and pass PR or commit text with `--body-file` or `-F`.

## Stop and ask before you

- create or delete the cluster, or add any paid resource (NAT gateways, extra node pools, provisioned capacity).
- change billing, budgets, account settings or Bedrock model access (human only).

## Never

- Deploy, apply or change anything in `demo`. The human deploys `demo` from a clean `main`. Agents are denied commands that mention it.
- Type or commit credentials, kubeconfig files or `.env` files.
- Leave resources running after judging: the human tears down both stacks and the cluster.
