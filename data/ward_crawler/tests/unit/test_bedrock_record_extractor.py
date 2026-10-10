import json
from typing import Any

import pytest
from botocore.exceptions import ClientError
from fakes import make_city

from ward_crawler.adapters.answer_parser import AnswerParser
from ward_crawler.adapters.bedrock_record_extractor import BedrockRecordExtractor, ModelChoice
from ward_crawler.adapters.extraction_prompt import ExtractionPrompt
from ward_crawler.domain.errors import ExtractionError
from ward_crawler.domain.extraction import ExtractionRequest
from ward_crawler.domain.sources import Source

SONNET = ModelChoice("global.anthropic.claude-sonnet-4-6", "anthropic.claude-sonnet-4-6", 3, 15)
HAIKU = ModelChoice("in.anthropic.claude-haiku-4-5-20251001-v1:0", "haiku-4-5", 1, 5)
NOVA = ModelChoice("apac.amazon.nova-pro-v1:0", "amazon.nova-pro-v1:0", 0.8, 3.2)
GOOD = json.dumps(
    {
        "wards": [
            {
                "body": "jodhpur-uttar-mc",
                "ward_number": 12,
                "evidence": "Ward 12 | Paota",
                "zone": "North",
            }
        ]
    }
)


class FakeBedrockClient:
    """Plays back answers per model; an Exception in the list is raised instead."""

    def __init__(self, answers: dict[str, list[str | Exception]]) -> None:
        self._answers = answers
        self.calls: list[dict[str, Any]] = []

    def converse(self, **request: Any) -> dict[str, Any]:
        self.calls.append(request)
        answer = self._answers[request["modelId"]].pop(0)
        if isinstance(answer, Exception):
            raise answer
        return {
            "output": {"message": {"role": "assistant", "content": [{"text": answer}]}},
            "stopReason": "end_turn",
            "usage": {"inputTokens": 1000, "outputTokens": 100, "totalTokens": 1100},
        }


def extractor(client: FakeBedrockClient) -> BedrockRecordExtractor:
    models = (SONNET, HAIKU, NOVA)
    return BedrockRecordExtractor(client, models, ExtractionPrompt(), AnswerParser())  # type: ignore[arg-type]


def request() -> ExtractionRequest:
    city = make_city()
    source = Source("https://lsg.rajasthan.gov.in/wards.html", "ward list", "jodhpur-uttar-mc")
    return ExtractionRequest(city.city, city.bodies, source, "Ward 12 | Paota | North")


def denied() -> ClientError:
    error = {"Error": {"Code": "ResourceNotFoundException", "Message": "use case form"}}
    return ClientError(error, "Converse")  # type: ignore[arg-type]


def test_valid_answer_from_first_model_is_parsed_and_attributed() -> None:
    client = FakeBedrockClient({SONNET.model_id: [GOOD]})

    extraction = extractor(client).extract(request())

    assert extraction.model.model == SONNET.model_id
    assert extraction.model.version == "anthropic.claude-sonnet-4-6"
    assert extraction.wards[0].ward_number == 12
    assert extraction.wards[0].facts == {"zone": "North"}
    assert client.calls[0]["inferenceConfig"]["temperature"] == 0


def test_bad_answer_is_retried_once_then_the_next_model_answers() -> None:
    client = FakeBedrockClient(
        {SONNET.model_id: ["not json at all", '{"wards": "nope"}'], HAIKU.model_id: [GOOD]}
    )
    subject = extractor(client)

    extraction = subject.extract(request())

    assert extraction.model.model == HAIKU.model_id
    assert [call["modelId"] for call in client.calls] == [SONNET.model_id] * 2 + [HAIKU.model_id]
    retry_messages = client.calls[1]["messages"]
    assert [message["role"] for message in retry_messages] == ["user", "assistant", "user"]
    outcomes = [call.outcome for call in subject.usage()]
    assert outcomes == ["invalid answer", "invalid answer", "end_turn"]


def test_a_retry_that_fixes_the_answer_keeps_the_same_model() -> None:
    client = FakeBedrockClient({SONNET.model_id: ["```json\n{oops", GOOD]})

    extraction = extractor(client).extract(request())

    assert extraction.model.model == SONNET.model_id
    assert len(client.calls) == 2


def test_a_model_the_account_cannot_use_falls_through_to_the_next() -> None:
    client = FakeBedrockClient(
        {SONNET.model_id: [denied()], HAIKU.model_id: [denied()], NOVA.model_id: [GOOD]}
    )
    subject = extractor(client)

    extraction = subject.extract(request())

    assert extraction.model.model == NOVA.model_id
    assert subject.usage()[0].outcome.startswith("error:")
    assert subject.usage()[-1].cost_usd == pytest.approx((1000 * 0.8 + 100 * 3.2) / 1_000_000)


def test_no_valid_answer_from_any_model_raises() -> None:
    bad = ["{}", "{}"]
    client = FakeBedrockClient(
        {SONNET.model_id: list(bad), HAIKU.model_id: list(bad), NOVA.model_id: list(bad)}
    )

    with pytest.raises(ExtractionError, match="no model gave a valid answer"):
        extractor(client).extract(request())
    assert len(client.calls) == 6


def test_a_model_without_access_is_skipped_for_later_pages() -> None:
    client = FakeBedrockClient({SONNET.model_id: [denied()], HAIKU.model_id: [GOOD, GOOD]})
    subject = extractor(client)

    subject.extract(request())
    subject.extract(request())

    assert [call["modelId"] for call in client.calls] == [SONNET.model_id] + [HAIKU.model_id] * 2
