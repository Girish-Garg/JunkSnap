# Ward crawler CronJob: python -m ward_crawler.handlers.job
# Build from data/ward_crawler with the repo's contracts/ as the named context "contracts":
#   docker build --build-context contracts=../../contracts .
FROM scratch AS contracts

FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.11.19 /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_NO_CACHE=1 \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/junksnap/ward_crawler/.venv/bin:$PATH" \
    CRAWL_SOURCES_DIR=/opt/junksnap/ward_crawler/sources \
    CRAWL_SCHEMA=/opt/junksnap/ward_crawler/contracts/schemas/ward_record.schema.json

WORKDIR /opt/junksnap/ward_crawler

# Dependencies first, so code changes reuse this layer.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY src ./src
RUN uv sync --locked --no-dev

COPY sources ./sources
COPY --from=contracts schemas/ward_record.schema.json /opt/junksnap/ward_crawler/contracts/schemas/ward_record.schema.json

# Numeric user and group, so Kubernetes runAsNonRoot can verify them.
RUN groupadd --gid 10001 junksnap && useradd --uid 10001 --gid 10001 --create-home junksnap
USER 10001:10001

CMD ["python", "-m", "ward_crawler.handlers.job"]
