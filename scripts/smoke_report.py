# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow>=11"]
# ///
"""Report smoke test against a deployed stage.

Usage: uv run scripts/smoke_report.py <base_url> [--jpeg photo.jpg] [--lat 27.35 --lon 71.25]
Always: GET /healthz and GET /sites?bbox answer 200. Without JUNKSNAP_ID_TOKEN the script
checks that POST /uploads/presign and POST /reports refuse a guest with 401. With it (a
Cognito ID token the person running the script supplies), it runs the Snap flow: presign,
PUT the JPEG with its SHA-256, POST /reports and poll GET /reports/{id} to a final status.
Without --jpeg it sends fresh random noise, so the duplicate check never fires; the default
spot is open desert in Jaisalmer district, inside India and away from the Jodhpur pilot data.
"""

import argparse
import base64
import hashlib
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
import uuid
from datetime import UTC, datetime
from pathlib import Path

from PIL import Image

TIMEOUT_S = 30
POLL_EVERY_S = 3
FINAL = {"unverified", "verified", "community_check", "rejected", "needs_review"}
NOISE_SIZE = (640, 480)
JODHPUR_BBOX = "72.95,26.2,73.1,26.35"
UNAUTHORIZED = 401
FIRST_NON_SUCCESS = 300


class SmokeError(Exception):
    """A step failed; the message says which and why."""


class Api:
    """JSON over HTTPS against one base URL, with the smoke test's identity headers."""

    def __init__(self, base_url: str, device_token: str, id_token: str | None) -> None:
        self._base = base_url.rstrip("/")
        self._headers = {"X-Device-Token": device_token}
        if id_token:
            self._headers["Authorization"] = f"Bearer {id_token}"

    def send(self, method: str, path: str, body: dict[str, object] | None = None) -> tuple:
        """Return (HTTP status, parsed JSON body) without raising on 4xx or 5xx."""
        data = None if body is None else json.dumps(body).encode()
        headers = {**self._headers, **({"Content-Type": "application/json"} if data else {})}
        request = urllib.request.Request(self._base + path, data, headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT_S) as resp:
                return resp.status, json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read().decode()[:300]

    def call(self, method: str, path: str, body: dict[str, object] | None = None) -> dict:
        status, answer = self.send(method, path, body)
        if status >= FIRST_NON_SUCCESS:
            raise SmokeError(f"{method} {path}: {status} {answer}")
        return answer


def photo_bytes(path: str | None) -> bytes:
    """The given JPEG, or random noise encoded as JPEG."""
    if path:
        return Path(path).read_bytes()
    noise = Image.frombytes("RGB", NOISE_SIZE, os.urandom(NOISE_SIZE[0] * NOISE_SIZE[1] * 3))
    out = io.BytesIO()
    noise.save(out, format="JPEG", quality=85)
    return out.getvalue()


def put_photo(upload_url: str, headers: dict[str, str], photo: bytes) -> None:
    """PUT the bytes with exactly the presigned headers; S3 checks the SHA-256."""
    request = urllib.request.Request(upload_url, photo, headers, method="PUT")
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S) as resp:
            print(f"PASS  PUT photo to S3: {resp.status}, {len(photo)} bytes")
    except urllib.error.HTTPError as exc:
        raise SmokeError(f"PUT photo: {exc.code} {exc.read().decode()[:300]}") from exc


class ReportSmoke:
    """Runs the Snap flow once, the way the phone does."""

    def __init__(self, api: Api, device_token: str, args: argparse.Namespace) -> None:
        self._api = api
        self._device = device_token
        self._args = args

    def open_routes(self) -> None:
        print(f"PASS  GET /healthz: {self._api.call('GET', '/healthz')}")
        sites = self._api.call("GET", f"/sites?bbox={JODHPUR_BBOX}")
        print(f"PASS  GET /sites?bbox (Jodhpur): {len(sites['features'])} sites")

    def guest_refused(self) -> None:
        """Without a token, creating anything must be 401 unauthorized."""
        digest = hashlib.sha256(b"guest").hexdigest()
        checks = [("/uploads/presign", self._presign_body(digest)),
                  ("/reports", self._report_body("upl_smoke_guest", digest))]
        for path, body in checks:
            status, answer = self._api.send("POST", path, body)
            if status != UNAUTHORIZED:
                raise SmokeError(f"POST {path} as a guest: {status} {answer}, expected 401")
            print(f"PASS  POST {path} as a guest: 401 {answer}")

    def snap(self) -> str:
        photo = photo_bytes(self._args.jpeg)
        digest = hashlib.sha256(photo).hexdigest()
        presign = self._api.call("POST", "/uploads/presign", self._presign_body(digest))
        upload_id = presign["upload_id"]
        print(f"PASS  POST /uploads/presign: {upload_id}, expires {presign['expires_at']}")
        expected = base64.b64encode(bytes.fromhex(digest)).decode()
        if presign["headers"].get("x-amz-checksum-sha256") != expected:
            raise SmokeError("presign headers do not carry the photo's SHA-256")
        put_photo(presign["upload_url"], presign["headers"], photo)
        accepted = self._api.call("POST", "/reports", self._report_body(upload_id, digest))
        print(f"PASS  POST /reports: {accepted}")
        return accepted["report_id"]

    def _presign_body(self, digest: str) -> dict[str, object]:
        return {"purpose": "report", "content_type": "image/jpeg", "sha256": digest,
                "device_token": self._device}

    def _report_body(self, upload_id: str, digest: str) -> dict[str, object]:
        now = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
        gps = {"lat": self._args.lat, "lon": self._args.lon, "accuracy_m": 8}
        return {"upload_id": upload_id, "report_type": "waste_dump", "context": "roadside",
                "capture_mode": "snap", "sha256": digest, "gps": gps,
                "device_token": self._device, "captured_at": now}


def poll(api: Api, report_id: str, wait_s: int) -> dict:
    """Poll GET /reports/{id} until a final status or the deadline; print each change."""
    deadline, last, status = time.monotonic() + wait_s, None, {}
    while time.monotonic() < deadline:
        status = api.call("GET", f"/reports/{report_id}")
        if status["status"] != last:
            last = status["status"]
            print(f"      {datetime.now(UTC):%H:%M:%S}Z  {report_id}: {last}")
        if last in FINAL:
            return status
        time.sleep(POLL_EVERY_S)
    return status


def summary(status: dict) -> str:
    """One line per pipeline result that exists, never the photo or the user."""
    verification = status.get("verification") or {}
    moderation = status.get("moderation") or {}
    parts = [f"status={status.get('status')}", f"site={status.get('site_id')}",
             f"blurred_url={status.get('blurred_url')}",
             f"moderation={moderation.get('outcome')} {moderation.get('reasons', '')}",
             f"verification={verification.get('decision')} p={verification.get('probability')}"]
    return "  ".join(parts)


def signed_in_flow(smoke: ReportSmoke, api: Api, wait_s: int) -> bool:
    report_id = smoke.snap()
    status = poll(api, report_id, wait_s)
    print(f"      {summary(status)}")
    return status.get("status") in FINAL


def main() -> int:
    parser = argparse.ArgumentParser(description="Report smoke test against a deployed stage.")
    parser.add_argument("base_url", help="CloudFront base URL, e.g. https://dxxxx.cloudfront.net")
    parser.add_argument("--jpeg", help="a JPEG to send instead of random noise")
    parser.add_argument("--lat", type=float, default=27.35)
    parser.add_argument("--lon", type=float, default=71.25)
    parser.add_argument("--wait", type=int, default=300, help="seconds to poll for a final status")
    args = parser.parse_args()
    device, token = str(uuid.uuid4()), os.environ.get("JUNKSNAP_ID_TOKEN")
    api = Api(args.base_url, device, token)
    smoke = ReportSmoke(api, device, args)
    print(f"      device {device}, signed in: {bool(token)}")
    try:
        smoke.open_routes()
        if not token:
            smoke.guest_refused()
            return 0
        done = signed_in_flow(smoke, api, args.wait)
    except SmokeError as exc:
        print(f"FAIL  {exc}")
        return 1
    print("PASS  report reached a final status" if done else "FAIL  no final status in time")
    return 0 if done else 1


if __name__ == "__main__":
    sys.exit(main())
