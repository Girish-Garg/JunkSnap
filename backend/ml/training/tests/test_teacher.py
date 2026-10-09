from pathlib import Path

from training.domain import Box, ManifestRow
from training.learn.domain import QueryHit, TeacherPrompt
from training.learn.ports import BoxTeacher
from training.learn.teacher import TeacherBoxFile, TeacherLabeller

PILE = TeacherPrompt("waste_pile", ("a pile",), 0.3, ("waste_dump",), min_best=0.15)
BIN = TeacherPrompt("bin", ("a bin",), 0.3)


class FakeTeacher(BoxTeacher):
    def __init__(self, hits: dict[str, list[QueryHit]]) -> None:
        self._hits = hits

    @property
    def model(self) -> str:
        return "fake-owl"

    def hits(self, image: Path, queries: tuple[str, ...]) -> list[QueryHit]:
        return self._hits.get(queries[0], [])


def hit(score: float, x: float = 0.1, w: float = 0.5) -> QueryHit:
    return QueryHit(0, Box("teacher", x, 0.1, w, 0.5), score)


def row(report_type: str) -> ManifestRow:
    return ManifestRow("qr4change/a", "qr4change", "CC-BY-4.0", None, "q/a.jpg", report_type)


def test_confident_piles_kept_and_boxes_inside_a_kept_box_dropped() -> None:
    inner = QueryHit(0, Box("teacher", 0.2, 0.2, 0.1, 0.1), 0.35)
    teacher = FakeTeacher({"a pile": [hit(0.5), inner, hit(0.2, x=0.7, w=0.2)]})
    record = TeacherLabeller(teacher, Path("."), (PILE,)).label([row("waste_dump")])[0]
    assert [b.label for b in record.boxes] == ["waste_pile"]
    assert record.scores == (0.5,) and record.model == "fake-owl"


def test_people_saw_waste_so_the_best_weak_box_is_kept() -> None:
    teacher = FakeTeacher({"a pile": [hit(0.18), hit(0.12, x=0.6, w=0.2)]})
    record = TeacherLabeller(teacher, Path("."), (PILE,)).label([row("waste_dump")])[0]
    assert record.scores == (0.18,)


def test_piles_only_on_waste_photos_but_bins_everywhere() -> None:
    teacher = FakeTeacher({"a pile": [hit(0.9)], "a bin": [hit(0.8), hit(0.1, x=0.6, w=0.2)]})
    record = TeacherLabeller(teacher, Path("."), (PILE, BIN)).label([row("not_waste")])[0]
    assert [b.label for b in record.boxes] == ["bin"]


def test_teacher_file_round_trips_through_the_store(tmp_path: Path, store) -> None:
    teacher = FakeTeacher({"a pile": [hit(0.5)]})
    records = TeacherLabeller(teacher, tmp_path, (PILE,)).label([row("waste_dump")])
    TeacherBoxFile(tmp_path, "qr4change").write(records, store)
    assert "datasets/qr4change/teacher_boxes.jsonl" in store.uploaded
    fresh = TeacherBoxFile(tmp_path / "elsewhere", "qr4change").boxes(store)
    assert fresh["qr4change/a"][0].label == "waste_pile"
