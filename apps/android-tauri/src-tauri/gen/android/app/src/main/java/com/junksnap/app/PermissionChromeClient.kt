package com.junksnap.app

import android.Manifest
import android.graphics.Bitmap
import android.net.Uri
import android.os.Message
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView

/**
 * JunkSnap: answers the page's camera and location prompts one at a time through [PermissionAsker].
 * wry's own client keeps a single listener, so Snap's simultaneous camera and location prompts
 * crossed (one answer reached both requests). Everything else goes to wry's client unchanged.
 */
class PermissionChromeClient(
  private val inner: WebChromeClient,
  private val asker: PermissionAsker,
  private val appHost: String,
) : WebChromeClient() {

  override fun onPermissionRequest(request: PermissionRequest) {
    val camera = request.resources.filter { it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }
    if (camera.isEmpty() || request.origin.scheme != "https" || request.origin.host != appHost) {
      runCatching { request.deny() }
      return
    }
    asker.ask(arrayOf(Manifest.permission.CAMERA)) { granted ->
      runCatching { if (granted) request.grant(camera.toTypedArray()) else request.deny() }
    }
  }

  override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
    val page = Uri.parse(origin)
    if (page.scheme != "https" || page.host != appHost) {
      runCatching { callback.invoke(origin, false, false) }
      return
    }
    val location = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
    // The page retries location by itself, so after "Don't allow" stay quiet for a while.
    asker.ask(location, anyGranted = true, quietMs = LOCATION_QUIET_MS) { granted ->
      runCatching { callback.invoke(origin, granted, false) }
    }
  }

  private companion object {
    const val LOCATION_QUIET_MS = 5 * 60 * 1000L
  }

  override fun onShowCustomView(view: View, callback: CustomViewCallback) = inner.onShowCustomView(view, callback)
  override fun onHideCustomView() = inner.onHideCustomView()
  override fun getDefaultVideoPoster(): Bitmap? = inner.defaultVideoPoster
  override fun onJsAlert(view: WebView, url: String, message: String, result: JsResult) =
    inner.onJsAlert(view, url, message, result)
  override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult) =
    inner.onJsConfirm(view, url, message, result)
  override fun onJsPrompt(view: WebView, url: String, message: String, default: String?, result: JsPromptResult) =
    inner.onJsPrompt(view, url, message, default, result)
  override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams) =
    inner.onShowFileChooser(view, callback, params)
  override fun onConsoleMessage(message: ConsoleMessage) = inner.onConsoleMessage(message)
  override fun onReceivedTitle(view: WebView, title: String?) = inner.onReceivedTitle(view, title)
  override fun onCreateWindow(view: WebView, dialog: Boolean, gesture: Boolean, result: Message) =
    inner.onCreateWindow(view, dialog, gesture, result)
}
