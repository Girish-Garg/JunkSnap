"""Hindi locality names to the Latin spellings used on maps, by a Bedrock model (cached)."""

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

from botocore.exceptions import BotoCoreError, ClientError

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime import BedrockRuntimeClient

MODELS = (
    "global.anthropic.claude-sonnet-4-6",
    "in.anthropic.claude-haiku-4-5-20251001-v1:0",
    "apac.amazon.nova-pro-v1:0",
)
BATCH = 80
PROMPT = (
    "These are locality, colony and landmark names in {city}, India, written in Hindi. "
    "Give each the spelling most likely used on OpenStreetMap or Google Maps, in Latin script "
    "(for example 'शास्त्री नगर' -> 'Shastri Nagar', 'कमला नेहरू कॉलोनी' -> 'Kamla Nehru Colony'). "
    "Transliterate only; do not add or guess places. Reply with one JSON object that maps each "
    "input exactly as given to its spelling, and nothing else.\n\n{names}"
)


class BedrockTransliterator:
    def __init__(self, client: "BedrockRuntimeClient", cache_file: Path) -> None:
        self._client = client
        self._cache_file = cache_file
        self.used_models: set[str] = set()

    def english(self, city: str, names: list[str]) -> dict[str, str]:
        known: dict[str, str] = {}
        if self._cache_file.exists():
            known = json.loads(self._cache_file.read_text(encoding="utf-8"))
        missing = [name for name in dict.fromkeys(names) if name not in known]
        for start in range(0, len(missing), BATCH):
            known.update(self._ask(city, missing[start : start + BATCH]))
            self._cache_file.parent.mkdir(parents=True, exist_ok=True)
            self._cache_file.write_text(json.dumps(known, ensure_ascii=False), encoding="utf-8")
        return known

    def _ask(self, city: str, names: list[str]) -> dict[str, str]:
        text = PROMPT.format(city=city, names="\n".join(names))
        for model in MODELS:
            answer = self._converse(model, text)
            if answer is not None:
                self.used_models.add(model)
                return {key: str(value) for key, value in answer.items() if key in names}
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
