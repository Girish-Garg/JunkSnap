import os

import boto3
import pytest
from training.adapters import S3ObjectStore, StackBucketLocator

pytestmark = pytest.mark.skipif(os.environ.get("RUN_AWS_TESTS") != "1", reason="RUN_AWS_TESTS=1")


def test_the_dev_stack_names_the_bucket_and_reads_dataset_records() -> None:
    session = boto3.Session(region_name="ap-south-1")
    bucket = StackBucketLocator(session.client("cloudformation"), "junksnap-dev").bucket()
    assert bucket.startswith("junksnap-dev-originals-")
    store = S3ObjectStore(session.client("s3"), bucket)
    assert store.read("datasets/taco/records.jsonl")
    assert store.read("datasets/no-such-file.json") is None
