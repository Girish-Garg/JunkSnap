# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Build the web app and deploy it to Amplify Hosting by hand (no Git connection).

Usage: uv run scripts/deploy_web.py dev [--frontend frontend] [--skip-build]
Creates the Amplify app junksnap-<stage>-web and branch <stage> once, then each run builds
frontend/ against the stage's CloudFront URL, Cognito pool and its own branch URL
(VITE_WEB_URL, for share links), zips dist/, uploads it with
create-deployment and start-deployment, and waits for the job. Rerun after every frontend
change. Then point the api CORS at the printed URL: uv run scripts/deploy.py dev --origins ...
"""

import argparse
import json
import os
import shutil
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

from deploy import ROOT, aws, run

JOB_WAIT_SECONDS = 600
# Single-page app: every path without a file extension (or an unknown one) serves index.html.
ASSET_TYPES = "css|gif|ico|jpg|jpeg|js|mjs|png|txt|svg|woff|woff2|ttf|map|json|geojson|webp|" \
    "webmanifest|onnx|wasm"
SPA_RULE = {"source": f"</^[^.]+$|\\.(?!({ASSET_TYPES})$)([^.]+$)/>",
            "target": "/index.html", "status": "200"}
# Vite variable -> junksnap-<stage> stack output (contracts/README.md).
VITE_FROM_OUTPUTS = {
    "VITE_API_URL": "PublicBaseUrl",
    "VITE_COGNITO_USER_POOL_ID": "UserPoolId",
    "VITE_COGNITO_CLIENT_ID": "UserPoolClientId",
}


def aws_json(*args: str, quiet: bool = False) -> dict:
    return json.loads(aws(*args, "--output", "json", quiet=quiet))


def stack_outputs(stack: str) -> dict[str, str]:
    query = ["--query", "Stacks[0].Outputs"]
    raw = aws_json("cloudformation", "describe-stacks", "--stack-name", stack, *query)
    return {item["OutputKey"]: item["OutputValue"] for item in raw}


def web_app_name(stage: str) -> str:
    return f"junksnap-{stage}-web"


def find_web_app(stage: str) -> dict | None:
    """The stage's Amplify app, or None before the first deploy_web.py run."""
    apps = aws_json("amplify", "list-apps", "--max-results", "100")["apps"]
    return next((a for a in apps if a["name"] == web_app_name(stage)), None)


def branch_url(stage: str, app: dict) -> str:
    """The public web app URL (VITE_WEB_URL): the Amplify branch named after the stage."""
    return f"https://{stage}.{app['defaultDomain']}"


class WebBuild:
    """Builds frontend/ for one stage and zips dist/ with index.html at the root."""

    def __init__(self, frontend: Path, outputs: dict[str, str], web_url: str) -> None:
        self._frontend = frontend
        self._outputs = outputs
        self._web_url = web_url

    def zip(self, skip_build: bool, folder: str) -> Path:
        if not skip_build:
            self._build()
        dist = self._frontend / "dist"
        if not (dist / "index.html").is_file():
            sys.exit(f"no {dist / 'index.html'}; build the frontend first")
        return Path(shutil.make_archive(str(Path(folder, "web")), "zip", dist))

    def _build(self) -> None:
        env = {key: self._outputs[name] for key, name in VITE_FROM_OUTPUTS.items()}
        env["VITE_API_MODE"] = "live"
        env["VITE_WEB_URL"] = self._web_url
        print("build env:", json.dumps(env))
        os.environ.update(env)
        folder = str(self._frontend)
        run(["npm", "--prefix", folder, "ci", "--no-audit", "--no-fund"])
        run(["npm", "--prefix", folder, "run", "build"])


class AmplifyHost:
    """One Amplify app per stage with one branch; deployments are uploaded zips."""

    def __init__(self, stage: str) -> None:
        self._stage = stage
        self._name = web_app_name(stage)
        self._tags = f"project=junksnap,stage={stage}"

    def ensure_app(self) -> dict:
        rules = json.dumps([SPA_RULE])
        app = find_web_app(self._stage)
        if app is None:
            created = aws_json("amplify", "create-app", "--name", self._name, "--platform", "WEB",
                               "--custom-rules", rules, "--tags", self._tags)
            return created["app"]
        return aws_json("amplify", "update-app", "--app-id", app["appId"],
                        "--custom-rules", rules)["app"]

    def ensure_branch(self, app_id: str) -> None:
        branches = aws_json("amplify", "list-branches", "--app-id", app_id)["branches"]
        if any(b["branchName"] == self._stage for b in branches):
            return
        stage = "PRODUCTION" if self._stage == "demo" else "DEVELOPMENT"
        aws("amplify", "create-branch", "--app-id", app_id, "--branch-name", self._stage,
            "--stage", stage, "--tags", self._tags)

    def deploy(self, app_id: str, archive: Path) -> None:
        target = ["--app-id", app_id, "--branch-name", self._stage]
        job = aws_json("amplify", "create-deployment", *target)
        put = urllib.request.Request(job["zipUploadUrl"], archive.read_bytes(), method="PUT")
        put.add_header("Content-Type", "application/zip")
        with urllib.request.urlopen(put, timeout=120) as resp:
            print(f"uploaded {archive.stat().st_size} bytes: {resp.status}")
        aws("amplify", "start-deployment", *target, "--job-id", job["jobId"])
        self._wait(target, job["jobId"])

    def _wait(self, target: list[str], job_id: str) -> None:
        deadline = time.monotonic() + JOB_WAIT_SECONDS
        while time.monotonic() < deadline:
            job = aws_json("amplify", "get-job", *target, "--job-id", job_id, quiet=True)
            summary = job["job"]["summary"]
            if summary["status"] == "SUCCEED":
                return
            if summary["status"] in {"FAILED", "CANCELLED"}:
                sys.exit(f"Amplify job {job_id} ended {summary['status']}")
            time.sleep(5)
        sys.exit(f"Amplify job {job_id} still running; see the Amplify console")


def refuse_unsafe(stage: str, human_approved: bool) -> None:
    """Only dev deploys freely; demo needs the human and a clean main."""
    if stage == "dev":
        return
    clean_main = run(["git", "branch", "--show-current"]) == "main" and not run(
        ["git", "status", "--porcelain"]
    )
    if not (human_approved and clean_main):
        sys.exit(f"refusing to deploy {stage}: only the human deploys it, from a clean main")


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy the web app to Amplify Hosting.")
    parser.add_argument("stage", choices=["dev", "demo"])
    parser.add_argument("--frontend", default="frontend", help="repo-relative or absolute folder")
    parser.add_argument("--skip-build", action="store_true", help="zip the existing dist/")
    parser.add_argument("--human-approved", action="store_true", help="required for demo")
    args = parser.parse_args()
    refuse_unsafe(args.stage, args.human_approved)
    os.environ.setdefault("AWS_PROFILE", "junksnap")
    outputs = stack_outputs(f"junksnap-{args.stage}")
    host = AmplifyHost(args.stage)
    app = host.ensure_app()
    host.ensure_branch(app["appId"])
    url = branch_url(args.stage, app)
    with tempfile.TemporaryDirectory() as folder:
        frontend = (ROOT / args.frontend).resolve()
        archive = WebBuild(frontend, outputs, url).zip(args.skip_build, folder)
        host.deploy(app["appId"], archive)
    print(f"\nWeb app: {url}\nAPI: {outputs['PublicBaseUrl']}")
    print(f"CORS: uv run scripts/deploy.py {args.stage} --origins {url},http://localhost:5173,"
          "https://tauri.localhost")


if __name__ == "__main__":
    main()
