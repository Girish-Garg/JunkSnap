# Saboot: AWS Architecture Review and 3.5-Day Build Plan (Environmental Hacks, Oct 8-11, 2026)

Scope note: researched on 2026-10-08 (day 1 of the event). Region preference: ap-south-1 (Mumbai). This review aims for a reliable recorded demo, not production scale. Team: Hemang, Girish, Harshit (from the synopsis PDF at C:\Users\gargg\Downloads\Saboot_Synopsis-1.pdf).

## Q0. Event rules that change the plan (judging, demo format, big-data requirement)

### Takeaway
The event page sets no Spark or data-lake requirement, and judges see a recorded demo video of up to 3 minutes, not a live demo. The "Big data concepts" line is the team's own pitch choice. Prize eligibility only needs at least one AWS open-source tool or a deployment on AWS. Strands Agents (open source) on a deployed AWS stack meets both.

### Cited Findings
- Environmental Hacks is Event 02 of the Bharat Builds Tour (WeMakeDevs with AWS). It runs online Oct 8-11, 2026, with an optional in-person build day at DTU Delhi on Sat Oct 10, 8 AM-8 PM. Teams have 1-4 people. Track 3 is "Waste and Energy". — [WeMakeDevs event page](https://www.wemakedevs.org/aws/env)
- Prize eligibility: the project must "either use at least one AWS open-source tool or be deployed on AWS". The page does not mention big data, Spark, or data-lake requirements. — [WeMakeDevs event page](https://www.wemakedevs.org/aws/env)
- The five judging criteria are Idea and Impact, Built on AWS, Design and usability ("Can someone outside the team use it?"), Execution ("Does it work?"), and Demo video. The video is recorded, up to three minutes, and shows what the project does, who it is for, and where AWS fits. There is no live demo. — [WeMakeDevs event page](https://www.wemakedevs.org/aws/env)
- Locally built projects and AWS-deployed projects are scored "with the same care", and each track is judged separately. — [WeMakeDevs event page](https://www.wemakedevs.org/aws/env)
- Schedule: Thu Oct 8 kickoff, Fri Oct 9 build day, Sat Oct 10 optional DTU day, Sun Oct 11 submission deadline (a demo video is required). The page says the exact hours, including the deadline, "are being finalised". — [WeMakeDevs schedule](https://www.wemakedevs.org/aws/env/schedule)
- Top-5 blogs win a prize, and blogs must be published on AWS Builder Center. Track winners get ₹2,00,000 plus $2,000 in AWS credits. Top-10 students skip screening for Amazon interviews. — [WeMakeDevs event page](https://www.wemakedevs.org/aws/env)
- Strands Agents is an open-source AI agents SDK released by AWS. — [AWS Open Source Blog: Introducing Strands Agents](https://aws.amazon.com/it/blogs/opensource/introducing-strands-agents-an-open-source-ai-agents-sdk/); [strandsagents.com blog](https://strandsagents.com/blog/introducing-strands-agents/)

### Inferences
- The judges score usability, a working product, and the video. EMR Serverless, Spark, and Athena score no points by themselves. They support the "Built on AWS" story only if the video can show them in 10-20 seconds. Spend time first on the pin → evidence → cited draft loop and on video polish.
- With no live demo, "fallback stubs" exist mainly to make recording reliable and to keep the deployed URL working if a judge opens it. Cached responses are legitimate as long as the video shows real outputs the system produced.
- The deadline hour is unknown. Plan to submit by about 15:00 IST on Sunday and check Discord on day 1 for the cutoff.

### Gaps
- The exact submission cutoff time and the contents of /aws/env/rules (repo or deployed-URL requirements) were not retrievable.
- I could not confirm that the "Build It / Ship It" service lists name specific services such as Bedrock or EMR.

## Q1. Overall verdict: is the planned stack buildable in about 3.5 days by 3 people?

### Takeaway
Not as written. The plan has about 12 managed services, two separate vector or search systems (OpenSearch for lookalikes and OpenSearch hybrid for rules), an EMR Serverless pipeline, and live raster processing in Lambda. That is 2-3x what a 3-person team can make reliable by Sunday. A trimmed version keeps every judge-visible feature: Amplify + Lambda + Strands on Bedrock + Bedrock Knowledge Base on S3 Vectors + S3 Vectors or numpy for lookalikes + pre-rendered Sentinel-2 chips + one small Spark job (Glue or EMR Serverless) writing partitioned Parquet that Athena queries + DynamoDB.

### Cited Findings
- OpenSearch Serverless Classic has a cost floor: about $175/month for a dev/test (non-redundant) collection and about $350/month for a redundant one, at roughly $0.24 per OCU-hour. Vector collections need their own dedicated OCUs. — [cloudburn.io OpenSearch pricing](https://cloudburn.io/blog/amazon-opensearch-pricing); [AWS Big Data Blog](https://aws.amazon.com/blogs/big-data/amazon-opensearch-serverless-cost-effective-search-capabilities-at-any-scale)
- Bedrock Knowledge Bases with S3 Vectors support semantic search but not hybrid search. — [AWS S3 docs: Using S3 Vectors with Bedrock KB](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-bedrock-kb.html)
- An API Gateway integration times out at 29 seconds by default and returns HTTP 504. Regional and private REST APIs can raise this through a Service Quotas request. — [AWS re:Post knowledge center](https://repost.aws/knowledge-center/api-gateway-timeout-limit)

### Inferences
- The biggest schedule risks, in order: (1) Bedrock model access or quota from ap-south-1 on a new or free-plan account; (2) packaging geospatial Python (rasterio/GDAL) for Lambda and the cross-region COG latency; (3) first-time EMR Serverless IAM, application, and dependency setup; (4) running two search systems; (5) Hindi PDF rendering (see Q6); (6) agent calls longer than 29 s behind API Gateway.
- The biggest cost risk is idle infrastructure that keeps billing (OpenSearch Serverless Classic, OpenSearch domains, EMR pre-initialized capacity, NAT gateways if Lambda goes into a VPC), not LLM tokens.

#### Recommended simplifications (planned → recommended)

| Layer | Planned | Recommended for demo reliability | Judge-visible value kept? |
|---|---|---|---|
| Web | React + MapLibre on Amplify | Same. Optionally use an Amazon Location Service basemap for an extra AWS logo. | Yes |
| API | API Gateway + Lambda | Lambda Function URLs (or HTTP API) for short calls. The agent/draft endpoint runs on a Function URL with a 60-120 s Lambda timeout, or async (POST returns a case_id, the client polls DynamoDB). | Yes |
| Imagery | Sentinel-2 read live from S3 | An offline script pre-renders RGB chips (about 8-12 dates per demo site) into your own S3 bucket. An optional live chip Lambda can be added later. | Yes. The history timeline looks identical. |
| Fires | NASA FIRMS | FIRMS area API (live, needs a MAP_KEY) plus a FIRMS archive for Jodhpur stored as Parquet in the lake | Yes |
| Lookalikes | OpenSearch vector search | Amazon S3 Vectors index (GA, Mumbai, near-zero idle cost), or numpy brute force in Lambda. Precompute hotspot GeoJSON for the demo seed sites. | Yes |
| Rule retrieval | OpenSearch hybrid (BM25 + vectors) | Bedrock Knowledge Base on an S3 data source with an S3 Vectors store (managed chunking, Retrieve API). Optionally add in-Lambda BM25 (rank_bm25) and fuse it to keep the word "hybrid". | Yes. Citations come from the source URI and page metadata. |
| Batch | PySpark on EMR Serverless | One PySpark script, time-boxed to 4 h, run on AWS Glue (simplest IAM) or EMR Serverless. It filters the Earth Index embeddings and FIRMS archive to Jodhpur and writes Parquet partitioned by district and month. | Yes. Show it in a 10-s architecture beat. |
| Data lake | Parquet on S3 + Athena | Same. Register through the Glue Data Catalog and use 2-3 Athena queries in the UI (fires per month, top changed patches). | Yes |
| Agent | Strands + Bedrock | Same. Deploy on Lambda. AgentCore Runtime is a stretch goal only. | Yes |
| Storage | DynamoDB + S3 | Same | Yes |

### Gaps
- No public benchmark of build time for this exact stack. The effort estimates here are judgment based on the cited setup steps.

## Q2. Strands Agents SDK: version, maturity, tools/RAG, Bedrock config, deployment, examples

### Takeaway
Strands is mature: the Python SDK is 1.58.1 (Oct 6, 2026) and marked "Production/Stable". Bedrock is its default provider, and tools are plain Python functions with `@tool`. Deploy it as a Lambda function, using either the official Strands Lambda layer or your own bundled package. AgentCore Runtime is available in Mumbai, but it adds a new CLI and deployment path that is not worth the risk for a 3.5-day build. Set the model ID and region explicitly, because the default points at Claude Sonnet in us-west-2.

### Cited Findings
- On PyPI, `strands-agents` is at 1.58.1, released October 6, 2026, with development status "5 - Production/Stable" and Python >= 3.10. Extras include `otel`, `a2a`, `anthropic`, `litellm`, `ollama`, `openai` and others. — [PyPI strands-agents](https://pypi.org/project/strands-agents/)
- The PyPI page names Amazon Bedrock as the default model provider. It says the default needs AWS credentials and model access for "Claude 4 Sonnet" in us-west-2. One example uses `us.amazon.nova-pro-v1:0`. — [PyPI strands-agents](https://pypi.org/project/strands-agents/)
- The code now lives in the consolidated `strands-agents/harness-sdk` monorepo. Python v1.48.0 added a unified storage interface, among other changes. — [newreleases.io harness-sdk python/v1.48.0](https://newreleases.io/project/github/strands-agents/harness-sdk/release/python%2Fv1.48.0)
- Strands Agents 1.0 was announced as "production-ready multi-agent orchestration". — [AWS Open Source Blog: Strands Agents 1.0](https://aws.amazon.com/blogs/opensource/introducing-strands-agents-1-0-production-ready-multi-agent-orchestration-made-simple/)
- The official Lambda deployment guide covers the handler, an official Lambda layer, and a CDK example. Layer versions map to SDK releases (layer 2 = v1.40.0, layer 1 = v1.23.0) and support Python 3.10-3.13 on x86_64 and arm64. The Lambda example does not stream responses, and the docs recommend Fargate when streaming is needed. — [Strands docs: Deploy to AWS Lambda](https://strandsagents.com/docs/user-guide/deploy/deploy_to_aws_lambda/)
- The older 0.1.x guide's CDK sample uses Python 3.12 on ARM, a 30-second timeout, 128 MB of memory, and an IAM statement allowing Bedrock model invocation. — [Strands 0.1.x Lambda guide](https://strandsagents.com/0.1.x/user-guide/deploy/deploy_to_aws_lambda)
- AgentCore: Mumbai (ap-south-1) has control-plane and data-plane endpoints (`bedrock-agentcore.ap-south-1.amazonaws.com`). — [AWS General Reference: AgentCore endpoints](https://docs.aws.amazon.com/general/latest/gr/bedrock_agentcore.md). Direct code deployment for Runtime (Nov 2025) launched in 9 regions including Mumbai — [AWS What's New](https://aws.amazon.com/about-aws/whats-new/2025/11/amazon-bedrock-agentcore-runtime-code-deployment). A March 2026 Runtime feature listed 14 regions including Mumbai — [AWS What's New (DE)](https://aws.amazon.com/de/about-aws/whats-new/2026/03/bedrock-agentcore-runtime-shell-command/)
- The Strands docs say a new AgentCore CLI (`agentcore dev`, `agentcore deploy`, `agentcore invoke`) replaces the old starter toolkit, and that the old package should be uninstalled to avoid conflicts. — [Strands docs: Deploy to Bedrock AgentCore (Python)](https://strandsagents.com/docs/user-guide/deploy/deploy_to_bedrock_agentcore/python/index.md)
- RAG: the `strands_tools` package includes a `retrieve` tool for Bedrock Knowledge Bases. You configure it with a knowledge base ID (10 characters, from the console or `aws bedrock-agent list-knowledge-bases`) and a region in environment variables. — [CodeSignal lesson (secondary)](https://codesignal.com/learn/courses/putting-bedrock-models-to-action-with-strands-agents/lessons/integrating-knowledge-bases); [strands-agents-builder on PyPI](https://pypi.org/p/strands-agents-builder)
- Strands has citation types modeled on the Bedrock API, with character start/end locations and a source title. — [Strands API: strands.types.citations](https://strandsagents.com/docs/api/python/strands.types.citations/)
- AgentCore Gateway can also expose a Bedrock knowledge base as an MCP tool whose Retrieve returns passages with source references. — [AWS docs: KB through AgentCore Gateway](https://docs.aws.eu/es_es/bedrock/latest/userguide/kb-gateway-target.html)

### Inferences
- Recommended agent design: one Strands `Agent` with `BedrockModel(model_id=<profile ID>, region_name="ap-south-1", temperature≈0.2)` and four tools:
  1. `get_site_evidence(case_id)` reads DynamoDB and S3: dates, fire counts, chip URLs, lat/lon, nearest ward.
  2. `search_rules(query, lang)` is a custom `@tool` that calls `bedrock-agent-runtime.retrieve` and returns chunk text plus `s3_uri`, page, and rule or section labels. A custom tool gives tighter control over citation fields than the generic `retrieve` tool.
  3. `lookup_authority(lat, lon)` reads a static JSON table: Jodhpur municipal body or zone, Rajasthan State Pollution Control Board regional office, district collector, and the grievance portal.
  4. `save_draft(case_id, draft_json)`.
  Have the agent return structured JSON `{draft_text, citations:[{doc, section, page, quote}], authority, evidence_refs}` so the UI can show each cited rule beside the draft. That beside-the-draft display is the synopsis's core "What is new" claim.
- Deploy to Lambda with a pinned `strands-agents` version in your own zip or layer. The official layer maps to older SDK versions (v1.40.0), and I could not confirm the layer exists in ap-south-1. Use 512-1024 MB of memory and a 90-120 s timeout, behind a Function URL (no 29-s API Gateway cap) or an async pattern.
- Mention AgentCore Runtime in the pitch as the path to production. Deploy to it only if everything else is done by Saturday afternoon.

### Gaps
- I did not find an official example repo for an agent that drafts a legal or complaint document with citations. The `strands-agents/samples` GitHub org likely has RAG samples, but I did not verify the contents.
- I could not confirm whether the official Strands Lambda layer is published in ap-south-1. The region list was not retrieved because the docs page returned 404 on the .md path.
- The exact environment variable names for `strands_tools.retrieve` come from secondary sources. Check them against the tools repo README.

## Q3. Bedrock models from ap-south-1, best choice for formal Hindi drafting, and costs

### Takeaway
From Mumbai, use Claude through a cross-region inference profile. An `in.` geographic profile keeps inference inside India (ap-south-1 and ap-south-2), which makes a good "data stays in India" pitch point. A `global.` profile reaches the newest models. AWS sources disagree on which Claude versions each profile carries, so verify in the console on day 1. Claude Sonnet-class is the best Bedrock choice for formal Hindi complaint drafting. I found no Sarvam LLM on Bedrock. Token cost is negligible for a hackathon: a few cents per draft.

### Cited Findings
- AWS ML Blog, Sept 29, 2026: Claude Opus 5, Sonnet 5, and Haiku 4.5 are available to ap-south-1 and ap-south-2 callers through a geographic profile that "keeps inference within India". The profile IDs are `in.anthropic.claude-opus-5`, `in.anthropic.claude-sonnet-5`, and `in.anthropic.claude-haiku-4-5-20251001-v1:0`. Billing, quotas, CloudWatch, and CloudTrail all stay in the source region, and the post includes boto3 Converse and InvokeModel examples with `region_name="ap-south-1"`. — [AWS ML Blog: Claude in India via cross-region inference](https://aws.amazon.com/blogs/machine-learning/amazon-bedrock-expands-claude-model-availability-to-india-cross-region-inference/)
- An earlier AWS post made Claude available to Mumbai and Hyderabad callers through Global cross-region inference, e.g. `global.anthropic.claude-sonnet-4-6`. — [AWS ML Blog: Claude in India with Global CRIS](https://aws.amazon.com/blogs/machine-learning/access-anthropic-claude-models-in-india-on-amazon-bedrock-with-global-cross-region-inference)
- The current Bedrock "Regional availability by models" page lists Claude Haiku 5.5, Sonnet 5.5, and Opus 5.5 as reachable from ap-south-1 only through Global (no in-region or geo). Nova Lite, Pro, and Micro are reachable through a geographic profile, and Nova 2 Lite through Global. Titan Text Embeddings V2 and Titan Multimodal Embeddings G1 are available in-region in ap-south-1. — [AWS Bedrock docs: models by region](https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.html). (The blog's `in.` list of Sonnet 5 and Opus 5 and the docs' Global-only 5.5 family do not conflict outright, but they differ. Confirm in the console.)
- AWS says global routing saves about 10% on input and output token prices compared with geographic cross-region inference. — [AWS docs: Global cross-Region inference](https://docs.aws.amazon.com/bedrock/latest/userguide/global-cross-region-inference.html). Anthropic frames the same gap the other way, as a 10% premium for regional endpoints over global ones. — [Anthropic pricing docs](https://platform.claude.com/docs/en/about-claude/pricing)
- Anthropic first-party list prices per million tokens (input/output), cached 2026-10-06: Sonnet 5.5 $2/$10; Sonnet 5 $2/$10; Haiku 5.5 $0.10/$0.50 (prompts up to 100K tokens); Haiku 4.5 $1/$5; Opus 5.5 $4/$20. Claude on Bedrock "is partner-operated with separate pricing". — [Anthropic pricing docs](https://platform.claude.com/docs/en/about-claude/pricing); [Amazon Bedrock pricing](https://aws.amazon.com/bedrock/pricing/)
- Conflict: one third-party pricing summary says Sonnet 5 on Bedrock moved from a $2/$10 launch discount to $3/$15 after Aug 31, 2026. Anthropic's first-party list shows Sonnet 5 at $2/$10. Check the Bedrock pricing page for ap-south-1. — [cloudburn.io Bedrock pricing (secondary)](https://cloudburn.io/blog/amazon-bedrock-pricing); [Anthropic pricing docs](https://platform.claude.com/docs/en/about-claude/pricing)
- Sarvam: the only AWS listing found is an AWS Marketplace product for Sarvam's APIs (speech-to-text, text-to-speech, translation, transliteration, document parsing). It is not a Bedrock Marketplace LLM. — [AWS Marketplace: Sarvam](https://aws.amazon.com/marketplace/pp/prodview-7zok3fqtuzeqg). Sarvam's own docs list Hindi (hi-IN) for Saaras v3 STT and Sarvam Translate. — [Sarvam docs: models](https://docs.sarvam.ai/api-reference-docs/getting-started/models)

### Inferences
- Model choice: use Claude Sonnet 5.5 through `global.` if the console shows it, otherwise Sonnet 5 through `in.anthropic.claude-sonnet-5`, for the Hindi and English drafts. The `in.` profile supports a "complaint data never leaves India" line in the pitch. Use Haiku (5.5 or 4.5) for cheap side tasks such as classifying the photo caption, translating the UI, and summarizing evidence. Keep Nova Pro (geo) as a fallback in the model chain in case Anthropic access is delayed.
- On formal Hindi quality: I found no head-to-head benchmark among Claude, Nova, and Llama for legal-register Hindi on Bedrock. Choosing Claude rests on its general multilingual strength and should be checked by a native Hindi reader on the team. Ask the model for शुद्ध/औपचारिक Hindi in a complaint-letter format (सेवा में, विषय, महोदय/महोदया, नियम संदर्भ, संलग्नक) and keep rule numbers and English statute names as they are.
- Cost estimate: a draft uses about 8-10K input tokens (retrieved rule chunks, evidence, instructions) and about 1.5K output tokens. At $2/$10 per MTok that is about $0.03 per draft. Even at $3.30/$16.50 (geo premium on a $3/$15 base) it is about $0.06. Two hundred test drafts cost under $15, so LLM spend is not the budget risk.
- Model access: on day 1, do a 5-minute smoke test with boto3 `converse` from ap-south-1 using each candidate profile ID. Bedrock usage is also one of the free-plan credit-earning activities (see Q8).

### Gaps
- I could not retrieve exact Bedrock per-token prices for ap-south-1 (Bedrock pricing page tables did not render).
- I could not confirm whether new free-plan accounts need a Marketplace subscription or first-use form for Anthropic models, or whether the free plan blocks them.
- No Sarvam LLM on Bedrock (Marketplace or serverless) was confirmed.

## Q4. Retrieval for rules and tribunal orders: Bedrock Knowledge Bases vs self-managed OpenSearch hybrid

### Takeaway
Bedrock Knowledge Bases is much faster to build. You get managed parsing, chunking, and embedding from an S3 folder of PDFs. Retrieve returns chunks with source location, and RetrieveAndGenerate returns citations natively. With an S3 Vectors store, the knowledge base is cheap but semantic-only. Hybrid BM25 + vector search needs an OpenSearch store (Serverless or managed) or Aurora PostgreSQL. For a corpus of perhaps 5-30 documents, semantic retrieval with good chunking is enough. A small in-Lambda BM25 re-rank can keep the "hybrid" claim honest at low cost.

### Cited Findings
- Bedrock KB embedding models supported in ap-south-1: Titan Text Embeddings V2 (256/512/1024 dimensions, float or binary), Cohere Embed English v3, and Cohere Embed Multilingual v3 (1024 dimensions). Knowledge Bases accept inference profiles for parsing and generation, and Claude, Nova, and Llama 4 vision models can serve as parsers. — [AWS docs: KB supported models and regions](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base-supported.html)
- S3 Vectors used as a Bedrock KB store "supports semantic search but not hybrid search". Knowledge Bases allow up to 1 KB of custom metadata and 35 metadata keys per vector. — [AWS S3 docs: S3 Vectors with Bedrock KB](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-bedrock-kb.html)
- Hybrid search in Bedrock KB first worked with OpenSearch Serverless and OpenSearch Managed Clusters. In April 2025 it was extended to Aurora PostgreSQL and MongoDB Atlas (MongoDB only in us-west-2 and us-east-1). — [AWS What's New, Apr 2025](https://aws.amazon.com/about-aws/whats-new/2025/04/amazon-bedrock-knowledge-bases-hybrid-search-aurora-postgresql-mongo-db-atlas-vector-stores); [AWS ML Blog: KB hybrid search](https://aws.amazon.com/blogs/machine-learning/amazon-bedrock-knowledge-bases-now-supports-hybrid-search/)
- A Bedrock KB can point at an existing S3 vector index or create one with Quick Create. The integration is GA. — [AWS News Blog: S3 Vectors GA](https://aws.amazon.com/blogs/aws/amazon-s3-vectors-now-generally-available-with-increased-scale-and-performance)
- Cost trap: deleting a Bedrock Knowledge Base does not delete the OpenSearch Serverless collection it created, and that collection keeps billing. — [cloudburn.io OpenSearch pricing](https://cloudburn.io/blog/amazon-opensearch-pricing)

### Inferences
- Recommended setup: an S3 bucket `saboot-corpus/` holding the SWM Rules 2026 gazette PDF (English and Hindi versions if available), CPCB guidelines, and 5-15 NGT orders on open waste burning and dumpsites. The KB uses Cohere Embed Multilingual v3 (handles Hindi and English queries over mixed-language docs) or Titan V2, an S3 Vectors store, and hierarchical or semantic chunking. Attach metadata (`doc_title`, `rule_no`, `year`, `type=rule|order`) through `.metadata.json` sidecar files so the agent can cite "Rule X(y), SWM Rules 2026". Ingestion is a one-click sync.
- Citations: call Retrieve inside a Strands tool rather than RetrieveAndGenerate. This keeps the agent in charge of the draft while each returned chunk carries the S3 URI, page, and metadata the UI shows beside the draft. RetrieveAndGenerate gives native citations but bypasses the agent loop.
- To keep the word "hybrid", run `rank_bm25` over the same chunk texts (exported once to a JSON in S3), then fuse them with KB results using reciprocal rank fusion inside the tool. That is about 1-2 hours of work. Otherwise reword the synopsis to "semantic retrieval with metadata filters". Judges are unlikely to penalize either.
- Self-managed OpenSearch hybrid means creating the index mapping, an ingest pipeline with an embedding connector or your own embedding Lambda, a search pipeline for score normalization, and chunking code. That is roughly a full day for first-timers, with a standing cost. Not worth it here.
- Alternative for a tiny corpus: the SWM Rules plus a few orders fit easily in Claude's context window. Stuffing the full rules text into the prompt (with prompt caching) is a valid fallback if the KB misbehaves, but citations then depend on the model quoting accurately.

### Gaps
- I could not confirm whether the Bedrock KB console "Quick create" default vector store is now S3 Vectors, OpenSearch Serverless NextGen, or Classic. Choose S3 Vectors explicitly.
- I could not confirm whether Bedrock KB can use an OpenSearch Serverless NextGen collection (scale-to-zero) as its store for hybrid search.
- I did not verify Titan Text Embeddings V2's Hindi retrieval quality.

## Q5. Vector store for Earth Index embeddings: OpenSearch Serverless cost, t3.small domain, S3 Vectors, in-memory numpy/FAISS

### Takeaway
Jodhpur district is about 223,000 non-overlapping 320 m patches per annual snapshot. At 384 float32 values per patch that is about 343 MB, or about 171 MB as float16. Brute-force cosine search over that matrix in numpy takes tens of milliseconds, so OpenSearch is unnecessary. The AWS-native option is Amazon S3 Vectors. It has been GA since Dec 2, 2025, is available in Mumbai, supports up to 2 billion vectors per index and top-k up to 100, and costs almost nothing while idle. Avoid OpenSearch Serverless Classic, which costs $175-350/month. NextGen (GA May 28, 2026) scales to zero but has cold starts.

### Cited Findings
- Earth Index Embeddings (Earth Genome) on Source Cooperative: GeoParquet with columns `id` (uint64), `embedding` (float[384]), and `geometry` (Point WKB). The model is SoftCon (Zhu Lab). Files are named by MGRS/UTM tile plus a date range, e.g. `31TDF_2024-01-01_2025-01-01.parquet`. They are served from `data.source.coop/earthgenome/earthindexembeddings/` under CC BY 4.0, cover "the entire globe" from Sentinel-2 temporal mosaics, and have a 2024 folder. The page does not state the patch size. — [Source Cooperative: Earth Index Embeddings](https://source.coop/earthgenome/earthindexembeddings)
- Earth Genome's blog describes cells "on our MajorTom-based grid" as "320 square meter" patches. That most likely means 320 m × 320 m (32×32 Sentinel-2 10 m pixels), but the wording is ambiguous. It also confirms SoftCon, 384-length embeddings, and GeoParquet with IDs and centroids. — [Earth Genome blog: Embeddings for all](https://www.earthgenome.org/blog/embeddings-for-all)
- A 2026 survey table lists the Earth Index embeddings as DINOv2-S architecture, SoftCon training, CC-BY-4.0. — [arXiv 2601.13134: Earth Embeddings as Products](https://arxiv.org/pdf/2601.13134)
- S3 Vectors: GA since Dec 2, 2025, in 14 regions including Asia Pacific (Mumbai). Up to 2 billion vectors per index and 10,000 indexes per vector bucket. Top-k up to 100. Infrequent queries return in under 1 s and frequent ones in about 100 ms or less. Up to 1,000 PUT transactions per second for streaming writes. Cosine or Euclidean distance. Up to 50 metadata keys per vector. Pricing has three parts: PUTs (logical GB), storage, and queries (per API call plus $/TB on index size). — [AWS News Blog: S3 Vectors GA](https://aws.amazon.com/blogs/aws/amazon-s3-vectors-now-generally-available-with-increased-scale-and-performance)
- OpenSearch Serverless Classic: about $0.24 per OCU-hour (us-east-1), with a minimum of 1 OCU in dev/test (0.5 indexing + 0.5 search), about $175/month, and 2 OCUs redundant, about $350/month. Vector collections need dedicated OCUs, and a separate charge applies to GPU-accelerated index builds. — [cloudburn.io](https://cloudburn.io/blog/amazon-opensearch-pricing); [barkingiguana.com OSS cost floor](https://barkingiguana.com/writing/pop-quiz-opensearch-serverless-cost-floor/); [AWS Big Data Blog](https://aws.amazon.com/blogs/big-data/amazon-opensearch-serverless-cost-effective-search-capabilities-at-any-scale)
- OpenSearch Serverless NextGen went GA on May 28, 2026. Compute and storage are separated, and indexing and search both "scale to zero" when idle, so there are no compute charges then. It supports Search and Vector Search collection types and is offered in all regions with OpenSearch Serverless. Commentators note cold-start trade-offs. — [InfoQ, Jun 2026](https://infoq.com/news/2026/06/aws-opensearch-serverless/); [Classmethod, May 31 2026](https://dev.classmethod.jp/en/articles/20260531-amazon-opensearch-service-nxgn-ga/); [AWS vector search collections docs](https://docs.aws.eu/opensearch-service/latest/developerguide/serverless-vector-search.html)
- Managed OpenSearch t3.small: about $0.036/hour in US East per a 2026 third-party guide. — [Lucidity OpenSearch pricing 2026](https://lucidity.cloud/blog/aws-opensearch-pricing). The free tier of 750 hours/month of t2/t3.small.search plus 10 GB EBS is stated on AWS's China pricing page as applying only in the Beijing region. Third-party guides describe it as broadly available for 12 months. — [AWS China OpenSearch pricing](https://www.amazonaws.cn/en/opensearch-service/pricing/); [Instaclustr](https://www.instaclustr.com/education/opensearch/opensearch-pricing-for-two-managed-service-options/)

### Inferences
- Patch math: 22,850 km² ÷ (0.32 km × 0.32 km = 0.1024 km²) ≈ 223,000 patches per year. Storage is 223k × 384 × 4 B ≈ 343 MB (float32), ≈ 171 MB (float16), or ≈ 86 MB (int8 quantized). One MGRS tile (about 110 × 110 km) holds about 118k patches, so Jodhpur district (about 71.8-73.9°E, which crosses UTM zones 42 and 43) probably needs about 4-6 tiles per year. That is roughly 0.5-1 GB of Parquet per year, small enough for a laptop or DuckDB.
- Lambda feasibility: a float16 matrix of about 171 MB loads from S3 in a few seconds at cold start. One query's brute-force cosine search is about 86M multiply-adds, roughly 10-50 ms in numpy. This fits comfortably in a 2-3 GB Lambda. FAISS is unnecessary at this scale; `IndexFlatIP` is mathematically the same as the numpy approach.
- Recommendation: (a) Precompute the top-200 lookalikes for each demo seed site in the Spark job and store them as GeoJSON. This gives the hotspot map with zero latency risk in the video. (b) For arbitrary user pins, load the Jodhpur vectors into an S3 Vectors index (`put_vectors` in batches; 384-dim, cosine; metadata `lat`, `lon`, `year`, `mgrs`) and query with `query_vectors(topK=100)`. For more than 100 results, page by seeding from several nearby patches. (c) Keep the numpy Lambda as a fallback.
- Do not put a managed OpenSearch domain on the critical path. It requires domain provisioning (often 15-30 min), access policies, and possibly a VPC with a NAT gateway, plus about $0.86/day of billing that continues after the event.

### Gaps
- The exact Earth Index patch size, grid overlap, and India coverage or years (2024 confirmed; 2025 unknown) were not confirmed. Download one Jodhpur tile in the first 2 hours to verify.
- I could not confirm which S3 bucket and region back `data.source.coop`. I believe it is us-west-2, but this is unverified. The answer affects transfer speed only, since the data is public.
- No S3 Vectors per-GB or per-query rates for ap-south-1 were retrieved. Third-party figures conflict ($0.06/GB vs $0.025/GB storage).

## Q6. Geospatial on Lambda: rasterio/GDAL packaging, TiTiler, COG latency, pre-rendering

### Takeaway
Pre-render Sentinel-2 chips offline and serve them from your own S3 bucket. The COGs sit in us-west-2, so live reads from a Mumbai Lambda add cross-Pacific round trips per range request. GDAL packaging and cold starts add risk with no visible payoff in a recorded video. If a live "any pin" history is wanted, deploy a small chip Lambda (rasterio in a container image) in us-west-2, next to the data.

### Cited Findings
- The Sentinel-2 L2A COGs are in public buckets in us-west-2: `sentinel-cogs`, and Collection 1 in `e84-earth-search-sentinel-data`. You search them through Element 84's Earth Search STAC API (`https://earth-search.aws.element84.com/v1`, collection `sentinel-2-l2a`). Anonymous access works (`--no-sign-request`, `AWS_NO_SIGN_REQUEST=true`). Coverage is global since December 2018, and new scenes arrive within hours. — [AWS Registry of Open Data: Sentinel-2 COGs](https://registry.opendata.aws/sentinel-2-l2a-cogs/); [Element84/earth-search](https://github.com/Element84/earth-search); [AWS Marketplace listing](https://aws.amazon.com/marketplace/pp/prodview-ykj5gyumkzlme)
- TiTiler is a FastAPI dynamic tile server built on rasterio/GDAL that serves COGs, STAC, and MosaicJSON. The repo includes CDK deployment examples for Lambda and ECS. — [developmentseed/titiler README](https://github.com/developmentseed/titiler/blob/0.4.0a2/README.md). TiTiler docs say `GDAL_DISABLE_READDIR_ON_OPEN` is "critical" for limiting the number of GDAL requests made when opening datasets. — [DEV: building a COG tile server with TiTiler](https://dev.to/mierune/building-a-dynamic-tile-server-using-cloud-optimized-geotiffcog-with-titiler-alg)
- A rasterio-on-Lambda case study reading a COG: about 868 ms on average when the file was reopened on every call, and about 74 ms on warm containers once the open handle was hoisted out of the handler (100-request sample, same-region data). — [Addresscloud: Serverless flood queries](https://blog.addresscloud.com/serverless-flood/)
- titiler-cmr recommends reading S3 directly from Lambda with an IAM role so rasterio/GDAL can find credentials. — [titiler-cmr docs](https://developmentseed.org/titiler-cmr/dev/)

### Inferences
- Pre-render plan, about 3-4 h for one person. On a laptop or in a us-west-2 Lambda: `pystac-client` search with bbox = site ± 1 km and `eo:cloud_cover < 10`, one scene per quarter for 2019-2026. Then `rio-tiler` or `rasterio` reads a window of B04, B03, B02 (or the visual TCI asset) at 10 m, does a percentile stretch, and writes a 512×512 PNG with a date label. Upload to `s3://saboot-media/chips/{site_id}/{date}.png` and write a manifest JSON. Ten demo sites × 12 dates gives about 120 PNGs.
- Optional live chip Lambda: a container image (python:3.12 base plus `pip install rasterio rio-tiler pystac-client`; the rasterio wheels bundle GDAL) in us-west-2, with a Function URL. Set `GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR` and `AWS_NO_SIGN_REQUEST=YES`, and give it 1-2 GB of memory. Expect 1-5 s per chip cold. Call it asynchronously and cache results to S3. Keep it off the critical path.
- Change signal: compute a simple per-date "bare-soil or brightness index" over the patch (NDVI drop plus a high-SWIR brightness proxy) and show it as a sparkline. It looks good in the video and is cheap.
- Use TiTiler only if you want interactive map tiles of full scenes. Pre-rendered chips and a time slider tell the evidence story better and with less risk.
- Hindi PDF trap: ReportLab does not shape Devanagari conjuncts and matras correctly. fpdf2 needs text shaping (uharfbuzz) turned on and a Devanagari font such as Noto Sans Devanagari. The lowest-risk path is to render the complaint as HTML in React with a print stylesheet and use the browser's "Save as PDF", or headless Chromium if server-side generation is needed. Store the final PDF or HTML in S3. This is engineering judgment, not from a retrieved source. Test it on day 1.

### Gaps
- No measured latency for reading us-west-2 COGs from ap-south-1 Lambda.
- I did not confirm whether the open-data egress from `sentinel-cogs` to another region is free to the requester. The bucket is anonymous-readable, which suggests it is not requester-pays, but this is unverified.
- I did not retrieve titiler-lambda's current packaging guidance or cold-start numbers.

## Q7. EMR Serverless vs Glue vs Athena Spark vs DuckDB/CTAS, and the leanest credible "big data" story

### Takeaway
For one district (under 1 GB of embeddings plus a FIRMS CSV), Spark is technically unnecessary. DuckDB or Athena CTAS would do it in minutes. The event does not require Spark. If the team wants to keep "distributed batch processing plus a partitioned data lake" in the pitch, the leanest credible version is one PySpark script run as an AWS Glue job. It needs no application to create, has a 1-minute minimum billing, and costs about $0.44/DPU-hour, so pennies per run. It writes Parquet partitioned by `district=/month=` that is registered in the Glue Data Catalog and queried by Athena. The same script can run on EMR Serverless if a teammate already knows it. Time-box it to about 4 hours and cut it first if behind.

### Cited Findings
- EMR Serverless pricing is per vCPU-hour, GB-hour, and extra storage, with a 1-minute minimum rounded up to the second. The worked example (us-east-1) uses $0.052624/vCPU-hour and $0.0057785/GB-hour. Each worker includes 20 GB of ephemeral storage. — [AWS EMR pricing](https://aws.amazon.com/emr/pricing/)
- EMR Serverless Python dependencies: use `spark.submit.pyFiles` for small files, or build a virtualenv on Amazon Linux matching the EMR Python version, upload it to S3, and pass it through `spark.archives`. EMR 6.12.0+ can use pandas, NumPy, and PyArrow directly. — [AWS docs: Python libraries with EMR Serverless](https://docs.aws.amazon.com/emr/latest/EMR-Serverless-UserGuide/using-python-libraries.html)
- Pre-initialized capacity lets jobs start in seconds, but warm workers bill while idle until the application stops (15-minute idle default). AWS recommends on-demand capacity for most batch work. — [AWS docs: pre-initialized capacity](https://docs.aws.amazon.com/emr/latest/EMR-Serverless-UserGuide/pre-init-capacity.html); [AWS Big Data Blog: EMR Serverless best practices](https://aws.amazon.com/blogs/big-data/top-10-best-practices-for-amazon-emr-serverless)
- A re:Post user saw `select 1+2` take at least 45 s on EMR Serverless even with pre-initialized capacity (single report). — [re:Post](https://www.repost.aws/ko/questions/QUx3BscxbTQ86a1ZcNsJ4JHw/what-is-the-shortest-emr-serverless-warmup-time-via-api)
- AWS Glue Spark jobs (Glue 2.0+) cost $0.44/DPU-hour, and Flex costs $0.29. Billing is per second with a 1-minute minimum. A Spark job needs at least 2 DPUs, and 1 DPU = 4 vCPU and 16 GB. — [AWS Glue pricing](https://aws.amazon.com/glue/pricing). A third-party source says Glue 6.0 went GA Aug 21, 2026 at $0.308/DPU-hour in us-east-1 (unverified). — [cloudburn.io Glue pricing](https://cloudburn.io/blog/aws-glue-pricing)
- Athena for Apache Spark is available in Asia Pacific (Mumbai). Spark 3.5 runs through SageMaker Unified Studio notebooks rather than the in-console notebook, and its Calculation APIs are unsupported. PySpark engine v3 does not support Lake Formation or partition-projection tables. — [AWS What's New 2023](https://aws.amazon.com/about-aws/whats-new/2023/03/amazon-athena-apache-spark-4-regions); [Athena Spark considerations](https://docs.aws.amazon.com/athena/latest/ug/notebooks-spark-considerations-and-limitations.html)

### Inferences
- Setup time estimate for first-timers:
  - EMR Serverless: about 2-4 h. That covers a job runtime IAM role with S3 and Glue Catalog access plus a trust policy, the application, the script and possibly a virtualenv build, debugging Spark UI logs in S3, and first-run cold starts of about 1-3 min.
  - Glue job: about 1-2 h. The console creates the role, the script is edited in Glue Studio, and catalog integration is built in.
  - Athena CTAS with partitioned Parquet: about 30-60 min, but it is not Spark.
- Cost for one district is trivial on any option: under $1 per run. The risk is time, not money. Never enable EMR pre-initialized capacity.
- Pure-Spark design (no geo libraries, so no dependency packaging):
  1. Read the Earth Index GeoParquet for the Jodhpur MGRS tiles, decoding WKB points with a tiny UDF or using the centroid columns if present.
  2. Filter by the district bounding box, then by a pre-computed list of district H3 cells or an exact polygon test done in a pandas UDF.
  3. Write `s3://saboot-lake/embeddings/district=jodhpur/year=2024/` as Parquet.
  4. Read the FIRMS archive CSV for Rajasthan, filter to Jodhpur, and write `s3://saboot-lake/fires/district=jodhpur/month=YYYY-MM/`.
  5. Compute per-patch fire counts and join them to the embeddings, which makes a "fire-prone lookalikes" feature.
  6. Output top-k lookalikes for the seed sites as GeoJSON.
  7. Optionally write vectors to S3 Vectors from the driver.
- Athena queries to show in the UI or video: "fires per month in Jodhpur 2019-2026", "patches with ≥N fire detections", and "top lookalikes of site X with fire history". Partition pruning by `district` and `month` is the concept to name on screen.
- Pitch line to keep: "The same Spark job runs unchanged for every district in India. It is partitioned by district and month." That is true as long as the script is parameterized by a district list.

### Gaps
- No official EMR Serverless or Glue rates for ap-south-1 were retrieved, only us-east-1 examples.
- I could not confirm whether the AWS free plan restricts EMR Serverless or Glue. It restricts "certain high-consumption services" without naming them in the sources found.

## Q8. Other cheap judge-visible AWS add-ons, Kiro, credits, and budget alarm

### Takeaway
Each of these is worth at most about 1-2 hours. The best value-for-time add-ons are Amazon Polly to read the Hindi draft aloud (the bilingual Kajal voice), an Amazon Location Service basemap (works with MapLibre), and an EventBridge schedule for FIRMS polling. Amazon Transcribe Hindi voice input is a stretch goal. Kiro is free to start and worth using for specs and naming in the pitch. Credits are thin: up to $200 from the AWS free plan plus $25 per team from WeMakeDevs. On day 1, set an AWS Budget with email alerts at small amounts.

### Cited Findings
- Amazon Polly added Kajal in July 2022 as a bilingual neural voice for Hindi and Indian English that can switch languages within a sentence. — [AWS What's New: Polly Hindi NTTS](https://aws.amazon.com/about-aws/whats-new/2022/07/amazon-polly-neural-tts-support-hindi-indian-english/). Kajal was added to the generative engine in February 2025. — [Polly document history](https://docs.aws.amazon.com/polly/latest/dg/doc-history.html). An older unofficial re:Post answer reports synchronous SynthesizeSpeech failing for Kajal, with an async S3 task suggested as a workaround. — [re:Post](https://repost.aws/zh-Hans/questions/QU7pKHSnBvTnuRAWPzoIIfjw/%E5%A6%82%E4%BD%95%E8%A7%A3%E5%86%B3%E9%80%9A%E8%BF%87-amazon-polly-api-action-synthesize-speech%E4%B8%8D%E8%83%BD%E4%BD%BF%E7%94%A8-kajal%EF%BC%9F)
- Amazon Transcribe added Hindi streaming in Nov 2022. The listed streaming regions then did not include an Indian region. Batch Hindi has existed since 2019. — [AWS What's New: Transcribe Hindi streaming](https://aws.amazon.com/about-aws/whats-new/2022/11/amazon-transcribe-thai-hindi-streaming-audio)
- Amazon Location Service recommends MapLibre GL JS for rendering and says it is compatible with Location's map styles and tiles. A geocoder plugin (`amazon-location-for-maplibre-gl-geocoder`) also exists. — [AWS docs: MapLibre with Amazon Location](https://docs.aws.amazon.com/location/latest/developerguide/dev-maplibre.html)
- Kiro was announced July 14, 2025 and reached GA May 7, 2026 (directory listing). The free plan has 50 credits/month, Pro is $20/month for 1,000 credits, and extra credits cost $0.04 (third-party sources, with some conflicting figures). — [tooldirectory.ai Kiro](https://tooldirectory.ai/tools/kiro); [usagebar Kiro pricing](https://usagebar.com/blog/kiro-pricing-and-free-tier)
- Credits for this event: new AWS accounts get up to $200 in free-tier credits from AWS, not from the organizers. WeMakeDevs gives $25 more per team through a form the team leader submits "after the free credits are used". — [WeMakeDevs event page](https://www.wemakedevs.org/aws/env)
- AWS free plan: $100 at signup plus up to $100 for five activities at $20 each: launch EC2, configure RDS, build a Lambda function, use Amazon Bedrock, and set up an AWS Budget. — [AWS Japan blog: Free Tier update](https://aws.amazon.com/jp/blogs/news/aws-free-tier-update-new-customers-can-get-started-and-explore-aws-with-up-to-200-in-credits/). The free plan restricts "certain high-consumption services" and limits Marketplace purchases. Upgrading lifts the block and keeps remaining credits. Free-plan accounts are "ineligible for other promo credits", and the account closes if it is not upgraded within 90 days. — [Neowin](https://www.neowin.net/news/aws-free-tier-overhauled-new-users-get-200-in-credits-but-theres-a-catch/)
- AWS Budgets: monitoring and notifications are free. The first two action-enabled budgets are free, and each additional one costs $0.10/day. Each budget supports up to 5 alerts, and each alert can go to 10 email subscribers or an SNS topic. Forecast alerts need about 5 weeks of usage history. — [AWS Budgets pricing](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing); [AWS Budgets FAQ](https://aws.amazon.com/aws-cost-management/aws-budgets/faqs/)
- NASA FIRMS: the area API (CSV by bbox, day range, and sensor, including VIIRS S-NPP, NOAA-20, and NOAA-21) needs a free MAP_KEY. The limit is 5,000 transactions per 10-minute interval per key, and multi-day requests may count as several. For large historical pulls, NASA recommends the archive download request over the API. — [NASA FIRMS 2025 Q&A](https://appliedsciences.nasa.gov/sites/default/files/2025-05/Part%203%20FIRMS%202025%20Q%26A%20Session.docx.pdf); [Microsoft FIRMS connector docs](https://learn.microsoft.com/en-us/connectors/nasafirms); [Earthdata forum](https://forum.earthdata.nasa.gov/viewtopic.php?p=23833)

### Inferences
- Credit-plan implication: the $25 WeMakeDevs credit is a promo credit, and free-plan accounts cannot take promo credits. To redeem it, the team account will probably need to upgrade to the paid plan, which keeps the remaining free credits. Consider upgrading on day 1 if any service, such as Bedrock Anthropic models or EMR, is blocked on the free plan.
- Budget alarm setup (10 min on day 1, which also earns $20 in credit):
  1. Billing → Budgets → Create a cost budget, monthly, $30.
  2. Add alerts on ACTUAL cost at $5, $15, $25, and $30, emailed to all three teammates.
  3. Add a second budget scoped by tag `project=saboot`, or by service (OpenSearch, EMR, Bedrock), at $10.
  4. In Billing preferences, turn on Free Tier usage alerts.
  5. Tag every resource with `project=saboot`.
  6. Use actual-spend alerts, not forecasts, since forecasts need 5 weeks of history.
  7. Run a teardown checklist after submission: delete any OpenSearch collections or domains and EMR applications, empty and delete the S3 Vectors index if not needed, and check the Bedrock KB's backing store.
- Add-ons ranked by value per hour:
  1. Polly "listen to your complaint in Hindi" button. About 1 h, and good for accessibility and the video.
  2. EventBridge Scheduler running a FIRMS poller every 6 h that flags new fires near saved cases. About 1-2 h, and supports a "living case" story.
  3. Amazon Location basemap. About 1 h. API-key setup; satellite style availability not verified.
  4. Amazon Translate for UI strings. Low value, since Claude already drafts in Hindi.
  5. Transcribe Hindi voice input. About 3-4 h with browser audio streaming. Do it only if everything else is frozen.
  6. Step Functions to orchestrate evidence → agent → PDF. Visually nice in the console, but adds integration work. Skip unless the async draft pattern is needed anyway.
- Kiro: use it on day 0 to write `requirements.md`, `design.md`, and `tasks.md` specs for each workstream, then mention "spec-driven development with Kiro" in the video's AWS segment and the blog. The free tier is enough for light use. Its value is in the story, not the build speed.

### Gaps
- I could not confirm Amazon Location Service availability, pricing, or a satellite basemap style in ap-south-1.
- I could not confirm current Transcribe Hindi streaming in ap-south-1, or whether the Polly sync API works for Kajal today.
- I could not confirm Amazon Translate details or EventBridge or Step Functions free-tier figures in this session.

## Q9. Concrete 3-person plan: Thu Oct 8 → Sun Oct 11 (times IST)

### Takeaway
Lock a must-have demo path by Friday night, feature-freeze Saturday at 20:00, record the 3-minute video Sunday morning, and submit by about 15:00 Sunday because the deadline hour is still unannounced. Split the work into three streams with a JSON contract agreed in the first hour: Frontend and demo, Geo and data, AI and backend. Every live call gets a cached "demo mode" fallback.

### Cited Findings
- Deadline day is Sunday Oct 11, and the hours are not final. The DTU in-person day is Sat Oct 10, 8 AM-8 PM, optional and with limited seats. — [WeMakeDevs schedule](https://www.wemakedevs.org/aws/env/schedule); [WeMakeDevs event page](https://www.wemakedevs.org/aws/env)
- The video must be at most 3 minutes and show what the project does, who it is for, and where AWS fits. — [WeMakeDevs event page](https://www.wemakedevs.org/aws/env)
- Lambda Function URLs are limited only by the function timeout (up to 15 minutes), unlike the 29-s API Gateway default, but they support only IAM or public auth. — [Medium: Function URLs vs 30 s timeout](https://codestax.medium.com/hit-a-30s-timeout-heres-how-lambda-function-urls-save-the-day-d2e4912c6882); [AWS re:Post](https://repost.aws/knowledge-center/api-gateway-timeout-limit)

### Inferences

**Roles** (assign by skill; names from the synopsis):
- **P1, Frontend and demo owner:** React + Vite + MapLibre, Amplify Hosting, UI states, the citations-beside-draft view, print-to-PDF, and video editing.
- **P2, Geo and data owner:** Earth Index download, Sentinel-2 chip pre-render, FIRMS (live and archive), the Spark job (Glue or EMR Serverless), Athena, and S3 Vectors.
- **P3, AI and backend owner:** AWS account and IAM, Budgets, Bedrock access, the KB corpus, the Strands agent, Lambda/Function URLs, and DynamoDB/S3.

**Must-have demo path (the video storyline):**
1. Open the app centered on Jodhpur.
2. Drop a pin on a known large dump or burn site and attach an optional photo.
3. The history panel shows 8-12 dated Sentinel-2 chips with a slider, a change sparkline, and FIRMS fire markers and counts near the site.
4. Click "Draft complaint (हिंदी)". The agent retrieves the SWM Rules 2026 clauses and an NGT order, identifies the responsible authority, and writes a one-page Hindi complaint. Each rule cited in the text sits beside it with its source document and page.
5. Download or print the PDF. The case is saved with an ID in DynamoDB.
6. Should-have: "Find lookalikes" shows a hotspot map of similar sites across the district.

**Day 0, Thu Oct 8 (now to about 23:30)**
- **First 90 min, all three:**
  - Create one AWS account (team lead) in ap-south-1 with IAM users or Identity Center for all three.
  - Set up the Budget alarm (earns $20).
  - Bedrock smoke test: `converse` with `in.anthropic.claude-sonnet-5` and `global.anthropic.claude-sonnet-5-5`, plus a Nova Pro geo fallback, each asked for a Hindi paragraph. This is the go/no-go gate.
  - Create the GitHub repo and connect Amplify to `main`.
  - Agree the API JSON contract: `/cases`, `/evidence?lat&lon`, `/lookalikes?lat&lon`, `/draft`.
  - Pick 5-10 candidate demo sites in Jodhpur from news reports or visual inspection of satellite basemaps, such as the municipal dumping ground and roadside burning belts. Prefer sites larger than about 300 m so they match the patch size.
  - Register the FIRMS MAP_KEY and submit the FIRMS archive request for Rajasthan 2019-2026 now, since archive requests take time.
- **P1:** Vite + React + MapLibre skeleton with a basemap, pin drop, a side panel with mock JSON, and the Hindi font loaded (Noto Sans Devanagari). Deploy to Amplify tonight.
- **P2:** Identify the MGRS tiles covering Jodhpur, download one tile of Earth Index embeddings, and confirm the schema, patch spacing, and years. Write the pystac-client chip renderer and test it on one site.
- **P3:** Collect the corpus (SWM Rules 2026 gazette, CPCB guidance, NGT orders on waste burning and dumpsites) into S3 with metadata sidecars. Create the Bedrock KB (S3 Vectors, Cohere Multilingual or Titan V2), sync it, and test Retrieve. Build a local Strands agent with `search_rules` plus a stub evidence tool, and produce the first English draft.
- **Checkpoint 23:00:** Bedrock works from Mumbai; KB Retrieve returns relevant chunks; the map is live on the Amplify URL; the embedding schema is verified; the FIRMS key works.

**Day 1, Fri Oct 9 (09:00-23:30)**
- **P1:** History timeline component with chips, slider, and sparkline; fire markers layer; case form with photo upload through a presigned URL; draft panel with a citations sidebar; print stylesheet for the PDF.
- **P2:** Pre-render chips for all demo sites to S3 with a manifest. Build the FIRMS Lambda (live, bbox ± 2 km, last 7-10 days). Load the FIRMS archive (when it arrives) and the Earth Index tiles, then run Spark job v1 (Glue) to produce partitioned Parquet, register it in the Glue Catalog, and write 2-3 Athena queries.
- **P3:** Deploy the agent Lambda (pinned Strands, Function URL, 120 s timeout, 1 GB). Add the tools `get_site_evidence`, `search_rules`, and `lookup_authority` (static JSON for the Jodhpur municipal body, RSPCB regional office, and collector), plus structured JSON output, Hindi and English modes, and the DynamoDB case table. Add the guardrail prompt: never name individuals, describe location only, include a not-legal-advice footer.
- **Checkpoint 13:00:** one site works end-to-end on localhost with partial stubs.
- **Checkpoint 22:00:** the must-have path works on the deployed URL for at least 3 sites. If it does not, cut lookalikes and Spark to the "precomputed only" fallback and spend Saturday morning on the must-have path.

**Day 2, Sat Oct 10 (09:00-23:30)**
- **Morning:**
  - P2: S3 Vectors index from the Spark output, a lookalike query Lambda, and precomputed GeoJSON hotspots for the seed sites.
  - P1: hotspot or heatmap layer and a lookalike list.
  - P3: a native-Hindi review of 5 drafts with prompt fixes, a model fallback chain (Sonnet → Haiku → Nova Pro), and "golden" cached responses (draft, retrieval, evidence) saved to S3 for each demo site, enabled by a `?demo=1` flag.
- **Afternoon:**
  - Polish: loading and error states, empty-state copy, mobile layout.
  - Add-ons only if green: Polly read-aloud (1 h) and an EventBridge FIRMS poller (1-2 h).
  - Optional: one person attends DTU for Amazon-team feedback while the other two keep building online.
- **20:00 FEATURE FREEZE.** After this, only bug fixes.
- **Evening:** bug bash with all three people clicking through on different devices. Write the README with an architecture diagram showing the AWS services. Write the video script and storyboard, do a dry-run recording, and draft the AWS Builder Center blog (the top-5 blog prize).

**Day 3, Sun Oct 11 (08:00 to submission)**
- **08:00-09:30:** final fixes only. Test the deployed URL in an incognito window, re-seed the demo cases, and check the Budget.
- **09:30-12:30:** record the video in segments. Suggested script:
  - 0:00-0:20, problem: a resident with one photo and a complaint that gets closed.
  - 0:20-2:00, live walkthrough of the must-have path in Hindi mode, with lookalikes if ready.
  - 2:00-2:40, AWS architecture: Amplify → Lambda → Strands on Bedrock (`in.` profile, data stays in India) → Knowledge Base on S3 Vectors → Spark job → partitioned Parquet + Athena → DynamoDB/S3. Mention Kiro specs here.
  - 2:40-3:00, impact and honest limits: 320 m patches, no individuals named, the citizen files the complaint.
  Use demo mode for any step whose latency would make the cut drag.
- **12:30-14:30:** edit, add captions, export at 3:00 or less. Make the repo public and finish the README. Submit by about 15:00 IST at the latest, or earlier if the cutoff is announced earlier.
- **After submission:** teardown and cost check as listed in Q8.

**Fallback stubs (implement by Saturday noon):**
- Bedrock throttle or error: retry, then fall back down the model chain, then serve the cached golden draft for that site from S3.
- KB Retrieve failure: a static `rules_topk_{site}.json`.
- Imagery: chips are already pre-rendered, so there is no live COG path in the demo.
- FIRMS API outage: Athena results over the archive, or a cached JSON.
- Lookalikes: precomputed GeoJSON per seed site.
- Amplify deploy breaks: keep the last good build pinned, and record from a local build if needed.
- Agent latency over 25 s: Function URL or async with polling, plus a progress UI ("Retrieving rules… Drafting…").

**Cut order if behind schedule (cut from the top first):**
1. Transcribe voice input.
2. Live chip Lambda.
3. EventBridge poller.
4. Hybrid BM25 fusion.
5. S3 Vectors live lookalikes (keep the precomputed ones).
6. The Spark job (replace with Athena CTAS or DuckDB and keep "partitioned Parquet + Athena").

Never cut the pin → history → fires → cited Hindi draft path.

### Gaps
- Team members' individual skills are unknown, so role assignment is generic.
- The deadline hour is unknown, so the Sunday times assume a cutoff no earlier than about 15:00 IST.
- Specific Jodhpur dump or burn site coordinates were not researched. They are needed in the first hour of day 0.
