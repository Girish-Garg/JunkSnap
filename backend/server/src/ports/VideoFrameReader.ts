export interface VideoSize {
  readonly width: number;
  readonly height: number;
}

export interface ExtractedFrame {
  readonly tMs: number;
  readonly path: string;
}

export interface VideoFrameReader {
  // Throws InvalidVideoError when the file holds no readable video stream.
  probe(videoPath: string): Promise<VideoSize>;
  // Writes one JPEG per time into outDir; a time past the end of the video is left out.
  extract(videoPath: string, timesMs: readonly number[], outDir: string): Promise<ExtractedFrame[]>;
}
