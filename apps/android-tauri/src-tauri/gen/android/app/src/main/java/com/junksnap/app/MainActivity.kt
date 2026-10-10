package com.junksnap.app

import android.os.Bundle
import android.view.View
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    keepWebViewInsideSystemBars(findViewById(android.R.id.content))
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
}
