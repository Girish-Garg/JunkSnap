# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Build the JunkSnap Android app (Tauri 2) against one stage and print the APK path.

Usage: uv run scripts/build_android.py dev [--target aarch64 x86_64] [--skip-web] [--debug]
       [--settings aws|env] [--version 1.2.3]
Gets the stage's public values (android_stage.py): from the junksnap-<stage> stack outputs and
the stage's Amplify app (--settings aws, local), or from env vars (--settings env, CI). Builds
frontend/dist with them and marks it with the stage in dist/.stage, then runs
`tauri android build --apk` in apps/android-tauri. The stage's api origin and originals bucket
are added to the CSP in tauri.conf.json for that build only. The release APK is signed with the
keystore named by ANDROID_KEYSTORE_PATH (with ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS and
ANDROID_KEY_PASSWORD) when set, else with the Android SDK debug key; --debug builds a
debuggable APK whose WebView shows in chrome://inspect. Install with `adb install -r <apk>` or
copy it to the phone. The stage's api CORS_ORIGINS and UploadOrigins must include
https://tauri.localhost. Releases: docs/android.md.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

from android_stage import StageSettings
from deploy import ROOT

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


def without_signing(env: dict[str, str]) -> dict[str, str]:
    """The env minus the release-signing variables, for steps that run npm packages."""
    return {key: value for key, value in env.items() if not key.startswith("ANDROID_KEY")}


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
        if not env.get("NDK_HOME"):
            env["NDK_HOME"] = str(self._newest_ndk(Path(env["ANDROID_HOME"])))
        cargo_bin = Path.home() / ".cargo" / "bin"
        env["PATH"] = os.pathsep.join([str(cargo_bin), env.get("PATH", "")])
        return env

    @staticmethod
    def _newest_ndk(sdk: Path) -> Path:
        versions = sorted((sdk / "ndk").glob("*"), key=lambda p: p.name)
        if not versions:
            sys.exit(f"no NDK under {sdk / 'ndk'}; install NDK (Side by side) in the SDK Manager")
        return versions[-1]


class StageConfig:
    """Per-build Tauri config: the CSP plus this stage's api and upload hosts, and the version."""

    def __init__(self, settings: StageSettings, version: str | None) -> None:
        self._api, self._uploads = settings.csp_sources()
        self._version = version

    def config(self) -> dict[str, object]:
        csp: dict[str, list[str]] = {
            key: [value] if isinstance(value, str) else list(value)
            for key, value in json.loads(TAURI_CONF.read_text())["app"]["security"]["csp"].items()
        }
        csp["connect-src"] += [self._api, self._uploads]
        csp["img-src"].append(self._api)  # blurred photos: PUBLIC_BASE_URL/media/...
        config: dict[str, object] = {"app": {"security": {"csp": csp}}}
        if self._version:
            config["version"] = self._version  # versionName; Tauri derives versionCode from it
        return config


class AndroidBuild:
    """Builds frontend/dist for one stage, then the Tauri Android APK around it."""

    def __init__(self, stage: str, env: dict[str, str]) -> None:
        self._stage = stage
        self._env = env

    def web(self, settings: StageSettings) -> None:
        web_env = settings.vite_env()
        print("build env:", web_env, flush=True)  # public values only
        env = {**without_signing(self._env), **web_env}
        stream(["npm", "ci", "--no-audit", "--no-fund"], FRONTEND, env)
        stream(["npm", "run", "build"], FRONTEND, env)
        STAGE_MARK.write_text(self._stage)

    def apk(self, targets: list[str], stage_config: StageConfig, debug: bool) -> Path:
        self._check_stage_mark()
        conf = APP / "out" / f"tauri.{self._stage}.conf.json"
        conf.parent.mkdir(exist_ok=True)
        conf.write_text(json.dumps(stage_config.config(), indent=2))
        stream(["npm", "ci", "--no-audit", "--no-fund"], APP, without_signing(self._env))
        # Only the Tauri build (Gradle signs the APK) sees ANDROID_KEYSTORE_* and ANDROID_KEY_*.
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the JunkSnap Android APK.")
    parser.add_argument("stage", nargs="?", default="dev", choices=["dev", "demo"])
    parser.add_argument("--target", nargs="+", default=["aarch64", "x86_64"],
                        choices=["aarch64", "armv7", "i686", "x86_64"],
                        help="ABIs in the APK: aarch64 and armv7 for phones, x86_64 for emulators")
    parser.add_argument("--skip-web", action="store_true", help="reuse dist/ built for this stage")
    parser.add_argument("--debug", action="store_true", help="debuggable APK (chrome://inspect)")
    parser.add_argument("--settings", choices=["aws", "env"], default="aws",
                        help="stage values from AWS (local) or env vars (CI)")
    parser.add_argument("--version", help="app version such as 1.2.3 (default: tauri.conf.json)")
    return parser.parse_args()


def signing_note() -> str:
    if os.environ.get("ANDROID_KEYSTORE_PATH"):
        return "signed with the release keystore"
    return "signed with the Android SDK DEBUG key, for testing only"


def main() -> None:
    args = parse_args()
    os.environ.setdefault("AWS_PROFILE", "junksnap")
    from_aws = args.settings == "aws"
    settings = StageSettings.from_aws(args.stage) if from_aws else StageSettings.from_env()
    build = AndroidBuild(args.stage, Toolchain().env())
    if not args.skip_web:
        build.web(settings)
    apk = build.apk(args.target, StageConfig(settings, args.version), args.debug)
    size_mb = apk.stat().st_size / 1_000_000
    print(f"\nAPK ({args.stage}, {size_mb:.1f} MB, {signing_note()}): {apk}")
    print(f"Install: adb install -r \"{apk}\"  (or copy it to the phone and allow unknown apps)")
    print(f"The {args.stage} api CORS_ORIGINS and UploadOrigins must include {APP_ORIGIN} "
          f"(dev allows any origin; for demo: deploy.py demo --origins <web url>,{APP_ORIGIN}).")


if __name__ == "__main__":
    main()
