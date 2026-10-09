# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Check data/rules: stored texts match their SHA-256, quotes are word for word on their page."""

import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
RULES_DIR = ROOT / "data" / "rules"
SCHEMAS = ROOT / "contracts" / "schemas"
PAGE_MARKER = re.compile(r"^=== PDF page (\d+) ===$", re.MULTILINE)
RULE_ID = re.compile(r"^[a-z0-9-]{1,64}$")
EXTRA_TAGS = {"burning", "packaging"}
REVIEW_STATUSES = {"unreviewed", "checked"}
RULE_FIELDS = (
    "rule_id",
    "document",
    "clause",
    "exact_text",
    "page",
    "language",
    "text_file",
    "source_url",
    "source_sha256",
    "situation_tags",
    "channels",
    "review_status",
)
SHARED_FIELDS = ("document", "language", "source_url", "source_sha256")

Json = dict[str, Any]


def words(text: str) -> str:
    """PDF line breaks are layout, not words: any whitespace run compares as one space."""
    return " ".join(text.split())


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


class Vocabulary:
    def __init__(self) -> None:
        site = load_json(SCHEMAS / "site.schema.json")["properties"]["properties"]["properties"]
        letter = load_json(SCHEMAS / "letter_draft.schema.json")["properties"]
        self.report_types = set(site["report_type"]["enum"])
        self.tags = self.report_types | set(site["context"]["enum"]) | EXTRA_TAGS
        self.channels = set(letter["channel"]["enum"])


class StoredText:
    def __init__(self, entry: Json, errors: list[str]) -> None:
        self.entry = entry
        name = entry["text_file"]
        data = (RULES_DIR / name).read_bytes()
        actual = hashlib.sha256(data).hexdigest()
        if actual != entry["text_sha256"]:
            errors.append(f"{name}: sha256 {actual} does not match text_sha256")
        parts = PAGE_MARKER.split(data.decode("utf-8"))
        self.pages = {int(n): words(body) for n, body in zip(parts[1::2], parts[2::2], strict=True)}
        if sorted(self.pages) != entry["pages"]:
            errors.append(f"{name}: page markers {sorted(self.pages)} differ from pages")

    def pages_with(self, quote: str) -> list[int]:
        wanted = words(quote)
        return [number for number, text in self.pages.items() if wanted in text]


def check_fields(rule: Json, texts: dict[str, StoredText], errors: list[str]) -> StoredText | None:
    where = f"rule {rule.get('rule_id', '?')}"
    missing = [field for field in RULE_FIELDS if field not in rule]
    if missing:
        errors.append(f"{where}: missing {', '.join(missing)}")
        return None
    if not RULE_ID.match(rule["rule_id"]):
        errors.append(f"{where}: rule_id must match {RULE_ID.pattern}")
    if rule["review_status"] not in REVIEW_STATUSES:
        errors.append(f"{where}: review_status must be one of {sorted(REVIEW_STATUSES)}")
    text = texts.get(rule["text_file"])
    if text is None:
        errors.append(f"{where}: unknown text_file {rule['text_file']}")
        return None
    for field in SHARED_FIELDS:
        if rule[field] != text.entry[field]:
            errors.append(f"{where}: {field} differs from its text entry")
    return text


def check_quote(rule: Json, text: StoredText, errors: list[str]) -> None:
    found = text.pages_with(rule["exact_text"])
    if rule["page"] in found:
        return
    hint = f"found on pages {found}" if found else "not found word for word"
    errors.append(f"rule {rule['rule_id']}: exact_text not on page {rule['page']} ({hint})")


def check_vocabulary(rule: Json, vocabulary: Vocabulary, errors: list[str]) -> None:
    where = f"rule {rule['rule_id']}"
    tags, channels = set(rule["situation_tags"]), set(rule["channels"])
    if not tags or tags - vocabulary.tags:
        errors.append(f"{where}: bad situation_tags {sorted(tags - vocabulary.tags)}")
    if not channels or channels - vocabulary.channels:
        errors.append(f"{where}: bad channels {sorted(channels - vocabulary.channels)}")


def check_rules(book: Json, vocabulary: Vocabulary, errors: list[str]) -> int:
    texts = {entry["text_file"]: StoredText(entry, errors) for entry in book["texts"]}
    seen: set[str] = set()
    for rule in book["rules"]:
        text = check_fields(rule, texts, errors)
        if text is None:
            continue
        if rule["rule_id"] in seen:
            errors.append(f"rule {rule['rule_id']}: duplicate rule_id")
        seen.add(rule["rule_id"])
        check_quote(rule, text, errors)
        check_vocabulary(rule, vocabulary, errors)
    return len(seen)


def check_routing(routing: Json, vocabulary: Vocabulary, errors: list[str]) -> None:
    names = sorted(channel["channel"] for channel in routing["channels"])
    expected = sorted(vocabulary.channels)
    if names != expected:
        errors.append(f"routing.json: channels {names} must be exactly {expected}")
    for channel in routing["channels"]:
        unknown = set(channel["report_types"]) - vocabulary.report_types
        if unknown:
            errors.append(f"routing.json: {channel['channel']} has unknown types {sorted(unknown)}")
    if routing["cc"]["marking"] != "for attention":
        errors.append('routing.json: cc marking must be "for attention"')


def main() -> int:
    errors: list[str] = []
    vocabulary = Vocabulary()
    book = load_json(RULES_DIR / "rules.json")
    count = check_rules(book, vocabulary, errors)
    check_routing(load_json(RULES_DIR / "routing.json"), vocabulary, errors)
    for error in errors:
        print(error)
    if errors:
        return 1
    print(
        f"data/rules: {len(book['texts'])} texts match their SHA-256, {count} of {count} quotes "
        "found word for word on their page, routing covers every channel"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
