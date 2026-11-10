package com.reptor.player

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
import com.reptor.player.data.Prefs
import com.reptor.player.data.Session
import com.reptor.player.ui.HomeScreen
import com.reptor.player.ui.LoginScreen
import com.reptor.player.ui.TERMS_VERSION
import com.reptor.player.ui.TermsScreen
import com.reptor.player.ui.theme.ReptorTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()

        val prefs = Prefs(this)

        setContent {
            ReptorTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    var session by remember { mutableStateOf<Session?>(prefs.current()) }
                    var accepted by remember {
                        mutableStateOf(prefs.acceptedTermsVersion() >= TERMS_VERSION)
                    }

                    if (!accepted) {
                        // Primeiro acesso (ou termo novo): só libera depois do aceite.
                        TermsScreen(
                            onAccept = {
                                prefs.acceptTerms(TERMS_VERSION)
                                accepted = true
                            },
                            onDecline = { finish() }
                        )
                    } else {
                        val current = session
                        if (current == null) {
                            LoginScreen(
                                onLoggedIn = { logged ->
                                    prefs.saveList(logged)
                                    prefs.setCurrent(logged)
                                    session = logged
                                }
                            )
                        } else {
                            HomeScreen(
                                session = current,
                                onSwitch = {
                                    prefs.setCurrent(null)
                                    session = null
                                }
                            )
                        }
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
