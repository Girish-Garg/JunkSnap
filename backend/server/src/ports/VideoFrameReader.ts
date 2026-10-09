export interface VideoInfo {
  readonly width: number;
  readonly height: number;
  // Start of the last frame, read from the packet timestamps; MediaRecorder webm has no duration header.
  readonly lastFrameMs: number;
}

export interface ExtractedFrame {
  readonly tMs: number;
  readonly path: string;
}

export interface VideoFrameReader {
  // Throws InvalidVideoError when the file holds no readable video stream.
  probe(videoPath: string): Promise<VideoInfo>;
  // Times must be at or before lastFrameMs; a cut that fails or writes nothing throws ExternalServiceError.
  extract(videoPath: string, timesMs: readonly number[], outDir: string): Promise<ExtractedFrame[]>;
}
