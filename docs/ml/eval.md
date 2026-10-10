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

## Detector

YOLO26s (Ultralytics 8.4.175, COCO-pretrained), 80 epochs at 640 px on the RTX 5080, seed 26, best checkpoint by val mAP. Test split: 1,521 photos (QR4Change, TACO, garbage_od, D-Fire), mAP from Ultralytics `val`.

| class | boxes (test) | who drew them | precision | recall | mAP50 | mAP50-95 |
|---|---|---|---|---|---|---|
| waste_pile | 116 | OWLv2 teacher | 0.575 | 0.466 | 0.482 | 0.307 |
| bag | 5 | people (TACO) | 1.000 | 0.000 | 0.226 | 0.120 |
| bin | 129 | OWLv2 teacher | 0.860 | 0.690 | 0.732 | 0.661 |
| burning | 212 | people (D-Fire) | 0.582 | 0.571 | 0.559 | 0.290 |
| waste_item | 8,251 | people (TACO, garbage_od) | 0.788 | 0.603 | 0.685 | 0.436 |
| all | 8,713 | | 0.761 | 0.466 | 0.537 | 0.363 |

`bag` has 26 training boxes and 5 test boxes, so its row is noise. The `waste_pile` and `bin` rows say how well the detector reproduces the teacher, not how well it finds piles; the field audit's hand-drawn boxes will replace them.

Teacher settings (`training/learn/teacher.py`): queries "a pile of garbage", "a heap of rubbish", "garbage dumped on the ground" for piles, kept at score 0.3 or above (or the single best box at 0.15 or above where people labelled the photo garbage), only on photos people labelled garbage; "a garbage bin", "a dustbin", "a dumpster" at 0.3 or above on every QR4Change photo; boxes inside a kept box dropped. 1,295 pile and 1,429 bin boxes over 1,967 photos; about 36 photos were checked by eye, not every box.

As a signal (QR4Change test photos, claim `waste_dump`, people's labels; score = best waste box confidence): see the signal table below.

Exports (ONNX, end to end with YOLO26's NMS-free head, output `(1, 300, 6)`), CPU latency on the training machine (Core Ultra 9 285K) with a random input, onnxruntime 1.31:

| file | for | size | threads | median latency |
|---|---|---|---|---|
| `best-640-fp32.onnx` (YOLO26s) | ml service (`YoloSignal`, S3 `models/yolo/`) | 38.2 MB | 2 / 4 | 103 ms / 77 ms |
| `best-320-fp16.onnx` (YOLO26s) | comparison, not published | 19.1 MB | 1 | 62 ms |
| `best-320-int8.onnx` (YOLO26s) | comparison, not published | 9.9 MB | 1 | 95 ms |
| `best-320-int8.onnx` (YOLO26n, phone) | phone, int8 (S3 `models/edge_int8/`) | 2.8 MB | 1 | 21 ms |
| `best-320-fp16.onnx` (YOLO26n, phone) | phone, fp16 (S3 `models/edge_fp16/`) | 4.9 MB | 1 | 13 ms |

The phone models are a separate YOLO26n trained 40 epochs at 320 px on the same data. Test mAP50 / mAP50-95 at 320 px: PyTorch 0.424 / 0.290, fp16 ONNX 0.412 / 0.280, int8 ONNX 0.372 / 0.242 (YOLO26s at 640: 0.537 / 0.363). The int8 file suits onnxruntime-web on WASM; the fp16 file suits WebGPU. The YOLO26s 320 px exports above were not published.

Desktop CPU timings stand in for a phone; expect several times slower on a mid-range Android in the browser.

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

## Signals and the stacker

The verifier's question for every photo below is "does it show the claimed `waste_dump`?", checked against people's labels: the 184 QR4Change test photos (65 garbage, 119 not). The meta-learner was fitted on the 193 QR4Change val photos (81 garbage), each signal scored by the ml service's own code (`ml.handlers.score_cli`), the judge being Nova Pro.

Each signal alone (support at 0.5 or more counts as yes):

| signal | photos | precision | recall | F1 | ECE |
|---|---|---|---|---|---|
| rekognition_labels | 184 | 0.667 | 0.954 | 0.785 | 0.113 |
| yolo | 184 | 0.933 | 0.646 | 0.764 | 0.150 |
| embedding_classifier | 184 | 0.984 | 0.954 | 0.969 | 0.018 |
| vision_judge | 183 | 0.564 | 0.969 | 0.713 | 0.142 |

`vision_judge` precision is low because an answer of another report type (often `no_bin` for a photo of a street bin) gives a neutral 0.5, which counts as yes here; in the stack it carries little weight.

The meta-learner (`meta-v1`) is two logistic regressions over the signals' logits, fitted on val: one before the judge and one after it. Weights before the judge: Rekognition 0.25, YOLO 0.65, embedding classifier 1.27, bias 1.55; after it the judge adds 0.21. Logistic regression is calibrated on the data it is fitted on, so no separate calibration step was added; the test ECE below checks it. Both combiners are replayed end to end on test with the service's rules: auto-verify at 0.85 or more, reject under 0.5, community check in between or when two signals differ by 0.5 or more, and the judge only for those last two cases.

| combiner | photos | accuracy | Brier | ECE | judge called | auto-verified (right) | rejected (right) | community check | judge cost |
|---|---|---|---|---|---|---|---|---|---|
| fixed weights (fw-v0) | 184 | 0.978 | 0.045 | 0.110 | 36% | 34 (34) | 89 (86) | 61 | $0.164 |
| meta-learner (meta-v1) | 184 | 0.978 | 0.020 | 0.019 | 28% | 43 (42) | 89 (86) | 52 | $0.127 |

Same accuracy, but the meta-learner's probabilities are honest (ECE 0.019 against 0.110), it auto-verifies 43 instead of 34 photos, asks the judge on 28% of photos instead of 36%, and costs less. Wrong automatic decisions: meta-learner 4 (1 clean photo auto-verified, 3 garbage photos rejected), fixed weights 3 (3 garbage photos rejected).

The 52 community checks are the 52 photos where two signals are 0.5 or more apart; the disagreement rule sends them to people whatever the meta-learner says: 30 clean photos where Rekognition labels say waste and YOLO finds none, and 18 garbage photos where YOLO finds no waste box but the embedding classifier is sure. A learned disagreement rule, or the gap applied to the meta-learner's own confidence, would cut community checks sharply; that changes the contract's decision rule, so it is left for a decision.

## Bedrock vision judge

The judge (prompt `judge_v0`) on a fixed sample: the 184 QR4Change test photos (does it confirm a `waste_dump` claim exactly) and 40 D-Fire test photos (20 with fire). A photo without a valid answer counts as wrong. Cost from token counts at list prices (Nova 2 Lite at $0.30 / $2.50 per million tokens).

| model | photos | answered | waste_dump claim (accuracy) | burning (accuracy) | median latency | p90 latency | USD per 1,000 photos |
|---|---|---|---|---|---|---|---|
| Nova Lite (apac.amazon.nova-lite-v1:0) | 224 | 216 | 0.929 (n=184) | 0.825 (n=40) | 1.5 s | 2.0 s | 0.17 |
| Nova Pro (apac.amazon.nova-pro-v1:0) | 224 | 223 | 0.908 (n=184) | 0.650 (n=40) | 1.8 s | 2.6 s | 2.24 |
| Nova 2 Lite (global.amazon.nova-2-lite-v1:0) | 224 | 206 | 0.864 (n=184) | 0.750 (n=40) | 1.8 s | 2.7 s | 0.59 |

Claude Sonnet 4.6 and Haiku 4.5 were not run: Bedrock refuses them for this account until the Anthropic use-case form is submitted, so today the judge falls through to Nova Pro. Nova Pro's misses: 7 clean photos called a dump, and 10 dump photos called `no_bin`, `contaminated_water` or clean, or left unanswered. On this sample Nova Lite is both the most accurate and the cheapest; it is worth trying ahead of Nova Pro in the judge's fallback order (decision 20261010-0133 is unchanged here).

## Gaps and what would change these numbers

- No Jodhpur field photos yet: every number above is on public photos, and QR4Change's clean photos include many non-Indian street bins. The field holdout (grouped by scan and site) replaces this table once imported.
- No human pile or bin boxes; no boxes at all for construction debris, medical waste, dead animals or chemicals. No size labels, so `YoloSignal`'s size class (share of the photo under waste boxes: under 10% small, under 35% medium, else large) is a rule, not a trained estimate.
- Material shares are presence probabilities normalised over the materials seen, not measured areas. Textile, e-waste, construction debris and medical have no head.
- Only `waste_dump` claims have labelled photos; `YoloSignal` and `EmbeddingSignal` are neutral for claims they cannot see (`contaminated_water`; the embedding head also for `open_construction`), and combiners skip neutral signals.
- The after-judge model was fitted on Nova Pro answers; refit it if the judge moves to Claude or Nova Lite.
- Reproduce: `backend/ml/training` `learn` commands (`teacher`, `detector-data`, `detector-train`, `detector-eval`, `detector-export`, `embed`, `heads`, `cases`, `stacker`, `bench`, `publish`) and `backend/ml` `ml.handlers.score_cli`; scored files and runs stay outside the repo.
