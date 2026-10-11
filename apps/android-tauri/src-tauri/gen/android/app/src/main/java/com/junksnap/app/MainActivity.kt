package com.junksnap.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.print.PrintManager
import android.provider.Settings
import android.util.Log
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  private val asker = PermissionAsker(this)
  private val links = AppLinks(::isAppPage)

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    keepWebViewInsideSystemBars(findViewById(android.R.id.content))
    // JunkSnap: a link that started the app (cold start); not again when Android restores it.
    if (savedInstanceState == null) links.receive(intent)
  }

  // JunkSnap: a link that opened the app while it was already running (launchMode singleTask).
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    links.receive(intent)
  }

  // JunkSnap: the Android WebView ignores window.print(), and once camera or location is
  // denied with "don't ask again" only the app's settings page can allow it again.
  override fun onWebViewCreate(webView: WebView) {
    links.attach(webView)
    webView.addJavascriptInterface(AppBridge(webView), "JunkSnapAndroid")
    // wry sets its WebChromeClient right after this call; wrap it once it is there so camera and
    // location prompts are asked one at a time (PermissionChromeClient). Needs API 26.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      webView.post {
        webView.webChromeClient?.let { webView.webChromeClient = PermissionChromeClient(it, asker, APP_HOST) }
      }
    }
  }

  // JunkSnap: on API 24-25 wry's client still answers prompts, and with Snap's simultaneous
  // camera and location prompts one answer can reach a request twice; its second grant() throws.
  // Ignore that repeat instead of closing the app; the page then offers Try again.
  @Deprecated("ActivityResult API; kept to guard wry's permission callback")
  override fun onRequestPermissionsResult(code: Int, permissions: Array<String>, results: IntArray) {
    try {
      super.onRequestPermissionsResult(code, permissions, results)
    } catch (repeat: IllegalStateException) {
      Log.w("JunkSnap", "ignored a repeated WebView permission answer", repeat)
    }
  }

  // JunkSnap: Android 15+ always draws apps edge to edge, and the WebView does not pass the
  // system bar insets to CSS env(safe-area-inset-*), so the bottom nav would sit under the
  // gesture bar. Pad the content by the bars, the cutout and the keyboard instead.
  private fun keepWebViewInsideSystemBars(content: View) {
    ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
      val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
      )
      val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime())
      view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, keyboard.bottom))
      WindowInsetsCompat.CONSUMED
    }
  }

  /** The page's only native methods (window.JunkSnapAndroid), each only for the app's origin. */
  private inner class AppBridge(private val webView: WebView) {
    /** The system print dialog for the current page; it offers Save as PDF. */
    @JavascriptInterface
    fun print() = onAppPage {
      val printer = getSystemService(PRINT_SERVICE) as PrintManager
      printer.print("JunkSnap letter", webView.createPrintDocumentAdapter("JunkSnap letter"), null)
    }

    /** This app's page in Android settings, where Permissions can be allowed again. */
    @JavascriptInterface
    fun openAppSettings() = onAppPage {
      val details = Uri.fromParts("package", packageName, null)
      startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, details))
    }

    /**
     * Whether Android lets the app read location, answered as a junksnap:location event on window. The WebView's
     * permissions.query never says (location prompts are answered without remembering), so the page asks here when it
     * comes back from the app's settings.
     */
    @JavascriptInterface
    fun checkLocation() = onAppPage {
      val allowed = LOCATION_PERMISSIONS.any {
        ContextCompat.checkSelfPermission(this@MainActivity, it) == PackageManager.PERMISSION_GRANTED
      }
      webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('junksnap:location',{detail:$allowed}))", null)
    }

    /** The page listens for links that open the app (AppLinks); one that came before is handed over now. */
    @JavascriptInterface
    fun linkReady() = onAppPage { links.ready() }

    private fun onAppPage(action: () -> Unit) {
      webView.post {
        if (isAppPage(webView)) action()
      }
    }
  }

  /** The WebView shows the app's own page (https://tauri.localhost), not another site. Main thread. */
  private fun isAppPage(webView: WebView): Boolean {
    val page = Uri.parse(webView.url ?: "")
    return page.scheme == "https" && page.host == APP_HOST
  }

  private companion object {
    const val APP_HOST = "tauri.localhost"
    val LOCATION_PERMISSIONS = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
  }
}
