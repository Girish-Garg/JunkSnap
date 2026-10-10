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
from training.fetch import UPLOAD_WORKERS, Fetcher, RecordFile
from training.images import ImageNormaliser
from training.labelstudio import FIELD_SOURCE, FieldExportReader, LabelStudioConfig
from training.manifest import ManifestBuilder, ManifestFile
from training.ports import ObjectStore
from training.settings import Settings
from training.sources.base import SourceInfo
from training.sources.field import FieldExportSource, FieldPhotos, FieldRecordMerge
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
        self._print(manifest.write(rows, splitter.seed, args.force))

    def split(self, args: argparse.Namespace) -> None:
        manifest = self._manifest(self._stores.create(args.no_upload))
        splitter = Splitter(self._seed(args, manifest))
        self._print(manifest.write(splitter.assign(manifest.read()), splitter.seed, args.force))

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
        source = self._field_source(args, cache, store)
        records = Fetcher(cache, store, ImageNormaliser()).fetch(source, None)
        print(f"field: {len(records)} labelled photos")
        rows = splitter.assign(self._builder().build(store))
        self._print(manifest.write(rows, splitter.seed, args.force))

    def _field_source(
        self, args: argparse.Namespace, cache: Path, store: ObjectStore
    ) -> FieldExportSource:
        tasks = json.loads(Path(args.export).read_text(encoding="utf-8"))
        labelled = FieldExportReader(self._class_map().vocabulary).records(tasks)
        recorded = RecordFile(cache, FIELD_SOURCE)
        recorded.pull(store)
        kept = FieldRecordMerge(args.merge).kept(recorded.read(), labelled)
        info = SourceInfo(FIELD_SOURCE, FIELD_LICENCE, "Label Studio export")
        return FieldExportSource(info, labelled, kept, FieldPhotos(store, HttpDownloader()))

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


class CliParser:
    """Builds the argparse tree, one small method per group of subcommands."""

    def __init__(self) -> None:
        self._common = argparse.ArgumentParser(add_help=False)
        self._common.add_argument("--no-upload", action="store_true", help="keep files local")
        self._root = argparse.ArgumentParser(prog="training", description="JunkSnap dataset steps")
        self._sub = self._root.add_subparsers(dest="command", required=True)

    def build(self) -> argparse.ArgumentParser:
        self._fetch()
        self._manifest_steps()
        self._import_field()
        self._sub.add_parser("labelstudio-config").add_argument("--out", default=None)
        self._sub.add_parser("yolo-export", parents=[self._common]).add_argument(
            "--out", required=True
        )
        return self._root

    def _fetch(self) -> None:
        fetch = self._sub.add_parser("fetch", parents=[self._common])
        fetch.add_argument("sources", nargs="*")
        fetch.add_argument("--limit", type=int, default=None, help="images per source")

    def _manifest_steps(self) -> None:
        for name in ("build-manifest", "split", "import-field"):
            command = self._sub.add_parser(name, parents=[self._common])
            command.add_argument("--seed", type=int, default=None)
            command.add_argument(
                "--force", action="store_true", help="allow a new seed or dropping S3 manifest ids"
            )

    def _import_field(self) -> None:
        command = self._sub.choices["import-field"]
        command.add_argument("export", help="Label Studio JSON export of blurred copies")
        mode = command.add_mutually_exclusive_group()
        mode.add_argument("--keep-missing", dest="merge", action="store_const",
                          const="keep-missing", help="keep recorded photos the export lacks")
        mode.add_argument("--replace", dest="merge", action="store_const", const="replace",
                          help="drop recorded photos the export lacks")
        command.set_defaults(merge="strict")


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    logging.getLogger("urllib3").setLevel(logging.ERROR)
    args = CliParser().build().parse_args(argv)
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
