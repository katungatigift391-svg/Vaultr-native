package com.vaultr.cinema

import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    val controller = WindowCompat.getInsetsController(window, window.decorView)
    controller.systemBarsBehavior =
        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

    updateImmersiveBars(resources.configuration.orientation)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    updateImmersiveBars(newConfig.orientation)
  }

  private fun updateImmersiveBars(orientation: Int) {
    val controller = WindowCompat.getInsetsController(window, window.decorView)
    if (orientation == Configuration.ORIENTATION_LANDSCAPE) {
      controller.hide(WindowInsetsCompat.Type.systemBars())
    } else {
      controller.show(WindowInsetsCompat.Type.systemBars())
    }
  }
}
