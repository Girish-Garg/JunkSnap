# ML web service: uvicorn ml.handlers.web:app --host 0.0.0.0 --port 8000
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.11.19 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1 \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Dependencies first, so code changes reuse this layer.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev --no-install-project

COPY src ./src
RUN uv sync --locked --no-dev

# Numeric user and group, so Kubernetes runAsNonRoot can verify them.
RUN groupadd --gid 10001 junksnap && useradd --uid 10001 --gid 10001 --create-home junksnap
USER 10001:10001

EXPOSE 8000
CMD ["uvicorn", "ml.handlers.web:app", "--host", "0.0.0.0", "--port", "8000"]
