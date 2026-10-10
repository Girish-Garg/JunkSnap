"""Machine-made boxes for classes no open dataset boxes: waste piles and bins on India photos."""

from __future__ import annotations

import json
import logging
from collections.abc import Iterable
from pathlib import Path

from training.domain import Box, ManifestRow
from training.learn.domain import QueryHit, TeacherPrompt, TeacherRecord
from training.learn.ports import BoxTeacher
from training.ports import ObjectStore
from training.utils import s3_key

LOG = logging.getLogger(__name__)
TEACHER_FILE = "teacher_boxes.jsonl"

# Thresholds picked by eye on a few train photos; boxes are spot-checked, not hand-drawn.
PROMPTS = (
    TeacherPrompt(
        "waste_pile",
        ("a pile of garbage", "a heap of rubbish", "garbage dumped on the ground"),
        min_score=0.3,
        report_types=("waste_dump",),
        min_best=0.15,
    ),
    TeacherPrompt("bin", ("a garbage bin", "a dustbin", "a dumpster"), min_score=0.3),
)
NESTED_SHARE = 0.8


class TeacherBoxFile:
    """`<cache>/<source>/teacher_boxes.jsonl`, mirrored to `datasets/<source>/` in S3."""

    def __init__(self, cache: Path, source: str) -> None:
        self._source = source
        self._path = cache / source / TEACHER_FILE

    def write(self, records: list[TeacherRecord], store: ObjectStore) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        lines = (json.dumps(r.to_json(), sort_keys=True) for r in records)
        self._path.write_text("".join(f"{line}\n" for line in lines), encoding="utf-8")
        store.upload_file(self._path, s3_key(f"{self._source}/{TEACHER_FILE}"))

    def boxes(self, store: ObjectStore) -> dict[str, tuple[Box, ...]]:
        if self._path.exists():
            text = self._path.read_text(encoding="utf-8")
        else:
            data = store.read(s3_key(f"{self._source}/{TEACHER_FILE}"))
            text = data.decode("utf-8") if data else ""
        records = [TeacherRecord.from_json(json.loads(line)) for line in text.splitlines() if line]
        return {r.image_id: r.boxes for r in records}


class TeacherLabeller:
    def __init__(
        self, teacher: BoxTeacher, cache: Path, prompts: tuple[TeacherPrompt, ...] = PROMPTS
    ) -> None:
        self._teacher = teacher
        self._cache = cache
        self._prompts = prompts

    def label(self, rows: Iterable[ManifestRow]) -> list[TeacherRecord]:
        records = []
        for count, row in enumerate(rows, start=1):
            records.append(self._record(row))
            if count % 200 == 0:
                LOG.info("teacher: %d photos", count)
        return records

    def _record(self, row: ManifestRow) -> TeacherRecord:
        boxes: list[Box] = []
        scores: list[float] = []
        for prompt in (p for p in self._prompts if p.wanted_for(row.report_type)):
            hits = self._teacher.hits(self._cache / str(row.local_path), prompt.queries)
            for hit in self._kept(hits, prompt):
                boxes.append(Box(prompt.label, hit.box.x, hit.box.y, hit.box.w, hit.box.h))
                scores.append(hit.score)
        return TeacherRecord(row.id, self._teacher.model, tuple(boxes), tuple(scores))

    @staticmethod
    def _kept(hits: list[QueryHit], prompt: TeacherPrompt) -> list[QueryHit]:
        """Confident boxes, else the best one where people saw the class; nested ones dropped."""
        ranked = sorted(hits, key=lambda hit: -hit.score)
        kept = [hit for hit in ranked if hit.score >= prompt.min_score]
        if not kept and ranked and prompt.min_best is not None:
            kept = [hit for hit in ranked[:1] if hit.score >= prompt.min_best]
        return [
            hit for i, hit in enumerate(kept)
            if all(hit.box.share_inside(k.box) < NESTED_SHARE for k in kept[:i])
        ]
