# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Smoke test the deployed stage: every URL must answer with a 2xx or 3xx within the timeout.

Usage: uv run scripts/smoke.py <url> [<url> ...]
Extend it with real checks (a draft request built from a fixture) once contracts/ defines the routes.
"""

import sys
import time
import urllib.error
import urllib.request

TIMEOUT_S = 30


def check(url: str) -> bool:
    start = time.monotonic()
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT_S) as resp:
            ok = resp.status < 400
            status = resp.status
    except urllib.error.HTTPError as exc:
        ok, status = False, exc.code
    except (urllib.error.URLError, TimeoutError) as exc:
        ok, status = False, f"error: {exc}"
    took = time.monotonic() - start
    print(f"{'PASS' if ok else 'FAIL'}  {status}  {took:5.1f}s  {url}")
    return ok


def main(urls: list[str]) -> int:
    if not urls:
        print(__doc__)
        return 2
    results = [check(u) for u in urls]
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
