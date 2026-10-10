# /// script
# requires-python = ">=3.12"
# dependencies = ["boto3>=1.41", "botocore[crt]>=1.41"]
# ///
"""Worker end-to-end check on dev without a signed-in user: what intake does, done directly.

Usage: uv run scripts/inject_report.py photo.jpg [--lat 26.2389 --lon 73.0243] [--wait 300]
Puts the JPEG at reports/{upload_id}.jpg in the originals bucket, writes the queued report row
(the shape DynamoReportRepository.create writes, version 1) and sends {"kind": "report"} to the
reports queue, then polls the row until the worker settles it. Dev only; AWS profile junksnap.
"""

import argparse
import base64
import hashlib
import json
import secrets
import sys
import time
import uuid
from datetime import UTC, datetime
from decimal import Decimal

import boto3

STAGE = "dev"
REGION = "ap-south-1"
OPEN = {"queued", "processing"}
ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"


def iso_now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def stack_outputs(session: boto3.Session) -> dict[str, str]:
    stack = session.client("cloudformation").describe_stacks(StackName=f"junksnap-{STAGE}")
    return {o["OutputKey"]: o["OutputValue"] for o in stack["Stacks"][0]["Outputs"]}


def report_row(upload_id: str, digest: str, args: argparse.Namespace) -> dict:
    now = iso_now()
    return {
        "upload_id": upload_id, "report_type": "waste_dump", "context": "roadside",
        "capture_mode": "snap", "sha256": digest, "device_token": str(uuid.uuid4()),
        "gps": {"lat": args.lat, "lon": args.lon, "accuracy_m": 8}, "captured_at": now,
        "report_id": "rpt_" + upload_id[4:], "received_at": now, "updated_at": now,
        "status": "queued", "completed_steps": [], "version": 1,
    }


def inject(session: boto3.Session, outputs: dict[str, str], args: argparse.Namespace) -> str:
    photo = open(args.jpeg, "rb").read()  # noqa: SIM115
    digest = hashlib.sha256(photo).hexdigest()
    upload_id = "upl_" + "".join(secrets.choice(ALPHABET) for _ in range(26))
    session.client("s3").put_object(
        Bucket=outputs["OriginalsBucketName"], Key=f"reports/{upload_id}.jpg", Body=photo,
        ContentType="image/jpeg", ChecksumSHA256=base64.b64encode(bytes.fromhex(digest)).decode(),
    )
    # DynamoDB numbers must be Decimal.
    row = json.loads(json.dumps(report_row(upload_id, digest, args)), parse_float=Decimal)
    table = session.resource("dynamodb").Table(outputs["ReportsTableName"])
    table.put_item(Item=row, ConditionExpression="attribute_not_exists(report_id)")
    body = json.dumps({"kind": "report", "report_id": row["report_id"]})
    session.client("sqs").send_message(QueueUrl=outputs["ReportsQueueUrl"], MessageBody=body)
    print(f"injected {row['report_id']} ({len(photo)} bytes) at {args.lat},{args.lon}")
    return row["report_id"]


def wait(session: boto3.Session, table_name: str, report_id: str, seconds: int) -> dict:
    table = session.resource("dynamodb").Table(table_name)
    deadline, last, item = time.monotonic() + seconds, None, {}
    while time.monotonic() < deadline:
        item = table.get_item(Key={"report_id": report_id}, ConsistentRead=True).get("Item", {})
        if item.get("status") != last:
            last = item.get("status")
            print(f"{iso_now()}  {report_id}: {last}  steps={item.get('completed_steps')}")
        if last not in OPEN:
            return item
        time.sleep(3)
    return item


def main() -> int:
    parser = argparse.ArgumentParser(description="Inject one report for the dev worker.")
    parser.add_argument("jpeg")
    parser.add_argument("--lat", type=float, default=26.2389)
    parser.add_argument("--lon", type=float, default=73.0243)
    parser.add_argument("--wait", type=int, default=300)
    args = parser.parse_args()
    session = boto3.Session(profile_name="junksnap", region_name=REGION)
    outputs = stack_outputs(session)
    report_id = inject(session, outputs, args)
    item = wait(session, outputs["ReportsTableName"], report_id, args.wait)
    print(json.dumps(item, indent=1, default=str))
    return 0 if item.get("status") not in OPEN else 1


if __name__ == "__main__":
    sys.exit(main())
