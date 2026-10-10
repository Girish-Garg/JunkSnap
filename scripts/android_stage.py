"""The public per-stage values the Android app is built with, from AWS (local) or env vars (CI).

Both sources fill the same StageSettings, so build_android.py has one path after this. None of
these values is a secret: they ship inside the app and the web build.
"""

import os
import sys
from dataclasses import dataclass

from deploy import REGION
from deploy_web import branch_url, find_web_app, stack_outputs, web_app_name

# StageSettings field -> env var (CI sets these from repository variables, see docs/android.md).
ENV_NAMES = {
    "api_url": "VITE_API_URL",
    "user_pool_id": "VITE_COGNITO_USER_POOL_ID",
    "client_id": "VITE_COGNITO_CLIENT_ID",
    "web_url": "VITE_WEB_URL",
    "uploads_bucket": "JUNKSNAP_UPLOADS_BUCKET",
}


@dataclass(frozen=True)
class StageSettings:
    api_url: str
    user_pool_id: str
    client_id: str
    web_url: str
    uploads_bucket: str

    @staticmethod
    def from_aws(stage: str) -> "StageSettings":
        """Stack outputs of junksnap-<stage> plus the Amplify branch URL, as deploy_web.py uses."""
        outputs = stack_outputs(f"junksnap-{stage}")
        app = find_web_app(stage)
        if app is None:
            sys.exit(f"no Amplify app {web_app_name(stage)}; deploy the web app first "
                     f"(uv run scripts/deploy_web.py {stage}), since share links point at it")
        return StageSettings(outputs["PublicBaseUrl"], outputs["UserPoolId"],
                             outputs["UserPoolClientId"], branch_url(stage, app),
                             outputs["OriginalsBucketName"])

    @staticmethod
    def from_env() -> "StageSettings":
        missing = [name for name in ENV_NAMES.values() if not os.environ.get(name, "").strip()]
        if missing:
            sys.exit(f"missing env vars for --settings env: {', '.join(missing)}")
        values = {field: os.environ[name].strip() for field, name in ENV_NAMES.items()}
        return StageSettings(**values)

    def vite_env(self) -> dict[str, str]:
        return {
            "VITE_API_MODE": "live",
            "VITE_API_URL": self.api_url.rstrip("/"),
            "VITE_COGNITO_USER_POOL_ID": self.user_pool_id,
            "VITE_COGNITO_CLIENT_ID": self.client_id,
            "VITE_WEB_URL": self.web_url.rstrip("/"),  # share links point at the web app
        }

    def csp_sources(self) -> tuple[str, str]:
        """The api origin (also the blurred photo host) and the presigned-upload S3 host."""
        return self.api_url.rstrip("/"), f"https://{self.uploads_bucket}.s3.{REGION}.amazonaws.com"
