# Android app: build, release and install

The Android app (`apps/android-tauri/`) is a Tauri 2 shell around the web app's production build (`frontend/dist`). All app logic stays in `frontend/`. The native side is small:
- `MainActivity.kt`: insets, plus print, app settings and `linkReady()` through `window.JunkSnapAndroid`.
- `AppLinks.kt`: hands links that open the app to the page (see Links that open the app).
- `PermissionChromeClient.kt` and `PermissionAsker.kt`: ask for runtime permissions one at a time.
- Two plugins: opener for links, and sharekit for the share sheet.

The app's origin is `https://tauri.localhost`, a secure context, so camera and location work. Each stage's api must allow that origin in `CORS_ORIGINS` and `UploadOrigins`, through `deploy.py <stage> --origins <web url>,https://tauri.localhost`.

## Permissions

The app declares only what it uses, and asks for each at runtime the first time the app needs it:

| Permission | Why | Asked when |
|---|---|---|
| `INTERNET` | api, map tiles, uploads | never; granted at install |
| `ACCESS_NETWORK_STATE` | `navigator.onLine` and the `online` event for the offline queue | never; granted at install |
| `CAMERA` | Snap photos and Scan video (`getUserMedia`, `MediaRecorder`) | first Snap or Scan |
| `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | the GPS fix and the Scan track (`watchPosition`) | first locate, Snap or Scan |

There is no `RECORD_AUDIO`, because video records without sound. There is no storage permission either: print and share go through Android's own screens.

AndroidX adds `com.junksnap.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. It is the app's own signature permission and gives nothing to other apps. Release builds forbid cleartext traffic (`usesCleartextTraffic="false"`).

If the camera is blocked, the Snap help screen offers two ways back:
- **Try again**, which asks Android again.
- **Open app settings**, for when Android no longer asks after "Don't allow" twice. In settings, open Permissions, then Camera, then Allow.

After "Don't allow" for location, the app does not ask again for 5 minutes. The page retries location on its own, and the quiet period keeps the dialog from popping up again and again. Once Android stops asking, location is allowed in the same settings page. A permission that is already allowed is never asked for.

The app answers camera and location prompts one at a time (`PermissionChromeClient.kt`, `PermissionAsker.kt`). wry's own WebView client keeps a single listener, so Snap's simultaneous camera and location prompts used to cross and close the app.

## Links that open the app

A shared link opens in the app when the app is installed, and in the browser when it is not.

**Share pages.** Share buttons send the api's link-preview pages, `https://<CloudFront>/share/sites/{id}` and `/share/areas/{kind}/{id}` (contracts/README.md, Link previews). For an Android browser the page's script first goes to an intent URL, for example:

```
intent://sites/site_jdh_1#Intent;scheme=junksnap;package=com.junksnap.app;S.browser_fallback_url=https%3A%2F%2Fdemo.d3iec0rb3f75jm.amplifyapp.com%2Fsites%2Fsite_jdh_1;end
```

What happens next:
- App installed: Chrome, Samsung Internet, Firefox and the Custom Tabs that WhatsApp and Telegram use open the app at `junksnap://sites/site_jdh_1`.
- App not installed: the browser goes to `browser_fallback_url`, the web app page.
- Browser ignores the intent (some refuse one without a tap): after 2 s the script opens the web app page. The page also shows "Open in the JunkSnap app" and "Open in the browser" links.

iPhones, desktops, crawlers and in-app WebViews (`; wv)`) keep the plain redirect to the web app. This path needs no signing key and no verification, so it works with debug-signed APKs.

**The app's links.** `AndroidManifest.xml` has three VIEW filters on `MainActivity`:
- `junksnap://` with hosts `sites`, `areas` and `activity`.
- `https://d2s7tf4ua41hzf.cloudfront.net` (demo api) with `/share/` and `/sites/`.
- `https://demo.d3iec0rb3f75jm.amplifyapp.com` (demo web app) with `/sites/`, `/areas/` and `/activity/reports/`.

The two https filters have `android:autoVerify="true"`. `AppLinks.kt` takes the link from the launch intent (cold start) or `onNewIntent` (app already open). It waits until the page calls `window.JunkSnapAndroid.linkReady()`, which is origin-checked like the other bridge methods. Then it dispatches a `junksnap:applink` event with the link on `window`. The page (`AppLinkRoutes.ts`, `useAppLinks.ts`) maps the link to its route and opens it as a sheet, so back returns to the map:

| Link | Opens |
|---|---|
| `junksnap://sites/{id}`, `https://<api>/share/sites/{id}`, `https://<web>/sites/{id}` | `/sites/{id}` |
| `junksnap://sites/{id}/letter` | `/sites/{id}/letter` |
| `junksnap://areas/{kind}/{id}`, `https://<api>/share/areas/{kind}/{id}`, `https://<web>/areas/{kind}/{id}` | `/areas/{kind}/{id}` |
| `junksnap://areas/{kind}/{id}/letter` | `/areas/{kind}/{id}/letter` |
| `junksnap://activity/reports/{id}` | `/activity/reports/{id}` |

The page ignores any other link. It checks each id and the area kind and re-encodes them, so a link from another app can open only these screens.

Back on a screen a link opened returns to the app that sent the link, as usual on Android. The WebView skips history entries made without a tap. The sheet's close button returns to the JunkSnap map.

Try it on an emulator or phone:

```
adb shell am start -a android.intent.action.VIEW -d "junksnap://sites/site_jdh_1"
adb shell am start -a android.intent.action.VIEW -d "https://d2s7tf4ua41hzf.cloudfront.net/share/sites/site_jdh_1"
adb shell pm get-app-links com.junksnap.app        # verification state per host
```

### Verified App Links (release key)

The release keystore's SHA-256 certificate fingerprint matches the release key in the `ANDROID_KEYSTORE_B64` secret. It is public:

```
B8:60:4A:F2:0A:0A:F9:1D:E4:A9:1B:BF:18:1E:27:01:FE:AB:E1:6C:44:01:87:EF:24:35:A5:FB:03:2D:A2:D8
```

From `app-v0.1.2` on, release builds from the workflow are signed with this key. To read the fingerprint again, run `keytool -list -v -keystore junksnap-release.jks -alias junksnap`, or `apksigner verify --print-certs <apk>` on a release APK.

Android verifies an https host by fetching `https://<host>/.well-known/assetlinks.json` when the app is installed or updated. On Android 12 and later each host is verified on its own; on Android 11 and older every autoVerify host must pass.
- **api host (CloudFront):** the api serves the file from `ANDROID_CERT_SHA256`, a comma-separated list of fingerprints (contracts/README.md). Unset, the route answers 404. CloudFront's default behaviour already sends `/.well-known/*` to the ALB and the api, uncached, so no infra change is needed. The `demo` overlay (`infra/k8s/overlays/demo/kustomization.yaml`) sets it to the release fingerprint; another stage adds it to its own overlay's `configMapGenerator`, then redeploys. To also verify a debug build, append that machine's debug fingerprint after a comma.
- **web host (Amplify):** `frontend/public/.well-known/assetlinks.json` holds the same JSON, served at `https://demo.d3iec0rb3f75jm.amplifyapp.com/.well-known/assetlinks.json`. The SPA rewrite in `deploy_web.py` leaves `.json` files alone. Keep its fingerprint the same as the overlay's.

Check the result with `curl https://d2s7tf4ua41hzf.cloudfront.net/.well-known/assetlinks.json`, Google's statement tester (`https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://<host>&relation=delegate_permission/common.handle_all_urls`), and `adb shell pm get-app-links com.junksnap.app` after installing a release APK. To re-run verification, use `adb shell pm verify-app-links --re-verify com.junksnap.app`.

A verified host's links open the app straight away. Until a host verifies, and for every debug-signed build:
- Android 11 and older offer "Open with JunkSnap" for those links.
- Android 12 and later open them in the browser. In the browser the share page's intent handoff still opens the app. A person can also allow the links under the app's settings, Open by default, Add links.

Other stages: the https filters name only the demo hosts. Links to `dev` hosts reach the app through the share page's intent handoff, which works for every stage.

## Local build (a developer machine)

```
uv run scripts/build_android.py dev                 # arm64 + x86_64 (emulator), debug key
uv run scripts/build_android.py demo --target aarch64 armv7
```

The script reads the stage's public values itself, from the `junksnap-<stage>` stack outputs and the stage's Amplify app. So run `deploy_web.py <stage>` once first. The APK lands in `apps/android-tauri/out/`.

Without `ANDROID_KEYSTORE_PATH` the release APK is signed with the machine's Android debug key. That key differs per machine, so a phone has to uninstall before it can install a build from another machine.

Toolchain: Rust with the Android targets, JDK 17 or later, and the Android SDK with platform 36, build-tools 36.0.0 and NDK 27.2.12479018. `JAVA_HOME`, `ANDROID_HOME` and `NDK_HOME` default to the standard Windows install paths.

## Release build (GitHub Actions)

Workflow: `.github/workflows/android-release.yml`.
- **Manual run:** Actions, then android-release, then Run workflow, then pick `demo` or `dev`. The version is `0.0.<run number>`, so its versionCode (Tauri: major × 1000000 + minor × 1000 + patch) stays below every `app-v0.1.0`-or-later tag, and a phone with a manual build still takes the next release as an update. The APK is an artifact of the run.
- **Release:** push a tag `app-v<major>.<minor>.<patch>` (`app-v0.1.0` or later; `0.0.x` is for manual runs), for example `git tag app-v1.0.0` then `git push origin app-v1.0.0`. This builds `demo` with that version, and a separate release job publishes it as a GitHub Release. The release holds the APK, its `.sha256` and notes with the SHA-256 and the signing state. The build job can only read the repository. Only the release job can write, and it never sees the keystore.

The APK contains arm64-v8a and armeabi-v7a, which covers practically every Android phone.

### Repository variables (Settings, then Secrets and variables, then Actions, then Variables)

These are public values; they ship inside the app. Set five per stage:

| Variable | Value | From |
|---|---|---|
| `DEMO_API_URL` | CloudFront base URL, no trailing slash | `junksnap-demo` output `PublicBaseUrl` |
| `DEMO_COGNITO_USER_POOL_ID` | `ap-south-1_...` | output `UserPoolId` |
| `DEMO_COGNITO_CLIENT_ID` | app client id | output `UserPoolClientId` |
| `DEMO_WEB_URL` | `https://demo.<Amplify default domain>` | printed by `deploy_web.py demo` |
| `DEMO_UPLOADS_BUCKET` | `junksnap-demo-originals-<account_id>` | output `OriginalsBucketName` |
| `DEV_API_URL`, `DEV_COGNITO_USER_POOL_ID`, `DEV_COGNITO_CLIENT_ID`, `DEV_WEB_URL`, `DEV_UPLOADS_BUCKET` | the same for `dev` | `junksnap-dev` outputs and `deploy_web.py dev` |

A run stops with the missing variable's name if one is not set.

### Repository secrets (Settings, then Secrets and variables, then Actions, then Secrets)

A person adds these by hand; an agent never creates or types them.

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_B64` | the release keystore file (`.jks`), base64 encoded on one line |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | the key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | the key password |

Keep the keystore and its passwords outside the repo, in a password manager. Android only installs updates signed with the same key, so losing it means every user must uninstall to update.

Create the keystore once on your own machine with the JDK's `keytool`, for example:

```
keytool -genkeypair -v -keystore junksnap-release.jks -alias junksnap -keyalg RSA -keysize 4096 -validity 10000
```

`keytool` asks for the passwords and your name details. Then encode the file:
- Windows (PowerShell): `[Convert]::ToBase64String([IO.File]::ReadAllBytes("junksnap-release.jks")) | Set-Clipboard`
- macOS or Linux: `base64 -w0 junksnap-release.jks`

Without `ANDROID_KEYSTORE_B64` the workflow still builds, but it signs with a throwaway debug key made on the runner. The run shows a warning, and the release notes say it is a test build. A tag built this way is published as a prerelease, not as a release. Each such build has a different key, so a phone must uninstall before installing the next one.

The workflow never prints the secrets. GitHub masks them, and only the Gradle signing step receives them (`build_android.py` removes them from the env of the npm steps). The keystore is written to the runner's temp folder and deleted after the build, even when the build fails.

## Install on a phone

- **Download and open:** download the APK (Release asset or run artifact), check its SHA-256 if you like, and open it on the phone. Android asks to allow installs from that app (Chrome or Files) once; allow it, then Install.
- **With a cable:** `adb install -r junksnap-demo-1.0.0.apk`.
- **Signature mismatch:** if Android reports a conflict with an existing package, the installed copy was signed with another key. Uninstall JunkSnap first. This removes the app's offline queue, so send or delete queued reports first.
