# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Build the JunkSnap Android app (Tauri 2) against one stage and print the APK path.

Usage: uv run scripts/build_android.py dev [--target aarch64 x86_64] [--skip-web]
Reads VITE_API_URL and the Cognito ids from the junksnap-<stage> stack outputs (as
deploy_web.py does), builds frontend/dist, then runs `tauri android build --apk` in
apps/android-tauri. The release APK is signed with the Android SDK debug key (no release
keystore); install it with `adb install -r <apk>` or copy it to the phone. The stage's api
CORS_ORIGINS must include https://tauri.localhost (the app's WebView origin).
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

from deploy import ROOT
from deploy_web import VITE_FROM_OUTPUTS, stack_outputs

APP = ROOT / "apps" / "android-tauri"
FRONTEND = ROOT / "frontend"
GRADLE_APK = APP / "src-tauri/gen/android/app/build/outputs/apk/universal/release"
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


class AndroidBuild:
    """Builds frontend/dist for one stage, then the Tauri Android APK around it."""

    def __init__(self, stage: str, env: dict[str, str]) -> None:
        self._stage = stage
        self._env = env

    def web(self, outputs: dict[str, str]) -> None:
        web_env = {key: outputs[name] for key, name in VITE_FROM_OUTPUTS.items()}
        web_env["VITE_API_MODE"] = "live"
        print("build env:", web_env, flush=True)
        env = {**self._env, **web_env}
        stream(["npm", "ci", "--no-audit", "--no-fund"], FRONTEND, env)
        stream(["npm", "run", "build"], FRONTEND, env)

    def apk(self, targets: list[str]) -> Path:
        if not (FRONTEND / "dist" / "index.html").is_file():
            sys.exit("no frontend/dist/index.html; run without --skip-web first")
        stream(["npm", "ci", "--no-audit", "--no-fund"], APP, self._env)
        build = ["npx", "tauri", "android", "build", "--apk", "--ci", "--target", *targets]
        stream(build, APP, self._env)
        built = GRADLE_APK / "app-universal-release.apk"
        if not built.is_file():
            sys.exit(f"tauri finished but {built} is missing")
        out = APP / "out" / f"junksnap-{self._stage}.apk"
        out.parent.mkdir(exist_ok=True)
        shutil.copyfile(built, out)
        return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the JunkSnap Android APK.")
    parser.add_argument("stage", nargs="?", default="dev", choices=["dev", "demo"])
    parser.add_argument("--target", nargs="+", default=["aarch64", "x86_64"],
                        choices=["aarch64", "armv7", "i686", "x86_64"],
                        help="ABIs in the APK: aarch64 for phones, x86_64 for the emulator")
    parser.add_argument("--skip-web", action="store_true", help="reuse the existing dist/")
    args = parser.parse_args()
    os.environ.setdefault("AWS_PROFILE", "junksnap")
    build = AndroidBuild(args.stage, Toolchain().env())
    if not args.skip_web:
        build.web(stack_outputs(f"junksnap-{args.stage}"))
    apk = build.apk(args.target)
    size_mb = apk.stat().st_size / 1_000_000
    print(f"\nAPK ({args.stage}, {size_mb:.1f} MB): {apk}")
    print(f"Install: adb install -r \"{apk}\"  (or copy it to the phone and allow unknown apps)")
    print(f"The {args.stage} api CORS_ORIGINS and UploadOrigins must include {APP_ORIGIN} "
          f"(dev allows any origin; for demo: deploy.py demo --origins <web url>,{APP_ORIGIN}).")


if __name__ == "__main__":
    main()
