# Model evaluation (A2, issue 50)

All numbers are measured on the **public test split** (hash split, seed 26; nothing here was trained on it), not on Jodhpur field photos, which are not imported yet (decision 20261010-1030). Rerun with the field `holdout` once they are. Measured on 10 Oct 2026.

**Boxes made by a model, not by people:** every `waste_pile` and `bin` box comes from an OWLv2 teacher (`google/owlv2-large-patch14-ensemble`, Apache-2.0) run on the QR4Change photos; for those two classes the detector table measures agreement with the teacher, not with human labels. No human-drawn pile or bin boxes exist yet. All other boxes (`waste_item`, `bag`, `burning`) and every image label below are from the datasets' human annotators.

## Data

| source | licence | what it gives | train / val / test |
|---|---|---|---|
| QR4Change (Pune streets) | CC BY 4.0 | waste or not (people's labels); teacher piles and bins | 1,590 / 193 / 184 |
| TACO | CC BY 4.0 | litter boxes (`waste_item`, `bag`), materials | 832 / 79 / 123 |
| garbage_od (Roboflow, via HF) | CC BY 4.0 | material boxes (`waste_item`), materials | 8,360 / 1,044 / 1,060 |
| D-Fire | CC0 1.0 | fire and smoke boxes (`burning`), photos without fire as background | 1,196 / 147 / 157 |

DETECTOR

## Embedding classifier

Logistic heads on an image embedding. The report-type head learns from QR4Change only (TACO has no report type), the material heads from TACO and garbage_od, the burning head from every photo (D-Fire gives the fires). Materials with fewer than 40 training photos (textile, e-waste, construction debris, medical) get no head; their share comes from the judge or Rekognition labels.

Benchmark on one fixed sample (at most 800 photos per source and split, the same rows for both), regularisation picked on val:

| embedder | mean test F1 (7 heads) | waste or not, test F1 | plastic | metal | burning | latency per photo | cost per 1,000 photos |
|---|---|---|---|---|---|---|---|
| Titan Multimodal Embeddings G1 (Bedrock, 1,024 dims) | 0.919 | 0.969 | 0.899 | 0.778 | 0.908 | 218 ms median (Bedrock call to ap-south-1 from the training machine) | about $0.06, and a 200 requests per minute quota |
| SigLIP 2 base 224 (local ONNX, 768 dims) | 0.923 | 0.969 | 0.896 | 0.818 | 0.904 | 118 ms median on 4 CPU threads, 206 ms on 2 | none; 372 MB file |

They tie on accuracy, so **SigLIP 2 is used**: no per-photo cost, no Bedrock quota (Titan allows 200 requests a minute on this account), and the photo never leaves the cluster. Its heads were then retrained on every train photo:

| head | test photos with the class | precision | recall | F1 |
|---|---|---|---|---|
| report_type:waste_dump | 65 | 0.984 | 0.954 | 0.969 |
| materials:plastic | 232 | 0.876 | 0.884 | 0.880 |
| materials:organic | 247 | 0.996 | 0.980 | 0.988 |
| materials:paper | 333 | 0.952 | 0.958 | 0.955 |
| materials:glass | 272 | 0.981 | 0.952 | 0.966 |
| materials:metal | 230 | 0.861 | 0.835 | 0.848 |
| hazards:burning | 96 | 0.964 | 0.844 | 0.900 |

The waste head is the `embedding_classifier` signal; materials above 0.5 become composition shares (normalised over the materials seen, not measured areas); burning above 0.5 becomes a hazard.

STACK

## Bedrock vision judge

The judge (prompt `judge_v0`) on a fixed sample: the 184 QR4Change test photos (does it confirm a `waste_dump` claim exactly) and 40 D-Fire test photos (20 with fire). A photo without a valid answer counts as wrong. Cost from token counts at list prices (Nova 2 Lite at $0.30 / $2.50 per million tokens).

| model | photos | answered | waste_dump claim (accuracy) | burning (accuracy) | median latency | p90 latency | USD per 1,000 photos |
|---|---|---|---|---|---|---|---|
| Nova Lite (apac.amazon.nova-lite-v1:0) | 224 | 216 | 0.929 (n=184) | 0.825 (n=40) | 1.5 s | 2.0 s | 0.17 |
| Nova Pro (apac.amazon.nova-pro-v1:0) | 224 | 223 | 0.908 (n=184) | 0.650 (n=40) | 1.8 s | 2.6 s | 2.24 |
| Nova 2 Lite (global.amazon.nova-2-lite-v1:0) | 224 | 206 | 0.864 (n=184) | 0.750 (n=40) | 1.8 s | 2.7 s | 0.59 |

Claude Sonnet 4.6 and Haiku 4.5 were not run: Bedrock refuses them for this account until the Anthropic use-case form is submitted, so today the judge falls through to Nova Pro. Nova Pro's misses: 7 clean photos called a dump, and 10 dump photos called `no_bin`, `contaminated_water` or clean, or left unanswered. On this sample Nova Lite is both the most accurate and the cheapest; it is worth trying ahead of Nova Pro in the judge's fallback order (decision 20261010-0133 is unchanged here).

GAPS
