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
import com.raptor.player.data.Prefs
import com.raptor.player.ui.Demo
import com.raptor.player.ui.PlayerScreen
import com.raptor.player.ui.StoreScreen
import com.raptor.player.ui.TERMS_VERSION
import com.raptor.player.ui.TermsScreen
import com.raptor.player.ui.theme.RaptorTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()

        val prefs = Prefs(this)

        setContent {
            RaptorTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    var accepted by remember {
                        mutableStateOf(prefs.acceptedTermsVersion() >= TERMS_VERSION)
                    }
                    var demo by remember { mutableStateOf(false) }

                    if (!accepted) {
                        TermsScreen(
                            onAccept = {
                                prefs.acceptTerms(TERMS_VERSION)
                                accepted = true
                            },
                            onDecline = { finish() }
                        )
                    } else if (demo) {
                        PlayerScreen(
                            url = Demo.first.url,
                            title = Demo.first.title,
                            queue = Demo.items,
                            autoAdvance = true,
                            showCastButton = false,
                            onClose = { demo = false }
                        )
                    } else {
                        StoreScreen(onDemo = { demo = true })
                    }
                }
            }
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    /** Esconde barra de status e botões de navegação (imersivo). */
    private fun hideSystemBars() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }
}
