package com.raptor.player

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.raptor.player.data.StorePrefs
import com.raptor.player.ui.DemoPlayerScreen
import com.raptor.player.ui.StoreDemo
import com.raptor.player.ui.StoreHomeScreen
import com.raptor.player.ui.STORE_TERMS_VERSION
import com.raptor.player.ui.StoreTermsScreen
import com.raptor.player.ui.theme.RaptorTheme

class StoreMainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()

        val prefs = StorePrefs(this)

        setContent {
            RaptorTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    var accepted by remember {
                        mutableStateOf(prefs.acceptedTermsVersion() >= STORE_TERMS_VERSION)
                    }
                    var demo by remember { mutableStateOf(false) }

                    if (!accepted) {
                        StoreTermsScreen(
                            onAccept = {
                                prefs.acceptTerms(STORE_TERMS_VERSION)
                                accepted = true
                            },
                            onDecline = { finish() }
                        )
                    } else if (demo) {
                        DemoPlayerScreen(
                            url = StoreDemo.items.first().url,
                            title = StoreDemo.items.first().title,
                            queue = StoreDemo.items,
                            autoAdvance = true,
                            showCastButton = false,
                            onClose = { demo = false }
                        )
                    } else {
                        StoreHomeScreen(onDemo = { demo = true })
                    }
                }
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    /** Hides the status bar and navigation buttons (immersive). */
    private fun hideSystemBars() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }
}
