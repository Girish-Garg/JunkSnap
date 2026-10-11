# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Deploy a stage (stacks, images, overlay, CloudFront): uv run scripts/deploy.py dev"""

import argparse
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGION = "ap-south-1"
CLUSTER = "junksnap"
SHARED_STACK = "junksnap-shared"
ALB_WAIT_SECONDS = 600
# Stages whose stack holds the real field-audit data: CloudFormation refuses to delete them.
PROTECTED_STAGES = ("demo",)
# ml downloads and checks about 420 MB of trained models before it serves (startup probe: 5 min).
ROLLOUT_WAIT_SECONDS = {"api": 300, "ml": 600, "worker": 300}
# image -> (build folders, first with a Dockerfile wins; backend/agent until backend/ml exists)
IMAGES = {
    "junksnap-server": (("backend/server",), "ServerRepositoryUri"),
    "junksnap-ml": (("backend/ml", "backend/agent"), "MlRepositoryUri"),
    "junksnap-crawler": (("data/ward_crawler",), "CrawlerRepositoryUri"),
}
# image -> named build contexts (name=repo folder); the server image copies data/ into /app/data,
# the crawler image the ward_record schema from contracts/.
BUILD_CONTEXTS = {"junksnap-server": ("data=data",), "junksnap-crawler": ("contracts=contracts",)}
# ConfigMap variable (contracts/README.md) -> junksnap-<stage> output
CONFIG_FROM_OUTPUTS = {
    "REPORTS_TABLE": "ReportsTableName",
    "CLEANUPS_TABLE": "CleanupsTableName",
    "SCANS_TABLE": "ScansTableName",
    "USERS_TABLE": "UsersTableName",
    "SITES_TABLE": "SitesTableName",
    "VOTES_TABLE": "VotesTableName",
    "DEVICES_TABLE": "DevicesTableName",
    "SCORES_TABLE": "ScoresTableName",
    "CRAWLS_TABLE": "CrawlsTableName",
    "NOTES_TABLE": "NotesTableName",
    "ORIGINALS_BUCKET": "OriginalsBucketName",
    "PUBLIC_BUCKET": "PublicBucketName",
    "PUBLIC_BASE_URL": "PublicBaseUrl",
    "REPORTS_QUEUE_URL": "ReportsQueueUrl",
    "OPENAI_SECRET_ID": "OpenAiSecretName",
    "OPENROUTER_SECRET_ID": "OpenRouterSecretName",
    "COGNITO_USER_POOL_ID": "UserPoolId",
    "COGNITO_CLIENT_ID": "UserPoolClientId",
}


def run(args: list[str], stdin: str | None = None, quiet: bool = False) -> str:
    """Run from the repo root, return stdout, exit on failure."""
    if not quiet:
        print("+", " ".join(args), flush=True)
    exe = shutil.which(args[0]) or args[0]
    done = subprocess.run(
        [exe, *args[1:]], cwd=ROOT, input=stdin, text=True, capture_output=True, check=False
    )
    if done.returncode != 0:
        sys.exit(f"failed: {' '.join(args)}\n{done.stdout}\n{done.stderr}")
    return done.stdout.strip()


def aws(*args: str, quiet: bool = False) -> str:
    return run(["aws", *args, "--region", REGION], quiet=quiet)


def deploy_stack(stack: str, template: str, extra: list[str]) -> dict[str, str]:
    """Create or update a stack and return its outputs."""
    target = ["--stack-name", stack, "--template-file", template]
    flags = ["--capabilities", "CAPABILITY_NAMED_IAM", "--no-fail-on-empty-changeset"]
    aws("cloudformation", "deploy", *target, *flags, *extra)
    query = ["--query", "Stacks[0].Outputs", "--output", "json"]
    raw = aws("cloudformation", "describe-stacks", "--stack-name", stack, *query)
    return {item["OutputKey"]: item["OutputValue"] for item in json.loads(raw)}


def protect_stack(stage: str, stack: str) -> None:
    """Turn on termination protection for a protected stage's stack; it is idempotent."""
    if stage not in PROTECTED_STAGES:
        return
    flag = "--enable-termination-protection"
    aws("cloudformation", "update-termination-protection", flag, "--stack-name", stack)


def build_image(name: str, folders: tuple[str, ...], image: str) -> None:
    """Build one image for linux/amd64 with its named build contexts."""
    folder = next(f for f in folders if (ROOT / f / "Dockerfile").is_file())
    contexts = [f"--build-context={c}" for c in BUILD_CONTEXTS.get(name, ())]
    run(["docker", "build", "--platform", "linux/amd64", *contexts, "-t", image, folder])


class StageDeployer:
    """Deploys one stage end to end."""

    def __init__(self, stage: str, origins: str | None) -> None:
        self._stage = stage
        self._origins = origins
        self._namespace = f"junksnap-{stage}"
        # Generated, gitignored layer over the committed overlay: keeps account ids out of git.
        self._layer = ROOT / "infra" / "k8s" / "deploy" / stage
        self._kubeconfig = str(Path(tempfile.gettempdir(), f"junksnap-{stage}-kubeconfig"))

    def deploy(self) -> str:
        """Run every step; return the CloudFront URL."""
        shared_tags = ["--tags", "project=junksnap", "stage=shared"]
        repos = deploy_stack(SHARED_STACK, "infra/aws/shared.yaml", shared_tags)
        origins = [f"UploadOrigins={self._origins}"] if self._origins else []
        outputs = self._deploy_stage_stack(origins)
        protect_stack(self._stage, self._namespace)
        tag = self._push_images(repos)
        self._write_layer(repos, tag, outputs)
        aws("eks", "update-kubeconfig", "--name", CLUSTER, "--kubeconfig", self._kubeconfig)
        self._kubectl("apply", "-k", self._layer.relative_to(ROOT).as_posix())
        for name, seconds in ROLLOUT_WAIT_SECONDS.items():
            self._kubectl("rollout", "status", f"deployment/{name}", f"--timeout={seconds}s")
        alb = self._wait_for_alb()
        return self._deploy_stage_stack([f"AlbDnsName={alb}"])["PublicBaseUrl"]

    def _kubectl(self, *args: str, quiet: bool = False) -> str:
        kubectl = ["kubectl", "--kubeconfig", self._kubeconfig, "-n", self._namespace]
        return run([*kubectl, *args], quiet=quiet)

    def _deploy_stage_stack(self, overrides: list[str]) -> dict[str, str]:
        """Parameters not overridden keep their current value."""
        params = ["--parameter-overrides", f"Stage={self._stage}", *overrides]
        tags = ["--tags", "project=junksnap", f"stage={self._stage}"]
        return deploy_stack(self._namespace, "infra/aws/stage.yaml", params + tags)

    def _push_images(self, repos: dict[str, str]) -> str:
        """Build and push every image for linux/amd64; return the tag."""
        tag = run(["git", "rev-parse", "--short", "HEAD"])
        if run(["git", "status", "--porcelain", "--", "backend", "data"]):
            tag += "-dirty"
        registry = repos["ServerRepositoryUri"].split("/")[0]
        token = base64.b64encode(b"AWS:" + aws("ecr", "get-login-password", quiet=True).encode())
        # Throwaway file auth: the ECR token is too big for the Windows credential store.
        with tempfile.TemporaryDirectory() as config:
            auths = {"auths": {registry: {"auth": token.decode()}}}
            Path(config, "config.json").write_text(json.dumps(auths), encoding="utf-8")
            for name, (folders, output) in IMAGES.items():
                image = f"{repos[output]}:{tag}"
                # stage-<stage> marks the deployed image; the ECR lifecycle never expires it.
                stage_image = f"{repos[output]}:stage-{self._stage}"
                build_image(name, folders, image)
                run(["docker", "tag", image, stage_image])
                for pushed in (image, stage_image):
                    run(["docker", "--config", config, "push", pushed])
        return tag

    def _write_layer(self, repos: dict[str, str], tag: str, outputs: dict[str, str]) -> None:
        """Write infra/k8s/deploy/<stage>/kustomization.yaml (JSON is valid YAML)."""
        literals = [f"{key}={outputs[name]}" for key, name in CONFIG_FROM_OUTPUTS.items()]
        if self._origins:
            literals.append(f"CORS_ORIGINS={self._origins}")
        images = [
            {"name": name, "newName": repos[output], "newTag": tag}
            for name, (_, output) in IMAGES.items()
        ]
        config = {"name": "junksnap-config", "behavior": "merge", "literals": literals}
        layer = {
            "namespace": self._namespace,
            "resources": [f"../../overlays/{self._stage}"],
            "images": images,
            "configMapGenerator": [config],
        }
        self._layer.mkdir(parents=True, exist_ok=True)
        text = "# Written by scripts/deploy.py; not committed.\n" + json.dumps(layer, indent=2)
        (self._layer / "kustomization.yaml").write_text(text + "\n", encoding="utf-8")

    def _wait_for_alb(self) -> str:
        """Poll the Ingress until Auto Mode publishes the ALB hostname."""
        jsonpath = "jsonpath={.status.loadBalancer.ingress[0].hostname}"
        deadline = time.monotonic() + ALB_WAIT_SECONDS
        while time.monotonic() < deadline:
            host = self._kubectl("get", "ingress", "junksnap", "-o", jsonpath, quiet=True)
            if host:
                print("ALB:", host)
                return host
            time.sleep(10)
        sys.exit("no ALB hostname yet; see: kubectl describe ingress junksnap")


def refuse_unsafe(stage: str, human_approved: bool, origins: str | None) -> None:
    """Only dev deploys freely; any other stage needs the human, --origins and a clean main."""
    if stage == "dev":
        return
    if not human_approved:
        sys.exit(f"refusing to deploy {stage}: only the human deploys it (--human-approved)")
    if not origins:
        sys.exit(f"refusing to deploy {stage}: pass --origins with the app's exact origins")
    clean_main = run(["git", "branch", "--show-current"]) == "main" and not run(
        ["git", "status", "--porcelain"]
    )
    if not clean_main:
        sys.exit(f"refusing to deploy {stage}: check out a clean main first")


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy one JunkSnap stage.")
    parser.add_argument("stage", choices=["dev", "demo"])
    parser.add_argument("--human-approved", action="store_true", help="required for demo")
    parser.add_argument("--origins", help="comma-separated browser origins; required for demo")
    args = parser.parse_args()
    refuse_unsafe(args.stage, args.human_approved, args.origins)
    os.environ.setdefault("AWS_PROFILE", "junksnap")
    url = StageDeployer(args.stage, args.origins).deploy()
    print(f"\nCloudFront URL: {url}\nCheck: curl {url}/healthz")


if __name__ == "__main__":
    main()
