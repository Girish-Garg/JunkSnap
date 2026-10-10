package com.junksnap.app

import android.content.pm.PackageManager
import android.os.SystemClock
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat

/**
 * JunkSnap: asks Android for runtime permissions one request at a time. A request that arrives
 * while a dialog is open waits for it, and identical waiting requests share its answer. Granted
 * permissions answer at once. After a "Don't allow" the same permissions are not asked again
 * while [Ask.quietMs] runs (the page retries location on its own), and never once Android has
 * stopped asking (then only the app's settings can allow them).
 * Create it while the activity is constructed (it registers an activity result launcher).
 */
class PermissionAsker(private val activity: ComponentActivity) {
  private class Ask(
    val permissions: Array<String>,
    val anyGranted: Boolean,
    val quietMs: Long,
    val answer: (Boolean) -> Unit,
  ) {
    val key: String = permissions.sorted().joinToString(",")
  }

  private val queue = ArrayDeque<Ask>()
  private val deniedAt = mutableMapOf<String, Long>()
  private var current: Ask? = null
  private val launcher = activity.registerForActivityResult(
    ActivityResultContracts.RequestMultiplePermissions(),
  ) { results -> finish(decide(current, results.values)) }

  fun ask(permissions: Array<String>, anyGranted: Boolean = false, quietMs: Long = 0, answer: (Boolean) -> Unit) {
    queue.addLast(Ask(permissions, anyGranted, quietMs, answer))
    if (current == null) next()
  }

  private fun next() {
    val ask = queue.removeFirstOrNull() ?: return
    current = ask
    val held = ask.permissions.map {
      ContextCompat.checkSelfPermission(activity, it) == PackageManager.PERMISSION_GRANTED
    }
    when {
      decide(ask, held) -> finish(true)
      stillDenied(ask) -> finish(false)
      else -> launcher.launch(ask.permissions)
    }
  }

  private fun stillDenied(ask: Ask): Boolean {
    val at = deniedAt[ask.key] ?: return false
    val quiet = SystemClock.elapsedRealtime() - at < ask.quietMs
    val androidStoppedAsking = ask.permissions.none { activity.shouldShowRequestPermissionRationale(it) }
    return quiet || androidStoppedAsking
  }

  private fun finish(granted: Boolean) {
    val ask = current ?: return
    current = null
    if (granted) deniedAt.remove(ask.key) else deniedAt[ask.key] = SystemClock.elapsedRealtime()
    val same = queue.filter { it.key == ask.key }
    queue.removeAll(same)
    (listOf(ask) + same).forEach { it.answer(granted) }
    next()
  }

  private fun decide(ask: Ask?, results: Collection<Boolean>): Boolean =
    ask != null && results.isNotEmpty() && if (ask.anyGranted) results.any { it } else results.all { it }
}
