"""Calls Bedrock for real; runs only with RUN_AWS_TESTS=1 (and AWS_PROFILE set)."""

import os

import boto3
import pytest

from ward_crawler.adapters.answer_parser import AnswerParser
from ward_crawler.adapters.bedrock_record_extractor import DEFAULT_MODELS, BedrockRecordExtractor
from ward_crawler.adapters.extraction_prompt import ExtractionPrompt
from ward_crawler.domain.extraction import ExtractionRequest
from ward_crawler.domain.sources import MunicipalBody, Source

pytestmark = pytest.mark.skipif(os.environ.get("RUN_AWS_TESTS") != "1", reason="needs AWS")


def test_some_bedrock_model_reads_a_ward_row() -> None:
    client = boto3.Session(region_name="ap-south-1").client("bedrock-runtime")
    extractor = BedrockRecordExtractor(client, DEFAULT_MODELS, ExtractionPrompt(), AnswerParser())
    source = Source("https://example.gov.in/wards", "ward list with population", "uttar")
    text = "Ward No. | Ward | Population\n12 | Paota | 9876\n"
    bodies = (MunicipalBody("uttar", "Nagar Nigam Jodhpur Uttar"),)

    extraction = extractor.extract(ExtractionRequest("jodhpur", bodies, source, text))

    assert [ward.ward_number for ward in extraction.wards] == [12]
    assert extraction.model.provider == "amazon-bedrock"
