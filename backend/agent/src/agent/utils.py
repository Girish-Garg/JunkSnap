"""Small pure helpers (10 lines or fewer each)."""


def json_object_text(text: str) -> str:
    """The text from the first `{` to the last `}`, dropping code fences or chatter around it."""
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end < start:
        return text
    return text[start : end + 1]
