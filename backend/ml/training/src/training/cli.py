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
from training.catalogue import FIELD_LICENCE, SourceCatalogue
from training.class_map import ClassMap
from training.domain import ConfigError, JunkSnapError
from training.fetch import UPLOAD_WORKERS, Fetcher
from training.images import ImageNormaliser
from training.labelstudio import FIELD_SOURCE, FieldExportReader, LabelStudioConfig
from training.manifest import ManifestBuilder, ManifestFile
from training.ports import ObjectStore
from training.settings import Settings
from training.sources.base import SourceInfo
from training.sources.field import FieldExportSource, FieldPhotos
from training.split import DEFAULT_SEED, Splitter
from training.yolo import YoloExporter

LOG = logging.getLogger("training")


class StoreFactory:
    """S3 unless --no-upload; a missing bucket is an error, never a quiet local fallback."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def create(self, no_upload: bool) -> ObjectStore:
        if no_upload:
            return LocalOnlyStore()
        session = boto3.Session(region_name=self._settings.region)
        bucket = self._settings.bucket or StackBucketLocator(
            session.client("cloudformation"), self._settings.stack
        ).bucket()
        config = Config(max_pool_connections=UPLOAD_WORKERS)
        return S3ObjectStore(session.client("s3", config=config), bucket)


class Commands:
    def __init__(self, settings: Settings, stores: StoreFactory) -> None:
        self._settings = settings
        self._stores = stores
        self._catalogue = SourceCatalogue(HttpDownloader())

    def fetch(self, args: argparse.Namespace) -> None:
        cache, store = self._settings.require_cache(), self._stores.create(args.no_upload)
        fetcher = Fetcher(cache, store, ImageNormaliser())
        for name in args.sources or self._catalogue.names():
            records = fetcher.fetch(self._catalogue.get(name), args.limit)
            print(f"{name}: {len(records)} images, {store.uri(f'datasets/{name}/') or cache}")

    def build_manifest(self, args: argparse.Namespace) -> None:
        store = self._stores.create(args.no_upload)
        manifest = self._manifest(store)
        splitter = Splitter(self._seed(args, manifest))
        rows = splitter.assign(self._builder().build(store))
        self._print(manifest.write(rows, splitter.seed))

    def split(self, args: argparse.Namespace) -> None:
        manifest = self._manifest(self._stores.create(args.no_upload))
        splitter = Splitter(self._seed(args, manifest))
        self._print(manifest.write(splitter.assign(manifest.read()), splitter.seed))

    def labelstudio_config(self, args: argparse.Namespace) -> None:
        out = Path(args.out) if args.out else self._settings.label_studio_path
        out.parent.mkdir(parents=True, exist_ok=True)
        xml = LabelStudioConfig(self._class_map().vocabulary).xml()
        out.write_text(xml, encoding="utf-8", newline="\n")
        print(f"wrote {out}")

    def import_field(self, args: argparse.Namespace) -> None:
        cache, store = self._settings.require_cache(), self._stores.create(args.no_upload)
        manifest = self._manifest(store)
        splitter = Splitter(self._seed(args, manifest))
        tasks = json.loads(Path(args.export).read_text(encoding="utf-8"))
        labelled = FieldExportReader(self._class_map().vocabulary).records(tasks)
        photos = FieldPhotos(store, Path(args.photos) if args.photos else None)
        info = SourceInfo(FIELD_SOURCE, FIELD_LICENCE, "Label Studio export")
        source = FieldExportSource(info, HttpDownloader(), labelled, photos)
        records = Fetcher(cache, store, ImageNormaliser()).fetch(source, None)
        print(f"field: {len(records)} labelled photos")
        rows = splitter.assign(self._builder().build(store))
        self._print(manifest.write(rows, splitter.seed))

    def yolo_export(self, args: argparse.Namespace) -> None:
        cache, store = self._settings.require_cache(), self._stores.create(args.no_upload)
        out = self._settings.outside_repo(Path(args.out))
        exporter = YoloExporter(cache, self._class_map(), store)
        counts = exporter.export(self._manifest(store).read(), out)
        print(json.dumps(dict(sorted(counts.items())), indent=2))

    def _seed(self, args: argparse.Namespace, manifest: ManifestFile) -> int:
        """Never moves a photo between splits by accident: a new seed needs --force."""
        recorded = manifest.recorded_seed()
        seed = args.seed if args.seed is not None else (recorded or DEFAULT_SEED)
        if recorded is not None and seed != recorded and not args.force:
            raise ConfigError(f"recorded split seed is {recorded}; pass --force to change it")
        return int(seed)

    def _class_map(self) -> ClassMap:
        return ClassMap.load(self._settings.class_map_path)

    def _builder(self) -> ManifestBuilder:
        cache = self._settings.require_cache()
        return ManifestBuilder(cache, self._class_map(), self._catalogue.licences())

    def _manifest(self, store: ObjectStore) -> ManifestFile:
        cache = self._settings.require_cache()
        return ManifestFile(cache, self._settings.datasets_dir, store)

    @staticmethod
    def _print(summary: dict[str, object]) -> None:
        print(json.dumps(summary, indent=2))


def parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--no-upload", action="store_true", help="keep files local, skip S3")
    root = argparse.ArgumentParser(prog="training", description="JunkSnap dataset steps")
    sub = root.add_subparsers(dest="command", required=True)
    fetch = sub.add_parser("fetch", parents=[common], help="download, normalise, upload")
    fetch.add_argument("sources", nargs="*")
    fetch.add_argument("--limit", type=int, default=None, help="images per source")
    for name in ("build-manifest", "split", "import-field"):
        command = sub.add_parser(name, parents=[common])
        command.add_argument("--seed", type=int, default=None)
        command.add_argument("--force", action="store_true", help="allow a new split seed")
    sub.choices["import-field"].add_argument("export", help="Label Studio JSON export")
    sub.choices["import-field"].add_argument("--photos", help="folder with non-S3 photos")
    sub.add_parser("labelstudio-config").add_argument("--out", default=None)
    sub.add_parser("yolo-export", parents=[common]).add_argument("--out", required=True)
    return root


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    logging.getLogger("urllib3").setLevel(logging.ERROR)
    args = parser().parse_args(argv)
    try:
        settings = Settings.from_env(Path.cwd())
        commands = Commands(settings, StoreFactory(settings))
        getattr(commands, args.command.replace("-", "_"))(args)
    except JunkSnapError as error:
        LOG.error("%s", error)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
