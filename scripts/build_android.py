# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Build the JunkSnap Android app (Tauri 2) against one stage and print the APK path.

Usage: uv run scripts/build_android.py dev [--target aarch64 x86_64] [--skip-web] [--debug]
Reads VITE_API_URL and the Cognito ids from the junksnap-<stage> stack outputs and VITE_WEB_URL
from the stage's Amplify app (as deploy_web.py does), builds frontend/dist and marks it with
the stage in dist/.stage, then runs `tauri android build --apk` in apps/android-tauri. The
stage's api origin and originals bucket are added to the CSP in tauri.conf.json for that build
only. The release APK is signed
with the Android SDK debug key (no release keystore); --debug builds a debuggable APK whose
WebView shows in chrome://inspect. Install with `adb install -r <apk>` or copy it to the
phone. The stage's api CORS_ORIGINS and UploadOrigins must include https://tauri.localhost.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from deploy import REGION, ROOT
from deploy_web import VITE_FROM_OUTPUTS, branch_url, find_web_app, stack_outputs, web_app_name

APP = ROOT / "apps" / "android-tauri"
FRONTEND = ROOT / "frontend"
STAGE_MARK = FRONTEND / "dist" / ".stage"
TAURI_CONF = APP / "src-tauri" / "tauri.conf.json"
GRADLE_APKS = APP / "src-tauri/gen/android/app/build/outputs/apk/universal"
APP_ORIGIN = "https://tauri.localhost"
LOCAL = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
# Toolchain defaults for this team's Windows machines; any value already set wins.
TOOL_DEFAULTS = {
    "JAVA_HOME": Path(r"C:\Program Files\Android\Android Studio\jbr"),
    "ANDROID_HOME": LOCAL / "Android" / "Sdk",
}


def stream(args: list[str], cwd: Path, env: dict[str, str]) -> None:
    """Run a long build step with its output shown live; exit on failure."""
    print("+", " ".join(args), flush=True)
    exe = shutil.which(args[0], path=env.get("PATH")) or args[0]
    if subprocess.run([exe, *args[1:]], cwd=cwd, env=env, check=False).returncode != 0:
        sys.exit(f"failed: {' '.join(args)}")


class Toolchain:
    """Environment for the Android NDK, JDK and cargo, filled from the defaults above."""

    def env(self) -> dict[str, str]:
        env = dict(os.environ)
        for key, default in TOOL_DEFAULTS.items():
            env.setdefault(key, str(default))
        env.setdefault("NDK_HOME", str(self._newest_ndk(Path(env["ANDROID_HOME"]))))
        cargo_bin = Path.home() / ".cargo" / "bin"
        env["PATH"] = os.pathsep.join([str(cargo_bin), env.get("PATH", "")])
        return env

    @staticmethod
    def _newest_ndk(sdk: Path) -> Path:
        versions = sorted((sdk / "ndk").glob("*"), key=lambda p: p.name)
        if not versions:
            sys.exit(f"no NDK under {sdk / 'ndk'}; install NDK (Side by side) in the SDK Manager")
        return versions[-1]


class StageCsp:
    """The CSP from tauri.conf.json plus this stage's api origin and originals bucket."""

    def __init__(self, outputs: dict[str, str]) -> None:
        self._api = outputs["PublicBaseUrl"].rstrip("/")
        self._uploads = f"https://{outputs['OriginalsBucketName']}.s3.{REGION}.amazonaws.com"

    def config(self) -> dict[str, object]:
        csp: dict[str, list[str]] = {
            key: [value] if isinstance(value, str) else list(value)
            for key, value in json.loads(TAURI_CONF.read_text())["app"]["security"]["csp"].items()
        }
        csp["connect-src"] += [self._api, self._uploads]
        csp["img-src"].append(self._api)  # blurred photos: PUBLIC_BASE_URL/media/...
        return {"app": {"security": {"csp": csp}}}


class AndroidBuild:
    """Builds frontend/dist for one stage, then the Tauri Android APK around it."""

    def __init__(self, stage: str, env: dict[str, str]) -> None:
        self._stage = stage
        self._env = env

    def web(self, outputs: dict[str, str], web_url: str) -> None:
        web_env = {key: outputs[name] for key, name in VITE_FROM_OUTPUTS.items()}
        web_env["VITE_API_MODE"] = "live"
        web_env["VITE_WEB_URL"] = web_url  # share links point at the web app, not tauri.localhost
        print("build env:", web_env, flush=True)
        env = {**self._env, **web_env}
        stream(["npm", "ci", "--no-audit", "--no-fund"], FRONTEND, env)
        stream(["npm", "run", "build"], FRONTEND, env)
        STAGE_MARK.write_text(self._stage)

    def apk(self, targets: list[str], csp: StageCsp, debug: bool) -> Path:
        self._check_stage_mark()
        conf = APP / "out" / f"tauri.{self._stage}.conf.json"
        conf.parent.mkdir(exist_ok=True)
        conf.write_text(json.dumps(csp.config(), indent=2))
        stream(["npm", "ci", "--no-audit", "--no-fund"], APP, self._env)
        build = ["npx", "tauri", "android", "build", "--apk", "--ci", "--config", str(conf)]
        build += ["--debug"] if debug else []
        stream([*build, "--target", *targets], APP, self._env)
        variant = "debug" if debug else "release"
        built = GRADLE_APKS / variant / f"app-universal-{variant}.apk"
        if not built.is_file():
            sys.exit(f"tauri finished but {built} is missing")
        out = APP / "out" / f"junksnap-{self._stage}{'-debug' if debug else ''}.apk"
        shutil.copyfile(built, out)
        return out

    def _check_stage_mark(self) -> None:
        """Refuse to package a dist/ built for another stage (or by plain `npm run build`)."""
        built_for = STAGE_MARK.read_text().strip() if STAGE_MARK.is_file() else None
        if built_for != self._stage:
            sys.exit(f"frontend/dist was built for {built_for or 'no known stage'}, not "
                     f"{self._stage}; run without --skip-web")


def stage_web_url(stage: str) -> str:
    app = find_web_app(stage)
    if app is None:
        sys.exit(f"no Amplify app {web_app_name(stage)}; deploy the web app first "
                 f"(uv run scripts/deploy_web.py {stage}), since share links point at it")
    return branch_url(stage, app)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the JunkSnap Android APK.")
    parser.add_argument("stage", nargs="?", default="dev", choices=["dev", "demo"])
    parser.add_argument("--target", nargs="+", default=["aarch64", "x86_64"],
                        choices=["aarch64", "armv7", "i686", "x86_64"],
                        help="ABIs in the APK: aarch64 for phones, x86_64 for the emulator")
    parser.add_argument("--skip-web", action="store_true", help="reuse dist/ built for this stage")
    parser.add_argument("--debug", action="store_true", help="debuggable APK (chrome://inspect)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    os.environ.setdefault("AWS_PROFILE", "junksnap")
    outputs = stack_outputs(f"junksnap-{args.stage}")
    build = AndroidBuild(args.stage, Toolchain().env())
    if not args.skip_web:
        build.web(outputs, stage_web_url(args.stage))
    apk = build.apk(args.target, StageCsp(outputs), args.debug)
    size_mb = apk.stat().st_size / 1_000_000
    print(f"\nAPK ({args.stage}, {size_mb:.1f} MB): {apk}")
    print(f"Install: adb install -r \"{apk}\"  (or copy it to the phone and allow unknown apps)")
    print(f"The {args.stage} api CORS_ORIGINS and UploadOrigins must include {APP_ORIGIN} "
          f"(dev allows any origin; for demo: deploy.py demo --origins <web url>,{APP_ORIGIN}).")


if __name__ == "__main__":
    main()
