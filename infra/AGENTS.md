# Lane `infra`: AWS and infrastructure

Holder: see `.claude/roster.json`. The holder adds conventions here as the lane learns them. Keep it under about 60 lines.

- One template with a `Stage` parameter. Stacks are named `saboot-<stage>`: personal stages `hem`, `gir`, `har`, plus `demo`. The IaC tool (SAM or CDK) is a kickoff decision in `docs/decisions/`.
- Region `ap-south-1`. Tag everything `project=saboot`, `stage=<stage>`, `owner=<name>`.
- DynamoDB `saboot-<stage>-cases`, on demand. S3 `s3://saboot-data-<account-id>/<stage>/...`. One shared Bedrock Knowledge Base on S3 Vectors; choose S3 Vectors explicitly, because a deleted KB leaves an OpenSearch collection billing.
- Lambdas are served from Function URLs. The agent's has a 120-second timeout.
- Agents never deploy `demo`. The infra holder deploys it by hand from a clean `main` checkout.
- Never enable EMR pre-initialized capacity. Keep the $30 budget alarm. Tear everything down after submission.
