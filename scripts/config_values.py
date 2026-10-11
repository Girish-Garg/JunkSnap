"""Checks a stage file's values against their defaults, so a bad one stops the deploy, not the pods.

The default's form sets what a value may be (docs/config.md):
- a whole number (`20`) takes whole numbers; a number with a decimal point (`0.85`, `60.0`) takes
  any plain number;
- neither may go below 0 when the default is 0 or more, and a server or ml value whose default is
  above 0 must stay above 0 unless its code takes 0 (ZERO_OK). The app falls back to its own
  default on a bad VITE_ value, so VITE_ values may be 0;
- a JSON list (`[90,80]`) takes a non-empty JSON list of the same kind of numbers;
- comma-separated numbers (`73.02,26.27`) take as many numbers;
- anything else (a URL, a folder) is taken as it is.
The code still checks its own ranges when it starts; these checks catch the typos.
"""

import json
import re
from decimal import Decimal

WHOLE = re.compile(r"-?\d+")
NUMBER = re.compile(r"-?\d+(\.\d+)?")
NUMBERS = re.compile(r"-?\d+(\.\d+)?(\s*,\s*-?\d+(\.\d+)?)+")
VITE_PREFIX = "VITE_"
# Server and ml values with a default above 0 whose code also takes 0 (backend/server/src/settings,
# backend/ml/src/ml/settings).
ZERO_OK = frozenset({
    "ANDROID_HANDOFF_WAIT_MS", "SHARE_CACHE_MAX_AGE_SECONDS", "ASSETLINKS_CACHE_MAX_AGE_SECONDS",
    "MEDIA_CACHE_MAX_AGE_SECONDS", "CORS_MAX_AGE_SECONDS", "PHOTO_MAX_AHEAD_MINUTES",
    "DUPLICATE_MAX_BITS", "INDIA_BUFFER_DEG", "WORKER_WAIT_SECONDS", "COUNTER_JITTER_MS",
    "LLM_JSON_RETRIES", "SCAN_MAX_HINT_FRAMES", "SCAN_DUPLICATE_BITS", "SCAN_SIMILAR_BITS",
    "SCAN_SAME_SPOT_M", "SITE_SAME_SPOT_M",
    "ML_AUTO_VERIFY_MIN", "ML_COMMUNITY_CHECK_MIN", "ML_YOLO_LIFT_MIN", "ML_DETECTORS_VETO_MAX",
    "ML_WEIGHT_REKOGNITION_LABELS", "ML_WEIGHT_YOLO", "ML_WEIGHT_EMBEDDING_CLASSIFIER",
    "ML_YOLO_MIN_CONFIDENCE", "ML_YOLO_HAZARD_MIN", "ML_YOLO_SIZE_BOX_MIN",
    "ML_YOLO_SIZE_SMALL_MAX", "ML_YOLO_SIZE_MEDIUM_MAX", "ML_YOLO_BIN_REACH",
    "ML_YOLO_BIN_ALONE_WEIGHT",
    "ML_EMBEDDING_HAZARD_MIN", "ML_LABEL_HAZARD_MIN", "ML_LABEL_WEAK_WEIGHT",
    "ML_REKOGNITION_MIN_CONFIDENCE", "ML_JUDGE_HAZARD_MIN", "ML_JUDGE_INVALID_ANSWER_RETRIES",
    "ML_JUDGE_BRANDS_MAX",
})


def value_problem(key: str, value: str, default: str) -> str | None:
    """Why `value` cannot stand in for `default`, or None when it can."""
    if NUMBER.fullmatch(default):
        return number_problem(key, value, default)
    if default.startswith("["):
        return list_problem(value, default)
    if NUMBERS.fullmatch(default):
        count = default.count(",") + 1
        if not NUMBERS.fullmatch(value) or value.count(",") + 1 != count:
            return f"needs {count} comma-separated numbers like the default {default}"
    return None


def number_problem(key: str, value: str, default: str) -> str | None:
    whole = WHOLE.fullmatch(default) is not None
    if not (WHOLE if whole else NUMBER).fullmatch(value):
        kind = "a whole number" if whole else "a plain number"
        return f"needs {kind} like the default {default}"
    number, fallback = Decimal(value), Decimal(default)
    if number < 0 <= fallback:
        return "must not be below 0"
    zero_ok = key in ZERO_OK or key.startswith(VITE_PREFIX)
    if number == 0 < fallback and not zero_ok:
        return "must be above 0"
    return None


def list_problem(value: str, default: str) -> str | None:
    """A non-empty JSON list whose items are numbers of the default's kind."""
    whole = all(isinstance(item, int) for item in json.loads(default))
    kind = "whole numbers" if whole else "numbers"
    try:
        items = json.loads(value)
    except json.JSONDecodeError:
        items = None
    good = isinstance(items, list) and items and all(
        isinstance(item, int if whole else (int, float)) and not isinstance(item, bool)
        for item in items
    )
    return None if good else f"needs a non-empty JSON list of {kind} like the default {default}"
