"""Label Studio config for the field audit, and the reader for its JSON export."""

from __future__ import annotations

import posixpath
import urllib.parse
from typing import Any
from xml.sax.saxutils import quoteattr

from training.class_map import Vocabulary
from training.domain import Attributes, Box, ConfigError, ImageRecord
from training.utils import safe_stem

FIELD_SOURCE = "field"
BOX_COLOURS = ("#d62728", "#1f77b4", "#2ca02c", "#ff7f0e")
SINGLE = 'choice="single"'
REQUIRED = 'choice="single" required="true"'
MULTIPLE = 'choice="multiple"'
# Wording of $defs.size_class in contracts/schemas/verification_result.schema.json.
SIZE_HINTS = {"small": "fits in a bin bag", "medium": "up to a handcart", "large": "needs a truck"}


class LabelStudioConfig:
    def __init__(self, vocabulary: Vocabulary) -> None:
        self._vocab = vocabulary

    def xml(self) -> str:
        v = self._vocab
        parts = [
            '<View>',
            '  <Image name="image" value="$image" zoom="true" rotateControl="true"/>',
            *self._choices("report_type", "Report type", v.report_types, REQUIRED),
            *self._contexts(),
            *self._choices("burning", "Burning or smoke", ("no", "yes"), REQUIRED),
            *self._choices("materials", "Materials seen", v.materials, MULTIPLE),
            *self._choices("hazards", "Hazards", v.hazards, MULTIPLE),
            *self._choices("size_class", "Size of the pile", v.size_classes, SINGLE),
            '  <Header value="Readable brands, one per line (packaging only, never people)"/>',
            '  <TextArea name="brands" toName="image" rows="2" editable="true"/>',
            '  <Header value="Boxes: draw one per waste pile, bag, bin or fire"/>',
            '  <RectangleLabels name="boxes" toName="image">',
            *self._box_labels(),
            '  </RectangleLabels>',
            '</View>',
        ]
        return "\n".join(parts) + "\n"

    def _contexts(self) -> list[str]:
        lines = []
        for report_type, contexts in self._vocab.contexts.items():
            lines.append(
                '  <View visibleWhen="choice-selected" whenTagName="report_type" '
                f'whenChoiceValue={quoteattr(report_type)}>'
            )
            lines += self._choices(f"context_{report_type}", "Context", contexts, SINGLE)
            lines.append("  </View>")
        return lines

    @staticmethod
    def _choices(name: str, header: str, values: tuple[str, ...], mode: str) -> list[str]:
        return [
            f"  <Header value={quoteattr(header)}/>",
            f'  <Choices name="{name}" toName="image" {mode} showInline="true">',
            *(f"    <Choice value={quoteattr(value)}{LabelStudioConfig._hint(value)}/>"
              for value in values),
            "  </Choices>",
        ]

    @staticmethod
    def _hint(value: str) -> str:
        return f" hint={quoteattr(SIZE_HINTS[value])}" if value in SIZE_HINTS else ""

    def _box_labels(self) -> list[str]:
        pairs = zip(self._vocab.yolo_classes, BOX_COLOURS, strict=False)
        return [f'    <Label value="{name}" background="{colour}"/>' for name, colour in pairs]


class FieldExportReader:
    """Reads a Label Studio JSON export into field ImageRecords."""

    def __init__(self, vocabulary: Vocabulary) -> None:
        self._vocab = vocabulary

    def records(self, tasks: list[dict[str, Any]]) -> list[ImageRecord]:
        found = [self._record(task) for task in tasks]
        return [record for record in found if record is not None]

    def _record(self, task: dict[str, Any]) -> ImageRecord | None:
        done = [a for a in task.get("annotations", []) if not a.get("was_cancelled")]
        if not done:
            return None
        results = done[-1].get("result", [])
        image = str(task["data"]["image"])
        attrs = self._attributes(results)
        self._vocab.check_attributes(f"task {task.get('id')}", attrs)
        path = urllib.parse.unquote(urllib.parse.urlparse(image).path)
        stem = safe_stem(posixpath.basename(path) or image)
        boxes = self._boxes(results)
        group = self._group(task["data"])
        return ImageRecord(
            f"{FIELD_SOURCE}/{stem}", FIELD_SOURCE, image, (), boxes, attrs, group
        )

    @staticmethod
    def _group(data: dict[str, Any]) -> str | None:
        """Task data may carry `scan_id` or `site_id`; photos sharing one never straddle splits."""
        if data.get("scan_id"):
            return f"scan:{data['scan_id']}"
        if data.get("site_id"):
            return f"site:{data['site_id']}"
        return None

    def _attributes(self, results: list[dict[str, Any]]) -> Attributes:
        picked = self._choices(results)
        hazards = set(picked.get("hazards", ()))
        if "yes" in picked.get("burning", ()):
            hazards.add("burning")
        contexts = [v for k, vs in picked.items() if k.startswith("context") for v in vs]
        report_types = picked.get("report_type", ())
        if not report_types:
            raise ConfigError("an annotation has no report_type")
        return Attributes(
            report_type=report_types[0],
            context=contexts[0] if contexts else None,
            materials=tuple(m for m in self._vocab.materials if m in picked.get("materials", ())),
            hazards=tuple(h for h in self._vocab.hazards if h in hazards),
            size_class=next(iter(picked.get("size_class", ())), None),
            brands=self._brands(results),
        )

    @staticmethod
    def _choices(results: list[dict[str, Any]]) -> dict[str, tuple[str, ...]]:
        return {
            r["from_name"]: tuple(r["value"]["choices"])
            for r in results if r.get("type") == "choices"
        }

    @staticmethod
    def _brands(results: list[dict[str, Any]]) -> tuple[str, ...]:
        texts = [t for r in results if r.get("type") == "textarea" for t in r["value"]["text"]]
        lines = [line.strip() for text in texts for line in text.replace(",", "\n").split("\n")]
        return tuple(dict.fromkeys(line for line in lines if line))

    def _boxes(self, results: list[dict[str, Any]]) -> tuple[Box, ...]:
        boxes = []
        for r in results:
            if r.get("type") != "rectanglelabels":
                continue
            v = r["value"]
            box = Box(v["rectanglelabels"][0], v["x"] / 100, v["y"] / 100,
                      v["width"] / 100, v["height"] / 100).clipped()
            if box is None or box.label not in self._vocab.yolo_classes:
                raise ConfigError(f"bad box in export: {v}")
            boxes.append(box)
        return tuple(boxes)
