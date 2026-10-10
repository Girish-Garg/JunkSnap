package com.junksnap.app

import android.content.Intent
import android.webkit.WebView
import org.json.JSONObject

/**
 * Links that open the app (junksnap://sites/..., https share links; AndroidManifest.xml), handed to the
 * page as a `junksnap:applink` event on window. The page maps a link to its route (AppLinkRoutes.ts) and
 * ignores anything else. A link that arrives before the page listens waits until the page calls
 * window.JunkSnapAndroid.linkReady(). Every method runs on the main thread.
 */
class AppLinks(private val isAppPage: (WebView) -> Boolean) {
  private var webView: WebView? = null
  private var pending: String? = null
  private var listening = false

  /** A VIEW intent from onCreate (cold start) or onNewIntent (the app was already open). */
  fun receive(intent: Intent?) {
    if (intent?.action != Intent.ACTION_VIEW) return
    val link = intent?.data ?: return
    if (link.scheme != "junksnap" && link.scheme != "https") return
    pending = link.toString()
    deliver()
  }

  fun attach(view: WebView) {
    webView = view
  }

  /** The page's listener is set. */
  fun ready() {
    listening = true
    deliver()
  }

  private fun deliver() {
    val view = webView ?: return
    val link = pending ?: return
    if (!listening || !isAppPage(view)) return
    pending = null
    val event = "new CustomEvent('junksnap:applink',{detail:${JSONObject.quote(link)}})"
    view.evaluateJavascript("window.dispatchEvent($event)", null)
  }
}
