"""The crawls table adapter against a stub table. No AWS."""

from datetime import UTC, datetime, timedelta
from typing import Any

from botocore.exceptions import ClientError

from ward_crawler.adapters.dynamo_crawl_ledger import DynamoCrawlLedger
from ward_crawler.domain.crawl_row import DONE, FAILED, QUEUED, CrawlFinish, CrawlRow, SourceResult

NOW = datetime(2026, 10, 10, 9, 0, tzinfo=UTC)


class StubTable:
    def __init__(self, fail_conditions: bool = False) -> None:
        self.updates: list[dict[str, Any]] = []
        self._fail = fail_conditions

    def update_item(self, **request: Any) -> dict[str, Any]:
        if self._fail and "ConditionExpression" in request:
            error = {"Error": {"Code": "ConditionalCheckFailedException", "Message": "no"}}
            raise ClientError(error, "UpdateItem")  # type: ignore[arg-type]
        self.updates.append(request)
        return {}

    def scan(self, **request: Any) -> dict[str, Any]:
        if "ExclusiveStartKey" not in request:
            return {
                "Items": [{"district_id": "a", "status": "queued"}],
                "LastEvaluatedKey": {"k": 1},
            }
        return {"Items": [{"district_id": "b", "next_due_at": "2026-10-10T09:00:00Z"}]}


def ledger(table: StubTable) -> DynamoCrawlLedger:
    return DynamoCrawlLedger(table)  # type: ignore[arg-type]


def test_a_failed_crawl_keeps_the_last_done_crawls_wards() -> None:
    table = StubTable()
    finish = CrawlFinish(FAILED, NOW, NOW + timedelta(hours=6), NOW + timedelta(hours=7), "jodhpur")

    ledger(table).finish("rajasthan-jodhpur", finish)

    names = table.updates[0]["ExpressionAttributeNames"].values()
    assert "wards_found" not in names and "results" not in names
    assert table.updates[0]["ExpressionAttributeValues"][":status"] == FAILED


def test_a_done_crawl_writes_its_wards_and_results() -> None:
    table = StubTable()
    result = SourceResult("https://x.gov.in", "fetched", 80, "a" * 64, None, "ok")
    finish = CrawlFinish(
        DONE, NOW, NOW, None, "jodhpur", 160, "crawl/wards/jodhpur.json", (result,)
    )

    ledger(table).finish("rajasthan-jodhpur", finish)

    values = table.updates[0]["ExpressionAttributeValues"]
    assert values[":wards_found"] == 160
    assert values[":results"][0]["wards_found"] == 80
    assert values[":last_crawled_at"] == "2026-10-10T09:00:00Z"


def test_a_lost_claim_returns_false_and_a_running_district_is_not_requeued() -> None:
    table = StubTable(fail_conditions=True)
    row = CrawlRow("rajasthan-jodhpur", QUEUED, NOW)

    assert ledger(table).claim(row, NOW, NOW) is False
    ledger(table).queue("rajasthan-jodhpur", NOW, NOW)
    assert table.updates == []


def test_rows_read_every_page_of_the_scan() -> None:
    rows = ledger(StubTable()).rows()

    assert [(row.district_id, row.status) for row in rows] == [("a", QUEUED), ("b", None)]
    assert rows[1].next_due_at == NOW
