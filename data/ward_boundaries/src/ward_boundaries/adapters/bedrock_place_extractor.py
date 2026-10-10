"""Reads, from gazette boundary text, the places each ward is said to include (cached per chunk)."""

import hashlib
import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

from botocore.exceptions import BotoCoreError, ClientError

from ward_boundaries.domain.models import Document, WardText

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime import BedrockRuntimeClient

MODELS = (
    "global.anthropic.claude-sonnet-4-6",
    "in.anthropic.claude-haiku-4-5-20251001-v1:0",
    "apac.amazon.nova-pro-v1:0",
)
CHUNK_CHARS = 6000
PROMPT = """This is part of an official Rajasthan Gazette ward-formation order for {city}, in Hindi.
PDF extraction garbled some letters. Each ward entry starts with its ward number, describes its
boundary, and ends with its population.

For every ward entry in the text, list only the places the text says the ward contains or
includes (colonies, villages, dhanis, schemes, sectors, landmarks named as included, for example
after "सम्मिलित करते हुए" or "को शामिल करते हुए"). Do not list roads or places named only as
a boundary line. Write each place in Latin script as it would be spelled on a map (for example
"Vidhyadhar Nagar Sector 7", "Lalarpura"). Never invent places.

Reply with one JSON object only: {{"wards": [{{"ward": 1, "population": 18932, "places": [...]}}]}}

Text:
{text}"""


class BedrockPlaceExtractor:
    def __init__(self, client: "BedrockRuntimeClient", cache_dir: Path) -> None:
        self._client = client
        self._cache_dir = cache_dir
        self.used_models: set[str] = set()

    def wards(self, city: str, document: Document) -> dict[int, WardText]:
        found: dict[int, WardText] = {}
        for chunk in self._chunks(document.text):
            for item in self._answer(city, chunk).get("wards", []):
                number = item.get("ward")
                if isinstance(number, int) and number not in found:
                    places = tuple(str(name) for name in item.get("places", []) if name)
                    found[number] = WardText(number, places, item.get("population"), document)
        return found

    def _chunks(self, text: str) -> list[str]:
        chunks, current = [], ""
        for line in text.splitlines(keepends=True):
            if len(current) + len(line) > CHUNK_CHARS and current:
                chunks.append(current)
                current = ""
            current += line
        return [*chunks, current] if current.strip() else chunks

    def _answer(self, city: str, chunk: str) -> dict[str, Any]:
        path = self._cache_dir / f"places-{hashlib.sha256(chunk.encode()).hexdigest()[:20]}.json"
        if path.exists():
            saved: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
            return saved
        for model in MODELS:
            answer = self._converse(model, PROMPT.format(city=city, text=chunk))
            if answer is not None:
                self.used_models.add(model)
                self._cache_dir.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(answer, ensure_ascii=False), encoding="utf-8")
                return answer
        return {}

    def _converse(self, model: str, text: str) -> dict[str, Any] | None:
        try:
            response = self._client.converse(
                modelId=model,
                messages=[{"role": "user", "content": [{"text": text}]}],
                inferenceConfig={"maxTokens": 6000, "temperature": 0},
            )
        except (ClientError, BotoCoreError):
            return None
        blocks = response["output"].get("message", {}).get("content", [])
        reply = "".join(block.get("text", "") for block in blocks)
        try:
            parsed = json.loads(reply[reply.find("{") : reply.rfind("}") + 1])
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None
