---
status: proposed
superseded_by:
area: infra
by: hem
date: 2026-10-10T01:30+05:30
---
# Services run on Kubernetes: one EKS Auto Mode cluster, four workloads

Context: Hemang asked for Kubernetes. Small separate services are easy to follow and scale. The handover planned Lambda Function URLs built with SAM or CDK.

Decision: one Amazon EKS Auto Mode cluster `junksnap` in ap-south-1, namespaces `junksnap-dev` and `junksnap-demo`. Workloads:
- `api`: package pipeline, FastAPI, every public route except letters.
- `agent`: package agent, FastAPI; public POST /sites/{id}/letters; cluster-internal POST /internal/verify and POST /internal/brands.
- `worker`: package pipeline, long-polls the SQS reports queue.
- `scores`: CronJob every 15 minutes.
CloudFront in front of the ALB for HTTPS. Images in ECR. EKS Pod Identity for AWS access. Per-stage AWS resources from CloudFormation `infra/aws/stage.yaml`; the cluster from eksctl `infra/eks/cluster.yaml`; manifests with Kustomize in `infra/k8s/` (base, overlays/dev, overlays/demo).

Consequences for other lanes: handlers become FastAPI routers, the queue consumer and the CronJob command. I1 builds this stack. Cost: about $7/day from credits while the cluster runs; tear it down after judging.

Rejected alternatives: Lambda Function URLs with SAM or CDK (the earlier plan).
