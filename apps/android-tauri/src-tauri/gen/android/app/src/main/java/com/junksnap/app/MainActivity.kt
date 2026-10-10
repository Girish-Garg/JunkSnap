package com.junksnap.app

import android.net.Uri
import android.os.Bundle
import android.print.PrintManager
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    keepWebViewInsideSystemBars(findViewById(android.R.id.content))
  }

  // JunkSnap: the Android WebView ignores window.print(), so letters print through
  // window.JunkSnapPrint.print() instead (the system print dialog has Save as PDF).
  override fun onWebViewCreate(webView: WebView) {
    webView.addJavascriptInterface(LetterPrinter(webView), "JunkSnapPrint")
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

  /** The one native method the page gets: print the current page, only for the app's origin. */
  private inner class LetterPrinter(private val webView: WebView) {
    @JavascriptInterface
    fun print() {
      webView.post {
        val page = Uri.parse(webView.url ?: "")
        if (page.scheme == "https" && page.host == APP_HOST) {
          val printer = getSystemService(PRINT_SERVICE) as PrintManager
          printer.print("JunkSnap letter", webView.createPrintDocumentAdapter("JunkSnap letter"), null)
        }
      }
    }
  }

  private companion object {
    const val APP_HOST = "tauri.localhost"
  }
}
