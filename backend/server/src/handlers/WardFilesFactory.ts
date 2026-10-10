import { tmpdir } from "node:os";
import { join } from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import { DirectoryWardFiles } from "../adapters/wards/DirectoryWardFiles.js";
import { NewestWardFiles } from "../adapters/wards/NewestWardFiles.js";
import { S3CrawledWardFiles } from "../adapters/wards/S3CrawledWardFiles.js";
import type { Logger } from "../ports/Logger.js";
import type { WardFileSource } from "../ports/WardFileSource.js";

export interface WardFilePlaces {
  readonly assetsDir: string;
  readonly originalsBucket: string | null;
  readonly awsRegion: string;
}

const DOWNLOAD_DIR = join(tmpdir(), "junksnap-crawled-wards");

// The image's <ASSETS_DIR>/wards, plus the crawler's crawl/wards/ when the originals bucket is known; the newer file per city wins.
export class WardFilesFactory {
  create(places: WardFilePlaces, logger: Logger): WardFileSource {
    const image = new DirectoryWardFiles(join(places.assetsDir, "wards"));
    if (places.originalsBucket === null) {
      return image;
    }
    const s3 = new S3Client({ region: places.awsRegion });
    return new NewestWardFiles([image, new S3CrawledWardFiles(s3, places.originalsBucket, DOWNLOAD_DIR, logger)]);
  }
}
