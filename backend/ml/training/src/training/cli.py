"""Command line: one subcommand per dataset step."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import boto3
from botocore.config import Config

from training.adapters import HttpDownloader, LocalOnlyStore, S3ObjectStore, StackBucketLocator
from training.catalogue import SourceCatalogue
from training.class_map import ClassMap
from training.domain import JunkSnapError
from training.fetch import UPLOAD_WORKERS, Fetcher, RecordFile
from training.images import ImageNormaliser
from training.labelstudio import FIELD_SOURCE, FieldExportReader, LabelStudioConfig
from training.manifest import ManifestBuilder, ManifestFile
from training.ports import ObjectStore
from training.settings import Settings
from training.split import DEFAULT_SEED, Splitter
from training.yolo import YoloExporter

LOG = logging.getLogger("training")


class Commands:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._catalogue = SourceCatalogue(HttpDownloader())

    def fetch(self, args: argparse.Namespace) -> None:
        cache = self._settings.require_cache()
        store = self._store(upload=not args.no_upload)
        fetcher = Fetcher(cache, store, ImageNormaliser())
        for name in args.sources or self._catalogue.names():
            records = fetcher.fetch(self._catalogue.get(name), args.limit)
            print(f"{name}: {len(records)} images, {store.uri(f'datasets/{name}/') or cache}")

    def build_manifest(self, _args: argparse.Namespace) -> None:
        rows = self._builder().build()
        self._print(self._manifest().write(rows))

    def split(self, args: argparse.Namespace) -> None:
        manifest = self._manifest()
        splitter = Splitter(args.seed)
        self._print(manifest.write(splitter.assign(manifest.read()), splitter.seed))

    def labelstudio_config(self, args: argparse.Namespace) -> None:
        out = Path(args.out) if args.out else self._settings.label_studio_path
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(LabelStudioConfig(self._class_map().vocabulary).xml(), encoding="utf-8")
        print(f"wrote {out}")

    def import_field(self, args: argparse.Namespace) -> None:
        tasks = json.loads(Path(args.export).read_text(encoding="utf-8"))
        records = FieldExportReader(self._class_map().vocabulary).records(tasks)
        RecordFile(self._settings.require_cache(), FIELD_SOURCE).write(records)
        splitter = Splitter(args.seed)
        rows = splitter.assign(self._builder().build())
        print(f"field: {len(records)} labelled photos")
        self._print(self._manifest().write(rows, splitter.seed))

    def yolo_export(self, args: argparse.Namespace) -> None:
        cache = self._settings.require_cache()
        exporter = YoloExporter(cache, self._class_map(), Path(args.out))
        counts = exporter.export(self._manifest().read())
        print(json.dumps(dict(sorted(counts.items())), indent=2))

    def _class_map(self) -> ClassMap:
        return ClassMap.load(self._settings.class_map_path)

    def _builder(self) -> ManifestBuilder:
        cache = self._settings.require_cache()
        return ManifestBuilder(cache, self._class_map(), self._catalogue.licences())

    def _manifest(self) -> ManifestFile:
        cache = self._settings.require_cache()
        return ManifestFile(cache, self._settings.datasets_dir, self._store(upload=True))

    def _store(self, upload: bool) -> ObjectStore:
        if not upload:
            return LocalOnlyStore()
        session = boto3.Session(region_name=self._settings.region)
        locator = StackBucketLocator(session.client("cloudformation"), self._settings.stack)
        bucket = locator.bucket()
        if bucket is None:
            LOG.warning("no bucket in stack %s: keeping files local", self._settings.stack)
            return LocalOnlyStore()
        config = Config(max_pool_connections=UPLOAD_WORKERS)
        return S3ObjectStore(session.client("s3", config=config), bucket)

    @staticmethod
    def _print(summary: dict[str, object]) -> None:
        print(json.dumps(summary, indent=2))


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="training", description="JunkSnap dataset steps")
    sub = root.add_subparsers(dest="command", required=True)
    fetch = sub.add_parser("fetch", help="download, normalise and upload datasets")
    fetch.add_argument("sources", nargs="*")
    fetch.add_argument("--limit", type=int, default=None, help="images per source")
    fetch.add_argument("--no-upload", action="store_true")
    sub.add_parser("build-manifest", help="write the manifest from fetched records")
    for name in ("split", "import-field"):
        command = sub.add_parser(name)
        command.add_argument("--seed", type=int, default=DEFAULT_SEED)
    sub.choices["import-field"].add_argument("export", help="Label Studio JSON export")
    sub.add_parser("labelstudio-config").add_argument("--out", default=None)
    sub.add_parser("yolo-export").add_argument("--out", required=True)
    return root


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    args = parser().parse_args(argv)
    try:
        commands = Commands(Settings.from_env(Path.cwd()))
        getattr(commands, args.command.replace("-", "_"))(args)
    except JunkSnapError as error:
        LOG.error("%s", error)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
