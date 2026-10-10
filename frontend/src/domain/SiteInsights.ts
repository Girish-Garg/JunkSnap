// Mirrors site.insights in contracts/schemas/site.schema.json (v1.1 and v1.4, decisions 20261010-0202 and -1430).

export type Material =
  | 'plastic'
  | 'organic'
  | 'construction_debris'
  | 'paper'
  | 'glass'
  | 'metal'
  | 'textile'
  | 'e_waste'
  | 'medical';

export type Hazard = 'burning' | 'medical_waste' | 'e_waste' | 'dead_animal' | 'chemicals';

export type SizeClass = 'small' | 'medium' | 'large';

export interface InsightSource {
  readonly signal: 'rekognition_labels' | 'yolo' | 'embedding_classifier' | 'vision_judge';
  readonly provider: 'bedrock' | 'openai' | 'openrouter' | 'rekognition' | 'comprehend' | 'junksnap';
  readonly model: string;
  readonly version: string;
}

export interface LayerSource {
  readonly source_url: string;
  readonly fetched_at: string;
  readonly page_sha256: string;
}

export interface SiteInsights {
  readonly reports: number;
  readonly composition: readonly {
    readonly material: Material;
    readonly share_pct: number;
    readonly reports: number;
    readonly sources: readonly InsightSource[];
  }[];
  readonly size_class: {
    readonly value: SizeClass;
    readonly reports: number;
    readonly sources: readonly InsightSource[];
  } | null;
  readonly hazards: readonly {
    readonly hazard: Hazard;
    readonly reports: number;
    readonly sources: readonly InsightSource[];
  }[];
  readonly near: readonly {
    readonly kind: 'school' | 'hospital' | 'water' | 'drain';
    readonly distance_m: number;
    readonly ref: string;
    readonly source: LayerSource;
  }[];
  /** v1.4: the nearest known bin or collection point; null when none is known. Absent on older rows. */
  readonly nearest_bin?: NearestBin | null;
  /** v1.4: true when no known bin lies within 3 km; null when bins are not mapped for the town. */
  readonly no_bin_within_3km?: boolean | null;
}

export interface NearestBin {
  readonly distance_m: number;
  readonly ref: string;
  readonly source: LayerSource;
}
