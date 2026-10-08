# Satellite and geospatial-AI data feasibility for Saboot (Jodhpur dump and waste-burning evidence app)

Research date: 2026-10-08. Besides web sources, several facts below come from live checks run today against the public endpoints. Each is cited to the endpoint queried and marked "(live check 2026-10-08)": Earth Search STAC queries, HTTP HEAD requests, reading Parquet footers, and FIRMS CSV downloads. Jodhpur test point: 26.28 N, 73.02 E.

## 1. Sentinel-2 L2A on AWS: catalog, access, revisit, cloud, visibility, thumbnails, indices

### Takeaway
Use Element 84 Earth Search v1 (`https://earth-search.aws.element84.com/v1`), collection `sentinel-2-c1-l2a`. Its COGs are public and need no signing or requester-pays setup. Jodhpur gets a new scene about every 4 days. Imagery is near cloud-free from October to May and mostly unusable from July to August. Fall back to the legacy `sentinel-2-l2a` collection (bucket `sentinel-cogs`) for 2022, because C1 has a large hole that year. At 10 m, a large dump footprint and its growth over time are visible. Individual piles are not.

### Cited Findings
- The legacy L2A COG bucket is `s3://sentinel-cogs` (ARN `arn:aws:s3:::sentinel-cogs`) in us-west-2. Listing works anonymously with `aws s3 ls --no-sign-request s3://sentinel-cogs/`. The STAC endpoint is `https://earth-search.aws.element84.com/v1`, collection `sentinel-2-l2a`. L2A is global from December 2018 and covers wider Europe from April 2017. New data is added "usually within few hours" of availability on Copernicus. — [AWS Registry: sentinel-2-l2a-cogs](https://registry.opendata.aws/sentinel-2-l2a-cogs/)
- The Collection 1 L2A data sits in bucket `e84-earth-search-sentinel-data` (us-west-2), STAC collection `https://earth-search.aws.element84.com/v1/collections/sentinel-2-c1-l2a`. — [AWS Registry](https://registry.opendata.aws/sentinel-2-l2a-cogs/)
- Earth Search v0 is deprecated, and v1 is the current API. — [Element 84 blog: Introducing Earth Search v1](https://element84.com/blog/introducing-earth-search-v1-new-datasets-now-available)
- The Earth Search README marks STAC API v2 as beta. It maps v1 `sentinel-2-c1-l2a` to v2 `sentinel-2-l2a`, which signals that C1 is the go-forward collection. It also notes that some collections have missing Items and that the public API has no guaranteed service. Requester-pays assets are flagged per Item and returned as `s3://` URLs. — [Element84/earth-search GitHub](https://github.com/Element84/earth-search)
- (live check 2026-10-08) `https://earth-search.aws.element84.com/v2/collections` currently lists only `sentinel-2-l2a`. — [Earth Search v2 collections](https://earth-search.aws.element84.com/v2/collections)
- (live check 2026-10-08) The Jodhpur point falls in the overlap of MGRS tiles 43RBK and 43RCK, so every acquisition date returns two Items and results must be de-duplicated by date. The C1 asset URLs are plain HTTPS, for example `https://e84-earth-search-sentinel-data.s3.us-west-2.amazonaws.com/sentinel-2-c1-l2a/43/R/BK/2025/12/S2C_T43RBK_20251227T054244_L2A/TCI.tif`. An unsigned HEAD request returned HTTP 200, so the bucket is public and not requester-pays. The full-tile TCI.tif is about 184 MB, so read windows with range requests rather than downloading it. Available assets: visual (TCI), blue, green, red, nir, nir08, rededge1-3, swir16, swir22, scl, cloud, aot, wvp, thumbnail, preview (320 m). C1 band metadata carries `scale 0.0001, offset -0.1`. — [Earth Search STAC search API](https://earth-search.aws.element84.com/v1/search)
- (live check 2026-10-08) In 2025 there were 88 distinct acquisition dates at the Jodhpur point, about one every 4.1 days (S2A, S2B and S2C all imaged). The newest scene was 2026-10-03, five days before the query. — [Earth Search STAC search API](https://earth-search.aws.element84.com/v1/search)
- (live check 2026-10-08) Scene-level cloud cover by month in 2025 (one tile per date):

  | Month | Dates | Median cloud cover | Dates under 10% cloud |
  |---|---|---|---|
  | Jan | 7 | 0.1% | 5 |
  | Feb | 5 | 0% | 3 |
  | Mar | 7 | 0% | 5 |
  | Apr | 8 | 0% | 7 |
  | May | 8 | 0% | 7 |
  | Jun | 8 | 57% | 3 |
  | Jul | 7 | 91% | 0 |
  | Aug | 8 | 92% | 0 |
  | Sep | 8 | 25% | 1 |
  | Oct | 7 | 0% | 5 |
  | Nov | 8 | 0% | 7 |
  | Dec | 7 | 8.7% | 4 |

  — [Earth Search STAC search API](https://earth-search.aws.element84.com/v1/search)
- (live check 2026-10-08) Items per year at the Jodhpur point:

  | Year | `sentinel-2-c1-l2a` | `sentinel-2-l2a` |
  |---|---|---|
  | 2017 | 2 | 59 |
  | 2018 | 44 | 183 |
  | 2019 | 112 | 260 |
  | 2020 | 142 | 286 |
  | 2021 | 148 | 314 |
  | 2022 | 10 | 146 |
  | 2023 | 144 | 148 |
  | 2024 | 148 | 150 |
  | 2025 | 176 | 176 |
  | 2026 (to Oct 3) | 134 | 134 |

  The earliest C1 Item is 2017-12-29. — [Earth Search STAC search API](https://earth-search.aws.element84.com/v1/search)
- Microsoft Planetary Computer also hosts a `sentinel-2-l2a` STAC collection and is an alternative catalog. — [Planetary Computer STAC: sentinel-2-l2a](https://planetarycomputer.microsoft.com/api/stac/v1/collections/sentinel-2-l2a)
- EO Browser and the Sentinel Hub dashboard are being sunset. Free anonymous EO Browser access reportedly ended in February 2025, and EO Browser's timelapse needed a login and was capped at 300 frames. — [Planet community: sunset of EO Browser](https://community.planet.com/product-updates/important-update-sunset-of-eo-browser-and-sentinel-hub-dashboard-6426); [Mapscaping](https://mapscaping.com/best_4_free_satellite_imagery_sources/)
- The successor is the EU-funded Copernicus Browser, which is free, though advanced features need a free account. Old Sentinel Playground links redirect to it. — [Sentinel Hub forum: Copernicus Browser replaces Playground](https://forum.sentinel-hub.com/t/new-copernicus-browser-to-replace-sentinel-playground/8421)
- Sentinel-2's 20 m SWIR bands are "very useful to detect active fires". Super-resolution work tries to sharpen them to 10 m. — [arXiv 1906.10413](https://arxiv.org/pdf/1906.10413)
- A 2026 study evaluates spectral indices, including SWIR-based thermal and burn indices, for monitoring smouldering waste dumps (coal waste). — [arXiv 2601.11603](https://arxiv.org/pdf/2601.11603)
- In a published Sentinel-2 dumpsite study, low resolution was the main weakness, with poor detection of small sites. — [ACRS 2025 abstract](https://acrs-aars.org/proceeding/ACRS2025/fp_abs-77.pdf)

### Inferences
- **Recommended catalog:** `sentinel-2-c1-l2a` on Earth Search v1 for 2017–2021 and 2023 onwards. Query `sentinel-2-l2a` (sentinel-cogs) for 2022 only. C1 is harmonized; in the legacy collection, the pre- and post-January 2022 processing baselines differ by a reflectance offset. The offset is general knowledge and was not re-verified here. It barely matters for RGB `visual` thumbnails but matters for indices. Planetary Computer works as a backup catalog. Its asset URLs need SAS-token signing via the `planetary-computer` package (from prior knowledge, not re-verified), so it adds a step.
- **Fastest thumbnails:** In Lambda, run rio-tiler (`Reader(href).part(bbox, max_size=512)`) on the `visual` (TCI) COG for a roughly 1–2 km box around the pin. This makes a few range requests per date. The steps are: search STAC; filter `eo:cloud_cover < 20`; de-duplicate by date; keep one image per month (or the clearest per quarter for 2018–2026); render PNGs; assemble a GIF with Pillow or imageio. Cache to S3 by `site_id/date.png`. Expect about 1–3 s per frame from us-west-2. For the demo, pre-render the GIFs for the 3–5 seed sites so the live path never blocks.
- **What to skip:** stackstac/odc-stac add little for single-site thumbnails. TiTiler is worth it only if the team wants a slippy-map time slider.
- **Deep-link fallback:** For each pin and date, a Copernicus Browser link is a zero-code fallback "view it yourself" option.
- **What 10 m can show:** Large municipal dumps of several hectares (Keru's landfill is about 20 acres, roughly 8 ha) appear as grey-brown, texture-mottled patches that expand over time. Dark burn scars on bare or dumped ground can show up in SWIR false color (B12/B11/B04) and NBR = (B08 − B12)/(B08 + B12). dNBR between dates flags new burns. Active hot fires can saturate B12/B11 and show bright orange in SWIR composites. Smoke plumes are visible in true color when a fire is burning at the 10:30–11:00 local overpass, which is rare. The roughly 5-day revisit means most short burns are missed.
- **Landfill and plastic indices:** Published "plastic" or "landfill" indices are mostly tuned for floating marine debris or need very high resolution. For Saboot, a SWIR/NIR pair (NBR, NBR2 = (B11 − B12)/(B11 + B12)) plus a bare-soil index and simple change detection is more defensible than a "plastic index".
- **Seasonality:** For history views, prefer October–May scenes. July–August is nearly always cloudy at Jodhpur.

### Gaps
- No Element 84 statement was found that formally deprecates `sentinel-2-l2a` or explains why C1 has only 10 Items at Jodhpur for 2022. The counts above are empirical.
- No study was found that validates Sentinel-2 burn-scar or SWIR detection specifically at open municipal dumps in India.
- Copernicus Browser timelapse support was not confirmed.

## 2. NASA FIRMS: API, resolution, detection limits, false positives, archive, latency

### Takeaway
FIRMS works for the demo. Its yearly India CSVs (2012–2024 for VIIRS) download without any key, and the area API with a free MAP_KEY covers recent days. However, VIIRS 375 m and MODIS 1 km pixels are coarse. Small dump fires are often missed, and roughly half of Jodhpur's detections are flagged as static or industrial sources. Present FIRMS hits as "thermal anomalies near the site", not as proof of waste burning.

### Cited Findings
- **Area API, latest data:** `https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/[SOURCE]/[west,south,east,north]/[DAY_RANGE]`. A specific start date can be added: `/[DAY_RANGE]/[YYYY-MM-DD]`. — [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/)
- **Area API parameters and limits:** DAY_RANGE is 1–5. Sources: `VIIRS_SNPP_NRT`, `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, `MODIS_NRT`, `MODIS_SP`, `VIIRS_SNPP_SP`, `VIIRS_NOAA20_SP`, and `LANDSAT_NRT`, which covers the US and Canada only. The MAP_KEY limit is "5000 transactions / 10-minute interval", and large requests can count as several transactions. — [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/)
- The FIRMS API index (v4.1.16) lists these endpoints: area, data_availability, kml_fire_footprints, map_key setup and missing_data. The `country` and `countries` endpoints are marked "Feature currently not available". — [FIRMS API index](https://firms.modaps.eosdis.nasa.gov/api/)
- **Pixel sizes:** about 1 km for MODIS and about 375 m for VIIRS.
- **Detection limits:** "MODIS routinely detects both flaming and smoldering fires 1000 m2 in size." The FAQ gives no VIIRS minimum and says only that the 375 m product responds better to small fires.
- **Overpasses (local time):** Terra about 10:30 am and pm; Aqua and S-NPP about 1:30 pm and am; NOAA-20/21 about 12:40 pm and am.
- **NRT latency:** within 3 hours, best effort.
- **Archive starts:** MODIS Terra November 2000, Aqua July 2002, VIIRS S-NPP 20 January 2012, NOAA-20 1 January 2020, NOAA-21 17 January 2024.
- **NRT caveats:** NRT omits the static-source "type" field and can have worse geolocation.
- **Known non-fire hotspots:** gas flares and volcanoes, sun glint, and hot smoke plumes at night.

  All of the above are from the [NASA Earthdata FIRMS FAQ](https://www.earthdata.nasa.gov/data/tools/firms/faq).
- VIIRS daytime false alarms can come from solar panels, hot and bright surfaces, and sun glint. The 375 m product gives detection information only, with no sub-pixel fire characterization because of saturation. — [VIIRS Active Fire Quick Guide](https://rammb2.cira.colostate.edu/wp-content/uploads/2025/09/VIIRS_Active_Fire_Quick_Guide_v1-2022.pdf)
- NRSC (India) noted VIIRS 375 m potential for "smaller and cooler fires" in India. It also said it does not validate the VIIRS or MODIS fire products. — [NDRC9 webinar minutes 2019](https://directreadout.sci.gsfc.nasa.gov/ndrc_documents/NDRC9_Webinar_Minutes_2019.05.15.pdf)
- Brick kilns are usually about 30 m wide. Current thermal imagery at roughly 100 m is called too coarse to tell whether a kiln is operating. — [arXiv 2402.13796 (brick kiln detection in India)](https://arxiv.org/pdf/2402.13796)
- An RGB model detected about 44,000 brick kilns in India for 2022, with precision 0.90 and recall 0.89. — [EGU25-11020](https://meetingorganizer.copernicus.org/EGU25/EGU25-11020.html)
- (live check 2026-10-08) **Keyless yearly CSVs:** these download with no MAP_KEY, for example `https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2024/viirs-snpp_2024_India.csv` (43 MB, 552,312 India rows) and `.../modis/2024/modis_2024_India.csv` (5.8 MB). 2023 is available. The 2025 files for viirs-snpp, viirs-noaa20 and modis returned HTTP 404, so the yearly files lag by more than nine months. Columns: latitude, longitude, bright_ti4, scan, track, acq_date, acq_time, satellite, instrument, confidence, version, bright_ti5, frp, daynight, type. — [FIRMS yearly India VIIRS CSV](https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2024/viirs-snpp_2024_India.csv)
- (live check 2026-10-08) **2024 VIIRS S-NPP detections in a Jodhpur bounding box** (26.0–27.6 N, 72.2–73.9 E):
  - 851 detections in total.
  - 413 have `type=2`, a static land source such as industry, and 438 have `type=0`, a presumed vegetation fire.
  - Confidence: 743 nominal, 108 low.
  - Detections peak in October–December (Oct 93, Nov 269, Dec 148) and are near zero in July–August (4 and 6).
  - The most repeated 0.01° cells cluster at about 26.88 N, 73.51 E, with 99, 93 and 87 hits: a persistent static source.
  - The Jodhpur city box (26.15–26.45 N, 72.85–73.15 E) had 21 detections.
  - Four detections fell within 5 km of Keru village: 2024-10-09 (2 day pixels, about 4.5 km), 2024-10-31 (night, about 3.5 km) and 2024-12-29 (night, about 4.4 km). FRP was 0.6–2.7 MW.

  — [FIRMS yearly India VIIRS CSV](https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2024/viirs-snpp_2024_India.csv)

### Inferences
- **Two-tier design:**
  1. Load the 2012–2024 VIIRS and 2000–2024 MODIS yearly India CSVs once, clip them to the district, and write Parquet partitioned by year and month to S3 for Athena. This fits the "data lake" story and needs no key.
  2. Call the area API (`VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, `VIIRS_SNPP_NRT`) with a district bounding box for the last 1–5 days. Use the `_SP` sources with a date parameter for 2025 to mid-2026, looping in 5-day windows, which is about 73 calls per year per source and well inside 5,000 per 10 minutes.
- **Matching radius:** Snap detections to a site with a radius of at least 375 m (about 1 km for MODIS), because a hit marks a 375 m pixel centre and not the fire's location.
- **What gets missed:** Small evening waste fires are likely missed, given the about 12:40/13:30 and 00:40/01:30 VIIRS overpasses and the 375 m pixels. Absence of FIRMS hits is not evidence of no burning.
- **Labelling:** Use the `type` field and repeated-cell counts to label likely industrial or static sources. October–December peaks in western Rajasthan are probably crop-residue or vegetation burning, and kilns and industry add persistent hits. These need cross-checking against Sentinel-2.

### Gaps
- No published minimum detectable fire size for VIIRS 375 m was found in primary FIRMS docs (Schroeder et al. 2014 has theoretical curves, not retrieved).
- No study was found that quantifies FIRMS detections of Indian landfill or dump fires specifically.
- The identity of the persistent static source at about 26.88 N, 73.51 E was not verified.
- The MAP_KEY signup flow was not tested, since it requires an email registration.

## 3. Earth Genome / Earth Index embeddings: what they are and whether "384 values per 320 m patch" is accurate

### Takeaway
The claim is essentially accurate. Each Earth Index embedding is a 384-value float32 vector for a 320 m × 320 m Sentinel-2 chip (32 × 32 px at 10 m). The chips overlap by 50%, so vector centres sit on a staggered grid about 160 m apart, and each MGRS tile holds about 235,000 vectors.

There are two product generations, and their vectors must not be mixed:
- **2024 SoftCon (DINOv2 ViT-S/14):** on Source Cooperative.
- **2024–2026 SSL4EO-S12 DINO ViT-S/16:** on Earth Genome's own STAC and S3, including a rolling August 2025–August 2026 version.

Both are free under CC-BY-4.0. All six MGRS tiles around Jodhpur exist, at about 480 MB each. No evidence was found that Earth Index has been used or validated for landfills or dumpsites.

### Cited Findings
- **Source Cooperative listing:** global embeddings from Sentinel-2 temporal mosaics, files named `{MGRS}_{start}_{end}.parquet`. Schema: `id uint64`, `embedding float[384]`, `geometry` Point WKB. The model is "SoftCon Model published by Zhu Labs". License CC BY 4.0. Only a 2024 folder is listed. The page says "EPSG:4626", which is a typo. — [Source Cooperative: Earth Index Embeddings](https://source.coop/earthgenome/earthindexembeddings)
- Earth Genome's April 2025 post says "Each embedding captures a 320 square meter patch", on a MajorTom-based grid, from SoftCon, with length 384, encoded as GeoParquet. STAC collections: `sentinel2-yearly-embeddings` and `sentinel2-yearly-mosaics`. — [Earth Genome: Embeddings for all (Apr 23, 2025)](https://www.earthgenome.org/blog/embeddings-for-all)
- Earth Genome's June 24, 2026 post says that for 2025 embeddings the team "switched back to the SSL4EO model from the Zhu Lab". The patch is "320 square meters" on the MajorTom grid. Metadata uses the emerging GeoEmbedding STAC extension and is embedded in the GeoParquet header. Distribution is via `browser.stac.earthgenome.org` (collection `ssl4eo_yearly_embeddings`), direct S3, and Earth Index accounts. — [Earth Genome engineering updates (Jun 24, 2026)](https://www.earthgenome.org/blog/engineering-updates-on-sustainable-ai-at-earth-genome)
- (live check 2026-10-08) **Source Coop 2024 tiles for Jodhpur:** `https://data.source.coop/earthgenome/earthindexembeddings/2024/43RBK_2024-01-01_2025-01-01.parquet` is 479.8 MB, and 43RCK is 480.3 MB. 43RBL, 43RCL, 43RBJ and 43RCJ also exist at about 480 MB each. The S3 path is `s3://us-west-2.opendata.source.coop/earthgenome/earthindexembeddings/2024/...` and reads anonymously. — [Source Coop data endpoint](https://data.source.coop/earthgenome/earthindexembeddings/)
- (live check 2026-10-08) **Footer of the 43RCK 2024 file, read with pyarrow:**
  - 235,099 rows in 230 row groups.
  - `embedding: fixed_size_list<float32>[384]`.
  - GeoParquet 1.0.0 with CRS WGS 84 (so the "4626" on the listing is EPSG:4326).
  - `emb` header: `model.id = dinov2_vits14_softcon`, family DinoV2, version 2.0.0, "class token is extracted from the last layer", start 2024-01-01, end 2025-01-01, source "Sentinel2 Temporal Mosaics", processed 2025-03-02, `embedding.dim = 384`, `quantization = None`.

  — [Source Coop data endpoint](https://data.source.coop/earthgenome/earthindexembeddings/)
- (live check 2026-10-08) **Point spacing in the same file:** sample points step about 0.0016° in longitude (about 160 m) and alternate about 0.00144° in latitude (about 160 m), giving about 225 m between neighbours. 235,099 points per roughly 110 × 110 km tile works out to about one per 0.051 km², which matches a 160 m staggered stride. — [Source Coop data endpoint](https://data.source.coop/earthgenome/earthindexembeddings/)
- (live check 2026-10-08) **Earth Genome STAC (`https://stac.earthgenome.org`) for Jodhpur:**
  - Collections include `ssl4eo_yearly_embeddings` (2024-01-01 to 2026-01-01), `ssl4eo_yearly_embeddings_v7` (to 2026-08-16), and monthly, quarterly and semiannual SSL4EO embeddings, all CC-BY-4.0.
  - Items exist for both 43RBK and 43RCK: `43RCK_2024-01-01_2025-01-01`, `43RCK_2025-01-01_2026-01-01`, and the rolling `43RCK_2025-08-16_2026-08-16`.
  - Item metadata: "Chip-level embeddings from SSL4EO-S12 DINO ViT-S/16 over a Sentinel-2 temporal composite tile". All 13 bands (B10 zero-padded), `bilinear_resample_to_224x224`, `chip_size 224`, `stride 112` (that is, 50% overlap), float32 with no quantization.
  - Assets: for example `https://ei-ssl4eo-embeddings.s3.amazonaws.com/43RCK_2025-01-01_2026-01-01.parquet` (HTTP 200, 338 MB) and `https://ei-ssl4eo-embeddings.s3.amazonaws.com/ssl4eo_yearly_embeddings_v7/43RCK_2025-08-16_2026-08-16.parquet` (HTTP 200, 339 MB).
  - The older `sentinel2-yearly-embeddings` collection points to the Source Coop 2024 files.

  — [Earth Genome STAC: ssl4eo_yearly_embeddings](https://stac.earthgenome.org/collections/ssl4eo_yearly_embeddings)
- Cloud Native Geo notes that Earth Index GeoParquet keeps geometry and embeddings in one file, which makes it easy to load with DuckDB. It lists Earth Index for Africa at about 450 GB. — [CNG blog: Technical debt of Earth embedding products (Feb 2026)](https://cloudnativegeo.org/blog/2026/02/the-technical-debt-of-earth-embedding-products/)
- Earth Index is described as label-a-few-examples search that finds "mines, roads, airstrips, plantations" globally. A newer "Deep Search" targets sprawling or dispersed operations. — [Pulitzer Center update, June 2026](https://pulitzercenter.org/node/37278)
- Earth Genome built WasteMAP for RMI, a waste-methane platform launched December 2024. It is a methane inventory, not a dumpsite visual search. — [Earth Genome: WasteMAP](https://www.earthgenome.org/work/102---wastemap)

### Inferences
- **On the synopsis wording:** "384 values per 320 m patch" is correct. Earth Genome's own phrase "320 square meter" is a wording slip for 320 m × 320 m, about 0.1 km². The team should add that patches overlap by 50%, so effective search spacing is about 160 m. This slightly improves localization but does not change the minimum detectable object: a dump must fill a meaningful share of a 320 m chip, probably at least a few hectares.
- **Which product:** For "current state" use `ssl4eo_yearly_embeddings_v7` (August 2025–August 2026) or the 2025 calendar-year SSL4EO files. For "Source Coop / AWS Open Data" branding use the 2024 SoftCon files. Never compare a SoftCon query vector against SSL4EO vectors.
- **Time resolution:** Inputs are annual temporal composites, so the embeddings show what a place looks like over a year. They cannot date a dump to a month, which is what the Sentinel-2 history feature is for. Monthly SSL4EO collections exist in the STAC, but their coverage for India was not checked.
- **District sizing:**
  - Jodhpur district needs about 4–6 MGRS tiles: about 2–3 GB of Parquet, about 1–1.4M rows before clipping and de-duplicating tile overlaps, and probably about 0.4–0.6M vectors after clipping to the district.
  - At 384 × 4 bytes that is about 0.6–0.9 GB of raw vectors. OpenSearch k-NN (HNSW, cosine) handles this on a single r6g.large-class data node.
  - Brute-force cosine similarity in NumPy inside a Lambda or container would also return in well under a second. OpenSearch is optional for this scale.
  - PySpark on EMR Serverless works for the filter and index job but is more than this volume needs; DuckDB with the spatial extension does the same in minutes on a laptop. Keep EMR if judges reward "big data" use.
- **Expected confounders around Jodhpur:** sandstone quarries and their waste dumps (Keru is a quarrying area), bare desert or rocky ground, construction sites, brick kilns and industrial yards. Expect many lookalikes to be quarry spoil, not garbage. Results need human review, and the UI should say "visually similar", not "illegal dump".

### Gaps
- The Earth Genome documentation reviewed does not state the exact pixel size of a chip. 32 × 32 px at 10 m is inferred from "320 m" and the measured spacing.
- No published evaluation of Earth Index or SoftCon/SSL4EO embeddings for landfill or dumpsite retrieval was found, in India or anywhere.
- Coverage of the monthly, quarterly and semiannual SSL4EO collections over India, and the details of the `gemini_tci_yearly_embeddings_v1` collection, were not checked.
- The Earth Genome embeddings were not found on the AWS Open Data Registry under their own entry. They are reachable through Source Cooperative, which runs on AWS us-west-2.

## 4. Alternatives: AlphaEarth, Clay, Major TOM, TESSERA, Prithvi

### Takeaway
AlphaEarth Foundations (AEF) is the strongest alternative. It is 64-d at 10 m per pixel, annual for 2017–2025, CC-BY-4.0, and mirrored for free on Source Cooperative (AWS us-west-2). Its 10 m pixels suit few-hectare dumps better than 320 m patches. The cost is heavier raster handling: about 3.4 GB COG tiles stored bottom-up. TESSERA (128-d, 10 m) is a similar pixel product but share-alike licensed. Clay and Major TOM are patch products. Prithvi has no ready global embedding product. For a 3.5-day build, Earth Genome Parquet is the lowest-effort lookalike path. AEF is the best upgrade if the team can afford a day of raster work.

### Cited Findings
- **AEF in Earth Engine:** dataset `GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL`, 10 m, 64 bands A00–A63 in the range −1..1, unit-length vectors, tiles about 163,840 m square in local UTM. The catalog lists 2017–2024. License CC-BY 4.0 with required attribution "The AlphaEarth Foundations Satellite Embedding dataset is produced by Google and Google DeepMind." Also on GCS at `gs://alphaearth_foundations`, which the page says is "provider pays" as of July 2026. Citation: Brown et al. 2025, arXiv:2507.22291. — [Earth Engine catalog: Satellite Embedding V1](https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_SATELLITE_EMBEDDING_V1_ANNUAL)
- **AEF on Source Cooperative:** replicated by Taylor Geospatial Engine as COGs (about 465 TB) at `source.coop/tge-labs/aef`. Each file is 8192 × 8192 px with 64 channels, organized by year and UTM zone. Files use a non-standard bottom-up layout that can break GDAL. The mirror is "not officially supported by Google". — [Source Cooperative: AEF](https://source.coop/tge-labs/aef); [CNG blog on AEF accessibility](https://cloudnativegeo.org/blog/2025/11/building-frictionless-geospatial-ai-making-alphaearth-foundations-embeddings-accessible/)
- **AEF in the AWS Registry:** `arn:aws:s3:::us-west-2.opendata.source.coop/tge-labs/aef`, us-west-2, CC-BY 4.0. The registry text says 2018–2024, which conflicts with the bucket listing. — [AWS Registry: Google Satellite Embedding V1](https://registry.opendata.aws/aef-source/)
- (live check 2026-10-08) The Source Coop listing shows `aef/v1/annual/` folders for 2017 through 2025. A sample 2024 zone-43N file is 3.4 GB: `aef/v1/annual/2024/43N/x06pd22hs9cl8frh9-0000000000-0000000000.tiff`. Each `.tiff` has a matching `.vrt`. — [Source Coop AEF data listing](https://data.source.coop/tge-labs/aef/)
- The open-source `aef-loader` lazily loads AEF COGs from Source Coop or GCS as VirtualiZarr datatrees. — [GitHub: Geethen/aef-loader](https://github.com/Geethen/aef-loader)
- Element 84 has published exploratory work on AlphaEarth embeddings. — [Element 84: Exploring AlphaEarth Embeddings](https://element84.com/machine-learning/exploring-alphaearth-embeddings/)
- **TESSERA:** 128-d per 10 m pixel, annual, fused Sentinel-1 and Sentinel-2. Int8 quantization gives about 4× storage reduction. The AWS registry lists 2017–2024 (rolling) with a CC-BY-SA license. A v2 model reduces v1's striping and tile seams. — [TESSERA paper arXiv 2506.20380](https://arxiv.org/pdf/2506.20380); [AWS Registry: TESSERA](https://registry.opendata.aws/tessera/); [TESSERA v2 arXiv 2607.03949](https://arxiv.org/pdf/2607.03949)
- **Clay and Major TOM:** Clay v1.5 produces 1024-d patch embeddings distributed as GeoParquet. Major TOM embeddings are patch-based from several backbones (for example S2 RGB DINOv2 and SigLIP), many RGB-only, released under CC-BY-SA-4.0. — [Earth Embeddings as Products, arXiv 2601.13134](https://arxiv.org/pdf/2601.13134); [Major TOM embeddings, arXiv 2412.05600](https://arxiv.org/pdf/2412.05600)
- **Benchmarks:**
  - In an urban-indicator study, AlphaEarth outperformed Prithvi and Clay on most indicators. — [arXiv 2604.03456](https://arxiv.org/pdf/2604.03456)
  - The TESSERA v2 paper reports mixed TESSERA-versus-AEF results depending on the test suite: 0.614 vs 0.590 on its own held-out suite, and 0.541 vs 0.560 on AEF's suite. — [arXiv 2607.03949](https://arxiv.org/pdf/2607.03949)
  - A 2026 study reports that annual EO embeddings encode wildfire disturbance and simplify burned-area mapping. — [arXiv 2609.25731](https://arxiv.org/pdf/2609.25731)

### Inferences
- **Ranking for "find dumps in arid Jodhpur at district scale within 3.5 days":**
  1. **Earth Genome SSL4EO or SoftCon Parquet:** vector-ready, fastest to index, 320 m granularity.
  2. **AlphaEarth from Source Coop:** best spatial detail at 10 m and multi-year (2017–2025), so a "year X vs year Y" change score per pixel is possible. Needs windowed COG reads, flip handling, and either aggregation to 50–100 m cells before indexing or brute-force dot products over a raster window. The district is about 2.3 × 10⁸ pixels × 64 bytes ≈ 15 GB raw, too big for naive k-NN indexing. Doing it in Earth Engine is easier but moves compute off AWS.
  3. **TESSERA:** similar to AEF, but the share-alike license is a consideration for a public app.
  4. **Clay, Major TOM, Prithvi:** no advantage here. Prithvi would require running the model yourself.
- **Hybrid option:** Use Earth Genome vectors for the district-wide hotspot map, then refine the top hits with AEF 10 m similarity or Sentinel-2 imagery inside each 320 m cell.

### Gaps
- No benchmark was found that compares any of these embeddings for landfill or dumpsite retrieval.
- AEF's 2025 layer is present on Source Coop, but the Earth Engine catalog still says 2017–2024. Whether 2025 is an official Google release was not confirmed.
- The AEF GCS "provider pays" status conflicts with older third-party descriptions of the bucket as requester-pays.

## 5. Published research: dumpsite and landfill detection, methane, Landsat thermal

### Takeaway
Reliable dumpsite detection in the literature mostly uses 0.2–1 m imagery. Sentinel-2 studies report moderate accuracy (IoU about 0.6–0.7, F1 about 0.8) in single regions, with poor results on small sites. Global Plastic Watch shows Sentinel-2 can find large waste aggregations at scale in Southeast Asia. Landfill methane has been detected from space over Delhi and Mumbai with GHGSat and TROPOMI, and over Gujarat landfills with EMIT. A Jodhpur-specific methane plume is unconfirmed, so methane is a risky "wow" add-on.

### Cited Findings
- **Sun et al. 2023 (Nature Communications):** about 2,500 dumpsites annotated in about 4,800 km² of 0.3–1 m imagery. The model found nearly 1,000 dumpsites that appeared around 2021 in sampled areas of 28 cities, and cut investigation time by more than 96.8%. — [Nature Communications 2023](https://www.nature.com/articles/s41467-023-37136-1)
- **Global Plastic Watch (PLoS ONE 2023):** a neural network on Sentinel-2 spectral, spatial and temporal features. It found 374 waste aggregations in Indonesia, more than double the public databases, and 996 confirmed sites across 12 Southeast Asian countries (press releases say 966). No precision or recall figures were found. — [arXiv 2204.01485](https://arxiv.org/pdf/2204.01485); [DOAJ record PLoS ONE e0278997](https://doaj.org/article/94c3de079b1f4695a43af2916c103f0d)
- **AerialWaste (Scientific Data 2023):** Lombardy, Italy, annotated with ARPA Lombardia. 10,434 images (3,478 positive, 6,956 negative) from AGEA orthophotos (about 20 cm), WorldView-3 (about 30 cm) and Google Earth (about 50 cm). It includes 22 waste categories on a subset. — [AerialWaste, PMC9889343](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9889343/)
- **AerialWaste follow-ups:** Politecnico reports about 90% accuracy. A comparative study found that heavy models overfit. — [Politecnico di Milano news](https://www.polimi.it/en/the-politecnico/news/news-detail/ai-and-satellites-to-detect-illegal-landfills-with-90-accuracy); [arXiv 2508.18315](https://arxiv.org/pdf/2508.18315)
- **Sentinel-2 dumpsite segmentation (conference work):** XGBoost reached an average F1 of 0.83 and IoU of 0.70 on an illegal-dumpsite dataset. A U-Net on 10 m Sentinel-2 reached IoU of about 0.63 with only 81 annotated dumps. The search results did not cleanly tie these two figures to individual papers, so verify before quoting. — [AOB/CSST 2026 abstract](https://www.aob.rs/images/doi/konferencije/2026/PDF/2026-1csst/55-56.pdf); [AOB/CSST: comparative deep learning, Sentinel-2](https://www.aob.rs/en/publishing-en/doi/books-and-special-issues/1284-10-69646-1csst33)
- **Pleiades micro-dumps (IEEE Access 2024):** about 90% detection rate with about 40% false discovery rate. — [IEEE Access 2024 (ADS)](https://ui.adsabs.harvard.edu/abs/2024IEEEA..1279585M/abstract)
- **Sentinel-2 mine waste:** YOLOv7 reached 81% AP for detection. — [Remote Sensing 2023](https://doi.org/10.3390/rs15204949)
- **Methane (Maasakkers et al. 2022, Science Advances):** TROPOMI finds hotspots, then GHGSat pinpoints landfills. It covers strongly emitting landfills (3–29 t/h) in Delhi and Mumbai, with GHGSat plumes from Ghazipur (Delhi) and Kanjurmarg (Mumbai). Landfills are 6–50% of city emissions, and city totals are 1.4–2.6× higher than inventories. — [Science Advances abn9683](https://www.science.org/doi/10.1126/sciadv.abn9683)
- **Methane (EMIT over India, 2024):** 17 plumes, of which 4 are in Rajasthan. The largest was a Maharashtra sewage outlet (about 6,203 kg/h), followed by the Pirana (Ahmedabad) and Khajod (Surat) landfills. EMIT is about 60 m. TROPOMI is suited to regional, not point, monitoring. The study used the Carbon Mapper portal. — [J. Indian Soc. Remote Sensing 2024](https://link.springer.com/article/10.1007/s12524-024-01925-y)
- **GHGSat:** detection limit about 100 kg/h. A global survey covered 151 waste sites. — [ResearchGate: Global satellite survey of landfill methane](https://www.researchgate.net/publication/397313929_Global_satellite_survey_reveals_uncertainty_in_landfill_methane_emissions)
- **Carbon Mapper:** Tanager-1 launched August 2024, and Carbon Mapper runs a public data portal. — [Waste Dive](https://www.wastedive.com/news/landfill-methane-satellites-ghgsat-carbon-mapper-launch/734953/)
- **Landsat thermal:** hot spots in about 17 years of Landsat imagery matched known subsurface fire locations at the Bridgeton landfill (Missouri). — [Applied Sciences 2020 (DOAJ)](https://doaj.org/article/b74d6247840643218a7de730323bcd09)
- **Landsat thermal limits:** a coal-waste dump study found winter Landsat detects anomalies of about 1 °C a few pixels across, but some scenes lacked contrast. — [arXiv 2601.11603](https://arxiv.org/pdf/2601.11603)

### Inferences
- Saboot's honest framing is "satellite evidence that a large site exists and changed", not "AI detects dumps". The literature supports Sentinel-2 for large sites only.
- **Methane:** Checking the Carbon Mapper portal for plumes near Jodhpur (Keru) takes about 30 minutes. Show plumes only if one exists. Otherwise, mentioning the capability is enough. Do not build a TROPOMI pipeline in 3.5 days, since its about 5.5 × 7 km pixels cannot attribute emissions to a single dump.
- **Landsat thermal:** Landsat 8/9 TIRS (100 m, resampled to 30 m, on Earth Search as `landsat-c2-l2`) could add a "surface hotter than surroundings" layer for smouldering dumps. This is a stretch goal with uncertain signal in the hot desert, where bare ground is already hot.

### Gaps
- No India-specific or arid-region Sentinel-2 dumpsite detection accuracy study was found.
- Sun et al.'s precision and recall were not retrieved.
- No Carbon Mapper, EMIT or GHGSat plume over Jodhpur was confirmed. The 4 Rajasthan EMIT plumes were not located.

## 6. Free higher-resolution historical imagery to complement Sentinel-2

### Takeaway
No free high-resolution source is both historical and cleanly licensed for a public app in India.
- **Esri Wayback:** the most practical for "view dated high-res snapshots". Display it as Esri-hosted tiles with attribution; do not export or cache them.
- **Planet NICFI:** ended January 2025.
- **Bhuvan:** restrictive terms.
- **Google Earth historical:** no embeddable free API.
- **Super-resolution such as SEN2SR:** produces plausible-looking detail that is not evidence.

### Cited Findings
- Esri World Imagery is under the Esri Master License Agreement and is not intended for exporting tiles for offline use. — [ArcGIS: World Imagery item](https://goto.arcgis.com/maps/World_Imagery)
- Esri grants OpenStreetMap a non-exclusive permission to trace. Other uses fall under Esri's agreements, and ownership stays with Esri and its contributors. — [OSM Wiki: Esri](https://wiki.openstreetmap.org/wiki/Esri)
- The OpenHistoricalMap community believes tracing from Wayback is allowed. A forum poster suggested non-Esri use may need an ArcGIS subscription, with uncertainty. — [OHM forum](https://forum.openhistoricalmap.org/t/esri-world-imagery-wayback/381); [Global Mapper forum](https://www.globalmapperforum.com/discussion/10809/world-imagery-usage-license-information)
- **Planet NICFI tropical mosaics:** these left the program on January 24, 2025. Existing users got temporary access, and Planet points to its non-commercial Tropical Forest Observatory. The original footprint was tropical forested regions between 30 N and 30 S. Earth Engine catalog dates extend to 2026 and conflict with this. — [Planet community: NICFI](https://community.planet.com/tropical-basemaps-85/nicfi-satellite-data-program-prolongs-public-access-to-high-resolution-rainforest-satellite-images-6020); [Earth Engine: NICFI Asia](https://developers.google.com/earth-engine/datasets/catalog/projects_planet-nicfi_assets_basemaps_asia?hl=en)
- **Bhuvan terms (as quoted by users):**
  - Non-exclusive and non-transferable license.
  - No commercial redistribution and no derivatives without written approval.
  - No bulk extraction.
  - Commercial access to high-resolution WMS goes through IN-SPACe.

  — [OSM Help: Bhuvan](https://help.openstreetmap.org/questions/77050/indian-government-mapping-system-bhuvan/); [Lok Sabha answer 2023](https://eparlib.nic.in/bitstream/123456789/1932570/1/AU4756.pdf)
- **SEN2SR (ESA OpenSR):** super-resolves Sentinel-2 to 2.5 m. The project ran June 2022 to December 2025. Super-resolution is ill-posed, because "multiple plausible high-resolution images may correspond to the same low-resolution observation". — [PyPI: sen2sr](https://pypi.org/project/sen2sr/); [ESA OpenSR project](https://cin.philab.esa.int/databases/projects/towards-explainable-ai-application-to-trustworthy-super-resolution-opensr-robust-accountable-super-resolution-for-sentinel-2-and-beyond); [arXiv 2605.13146](https://arxiv.org/pdf/2605.13146)

### Inferences
- **Esri Wayback:** For the demo, embed Esri World Imagery Wayback releases as attributed tile layers in MapLibre. Wayback exposes per-release WMTS tile URLs. This gives about 0.5 m dated snapshots, irregular in time, that can show roadside piles Sentinel-2 cannot. Do not download, cache or bake these tiles into the complaint PDF without checking Esri's terms. Use a link or screenshot with attribution, or confirm the terms first.
- **Google Earth historical:** link out ("open in Google Earth") rather than embed.
- **SEN2SR:** do not present super-resolved images as evidence in a legal complaint. At most, label them "AI-enhanced, illustrative".
- **NICFI:** Jodhpur at about 26.3 N is inside 30 N, but NICFI targeted tropical forest regions, and the program is over, so it is not a viable source.

### Gaps
- Esri's current Wayback-specific terms for public, non-commercial web apps were not retrieved from a primary Esri page.
- Google Earth historical imagery licensing for third-party apps was not researched in this pass.
- Whether NICFI ever covered the Thar or Jodhpur was not verified.

## 7. Known dumpsites and landfills near Jodhpur as demo seeds

### Takeaway
The main seed is the Keru municipal dumping yard and MSW processing plant, about 15 km west of the city on the Keru/NH125A side. Fires there are documented as recurring. Its exact polygon was not found in any source, so the team must confirm it visually in Sentinel-2 or Esri imagery. Keru is also a sandstone-quarry area, and quarry waste dumps there are both a seed for "lookalikes" and a major false-positive source.

### Cited Findings
- **IJERT 2014 (Choudhary et al., JIET Jodhpur), data sampled in 2013:**
  - The dump is at Keru, "15 KM away from the city", receiving "untreated 300-350 tonnes of MSW" daily.
  - The landfill is about 20 acres "behind the plant", and the plant area is 48 acres.
  - "On site fire in the land filled waste was seen, it was also informed that this happens many times a month."
  - The site has a 50 KL water tank for fires.
  - The dump is in the catchment of Kaylana lake and Umaid Sagar.
  - Roadside and low-lying-land dumping is common.

  — [IJERT: Management of Solid Waste in Jodhpur](https://www.ijert.org/management-of-solid-waste-in-jodhpur-current-status-and-innovative-approach)
- The Keru processing plant (UPL Environmental Engineers, 200 TPD, commissioned February 2012) is reported by RSPCB as "not operating effectively". Jodhpur is administered by Jodhpur Nagar Nigam North and South. — [AIJRA 2023, Dr. Anupam Jain](https://www.ijcms2015.co/file/2023/aijra-vol-8-issue-4/aijra-vol-8-issue-4-9.pdf)
- Nominatim places "PHC, Keru, NH125A" at 26.34842 N, 72.87410 E. This is the village, not the dump. — [Nominatim query](https://nominatim.openstreetmap.org/search?q=Keru,+Jodhpur,+Rajasthan&format=json&limit=3)
- **Keru quarrying:** the quarrying footprint grew about 4.55× from 1990 to 2016, with waste dump sites appearing after 2007, mapped from Google Earth time series (Singhal and Goel 2020). — [Tampere Univ. repository record](https://trepo.tuni.fi/handle/10024/219814); [ResearchGate: Sandstone quarrying at Keru](https://www.researchgate.net/publication/342611080_Environmental_Impacts_of_Sandstone_Quarrying_at_Keru_Jodhpur_Rajasthan)
- (live check 2026-10-08) **FIRMS near Keru:** VIIRS S-NPP 2024 recorded 4 detections within 5 km of Keru village, at about 26.361–26.368 N, 72.906–72.914 E and 26.316 N, 72.899 E, on 9 October, 31 October and 29 December 2024. These are candidate pixels for the Keru dump area and need visual confirmation. — [FIRMS 2024 India VIIRS CSV](https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2024/viirs-snpp_2024_India.csv)

### Inferences
- **Demo seed plan:**
  1. On day 1, spend 30 minutes in Esri imagery and Sentinel-2 to digitize the Keru dump polygon. Start around 26.36 N, 72.90 E, between Keru village and the city along the Keru road, where the FIRMS hits cluster.
  2. Add 2–4 further seeds by eye: other open dumping grounds of nearby ULBs in the district (for example Phalodi, Bilara, Pipar City) or visible informal city-edge dumps. Plus 2–3 negative examples: quarry spoil, a brick kiln, bare desert.
  3. Use the negatives to show the lookalike filter is not "anything bare".
- The Keru-to-Kaylana catchment link is a strong narrative point for the complaint draft: a dump in a drinking-water catchment.

### Gaps
- No published coordinates or polygon for the Keru dumping yard were found.
- An OpenStreetMap Overpass query for `landuse=landfill` around Jodhpur failed (server errors). The team should rerun it.
- No 2025–2026 news on Keru fires or biomining or remediation was found.
- No list of other official dumpsites in Jodhpur district (for example from SBM-U legacy-waste dashboards) was found.

## 8. Feasibility verdicts for a 3.5-day build: risks and fallbacks

### Takeaway
- **History (Sentinel-2):** high feasibility.
- **Fires (FIRMS):** high feasibility to build, but low evidentiary strength for small dump fires.
- **Lookalikes (embeddings and k-NN):** medium feasibility, technically easy, but results are unvalidated and will contain many quarry and bare-ground confounders.

Build history and fires first, and treat lookalikes as a curated demo.

### Cited Findings
- **Sentinel-2:** public HTTPS COGs; about 4-day revisit at Jodhpur; clear October–May; cloudy July–August; C1 gap in 2022; legacy collection is complete. — [Earth Search STAC (live check 2026-10-08)](https://earth-search.aws.element84.com/v1/search)
- **FIRMS:** 5-day maximum per area call; 5,000 transactions per 10 minutes; NRT within 3 hours; yearly CSVs keyless with 2025 not yet published; 49% of 2024 Jodhpur-box detections are static `type=2`. — [FIRMS Area API](https://firms.modaps.eosdis.nasa.gov/api/area/); [FIRMS FAQ](https://www.earthdata.nasa.gov/data/tools/firms/faq); [FIRMS 2024 India CSV](https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/2024/viirs-snpp_2024_India.csv)
- **Earth Genome:** 384-d float32 GeoParquet at about 480 MB per tile; about 235k vectors per tile; 50% overlapping 320 m chips; public; CC-BY-4.0; two incompatible models (SoftCon 2024; SSL4EO 2024–2026). — [Source Coop](https://source.coop/earthgenome/earthindexembeddings); [Earth Genome STAC](https://stac.earthgenome.org/collections/ssl4eo_yearly_embeddings)

### Inferences
- **(a) History: verdict GO (about 1 person-day).**
  - **Risks:** monsoon clouds; duplicate Items from the 43RBK/43RCK overlap; the C1 2022 gap; Lambda cold start plus COG range-read latency (a dozen dates can take more than 10 s); Copernicus attribution needed ("Contains modified Copernicus Sentinel data [year]").
  - **Fallback:** pre-render monthly October–May frames and the GIF for seed sites into S3. Serve cached PNGs. Live mode only for new pins, capped at about 12 frames. Add Copernicus Browser and Esri Wayback deep links.
- **(b) Fires: verdict GO (about 0.5 person-day).**
  - **Risks:** a MAP_KEY is needed for anything after 2024; NRT lacks `type`; misses small or evening fires; industrial, kiln and crop-residue hits near pins; positional uncertainty of 375 m to 1 km.
  - **Fallback:** ingest the 2012–2024 VIIRS and 2000–2024 MODIS yearly CSVs once into S3/Athena, keyless. Show counts within 500 m and 1 km with dates and confidence. Label `type=2` as "likely industrial heat source". Phrase results as "thermal anomalies recorded near this location".
- **(c) Lookalikes: verdict CONDITIONAL GO (about 1–1.5 person-days).**
  - **Risks:**
    - Not validated for dumps.
    - The 320 m chip dilutes small dumps.
    - Annual composites hide timing.
    - Confounders: sandstone quarries and spoil around Keru and the city, bare desert, kilns, construction.
    - Mixing SoftCon and SSL4EO vectors.
    - The OpenSearch domain takes about 15–20 minutes to provision.
    - EMR Serverless setup and IAM eat time.
  - **Fallback:**
    1. Download the 4–6 tiles. Use DuckDB, or a small PySpark job, to clip to the district and write Parquet.
    2. Compute top-K cosine similarity in NumPy against the mean of 2–4 positive seed vectors, minus negative-seed similarity.
    3. Precompute the hotspot GeoJSON for the demo. Load into OpenSearch k-NN only if time allows.
    4. Show the top 20 with Sentinel-2 chips for human review, labelled "visually similar sites, unverified".
  - **Upgrade if time remains:** re-rank the top hits with AlphaEarth 10 m similarity from Source Coop.
- **Overall recommendation:** Keep the architecture but cut scope risk. The single biggest demo risk is unvetted lookalike results showing quarries as "illegal dumps". Curate seeds and negatives, and show imagery beside every hit.

### Gaps
- Time estimates are judgment, not measured.
- OpenSearch k-NN and EMR Serverless provisioning times were not measured in this session.
