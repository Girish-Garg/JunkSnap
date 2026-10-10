"""The crawls table (key district_id), through the boto3 DynamoDB resource."""

from dataclasses import asdict
from datetime import datetime
from typing import TYPE_CHECKING, Any

from botocore.exceptions import BotoCoreError, ClientError

from ward_crawler.domain.crawl_row import DONE, QUEUED, RUNNING, CrawlFinish, CrawlRow
from ward_crawler.domain.errors import StoreError
from ward_crawler.domain.utils import utc_z
from ward_crawler.ports.crawl_ledger import CrawlLedger

if TYPE_CHECKING:
    from mypy_boto3_dynamodb.service_resource import Table

LOST_RACE = "ConditionalCheckFailedException"


class LostRaceError(StoreError):
    """The row's status changed since it was read."""


def _time(raw: Any) -> datetime | None:
    return datetime.fromisoformat(raw) if isinstance(raw, str) and raw else None


class DynamoCrawlLedger(CrawlLedger):
    def __init__(self, table: "Table") -> None:
        self._table = table

    def rows(self) -> tuple[CrawlRow, ...]:
        items: list[dict[str, Any]] = []
        page = self._call(self._table.scan)
        items.extend(page.get("Items", []))
        while "LastEvaluatedKey" in page:
            start = page["LastEvaluatedKey"]
            page = self._call(lambda start=start: self._table.scan(ExclusiveStartKey=start))
            items.extend(page.get("Items", []))
        return tuple(self._row(item) for item in items)

    def queue(self, district_id: str, now: datetime, expected_by: datetime) -> None:
        values = {":queued": QUEUED, ":now": utc_z(now), ":expected": utc_z(expected_by)}
        try:
            self._update(
                district_id,
                "SET #status = :queued, queued_at = if_not_exists(queued_at, :now), "
                "next_due_at = :now, expected_by = :expected REMOVE verified_report_ids",
                values,
                "attribute_not_exists(#status) OR #status <> :running",
                extra={":running": RUNNING},
            )
        except LostRaceError:
            return

    def claim(self, row: CrawlRow, now: datetime, expected_by: datetime) -> bool:
        values = {":running": RUNNING, ":now": utc_z(now), ":expected": utc_z(expected_by)}
        try:
            self._update(
                row.district_id,
                "SET #status = :running, started_at = :now, expected_by = :expected "
                "ADD attempts :one",
                {**values, ":one": 1},
                "#status = :seen",
                extra={":seen": row.status},
            )
        except LostRaceError:
            return False
        return True

    def finish(self, district_id: str, finish: CrawlFinish) -> None:
        """A failed crawl keeps the last done crawl's wards, results and output key."""
        fields: dict[str, Any] = {
            "status": finish.status,
            "last_crawled_at": utc_z(finish.finished_at),
            "next_due_at": utc_z(finish.next_due_at),
            "expected_by": utc_z(finish.expected_by) if finish.expected_by else None,
            "error": finish.error,
        }
        if finish.status == DONE:
            fields["city"] = finish.city
            fields["wards_found"] = finish.wards_found
            fields["wards_key"] = finish.wards_key
            fields["results"] = [asdict(result) for result in finish.results]
        names = {f"#{name}": name for name in fields}
        values = {f":{name}": value for name, value in fields.items()}
        assignments = ", ".join(f"#{name} = :{name}" for name in fields)
        self._call(
            lambda: self._table.update_item(
                Key={"district_id": district_id},
                UpdateExpression=f"SET {assignments}",
                ExpressionAttributeNames=names,
                ExpressionAttributeValues=values,
            )
        )

    def _update(
        self, district_id: str, expression: str, values: dict[str, Any], condition: str, **more: Any
    ) -> None:
        self._call(
            lambda: self._table.update_item(
                Key={"district_id": district_id},
                UpdateExpression=expression,
                ConditionExpression=condition,
                ExpressionAttributeNames={"#status": "status"},
                ExpressionAttributeValues={**values, **more.get("extra", {})},
            )
        )

    def _call(self, action: Any) -> Any:
        try:
            return action()
        except ClientError as error:
            if error.response.get("Error", {}).get("Code") == LOST_RACE:
                raise LostRaceError(str(error)) from error
            raise StoreError(f"crawls table: {error}") from error
        except BotoCoreError as error:
            raise StoreError(f"crawls table: {error}") from error

    def _row(self, item: dict[str, Any]) -> CrawlRow:
        status = item.get("status")
        return CrawlRow(
            district_id=str(item["district_id"]),
            status=str(status) if status else None,
            next_due_at=_time(item.get("next_due_at")),
            started_at=_time(item.get("started_at")),
        )
