package com.reptor.player.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.reptor.player.data.Activation
import com.reptor.player.data.ContentCache
import com.reptor.player.data.ContentStore
import com.reptor.player.data.MediaEntry
import com.reptor.player.data.MediaKind
import com.reptor.player.data.Prefs
import com.reptor.player.data.Session
import com.reptor.player.data.clearSourceCache
import com.reptor.player.data.createSource
import com.reptor.player.data.displayName
import com.reptor.player.data.key
import com.reptor.player.ui.theme.ReptorGreen
import com.reptor.player.ui.theme.ReptorTextDim
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Casca do app: topo + uma aba por vez + menu inferior.
 * Canais ao vivo ficam somente em Canais, filmes em Filmes e séries em Séries.
 */
private data class PlayRequest(val queue: List<PlayItem>, val index: Int)

@Composable
fun HomeScreen(session: Session, onSwitch: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { Prefs(context) }
    val scope = rememberCoroutineScope()
    val source = remember(session.key()) { createSource(session) }

    var tab by remember { mutableStateOf<Tab?>(null) }
    val deviceCode = remember { Activation.deviceCode(context) }
    var favorites by remember { mutableStateOf(prefs.favorites()) }
    var recents by remember { mutableStateOf(prefs.recents()) }
    var refreshTick by remember { mutableIntStateOf(0) }

    var playing by remember { mutableStateOf<PlayRequest?>(null) }
    var resolving by remember { mutableStateOf(false) }
    var toast by remember { mutableStateOf<String?>(null) }

    // Status da carga única da lista (mostrado no menu principal).
    var preloadLabel by remember { mutableStateOf<String?>("Preparando a lista…") }

    LaunchedEffect(session.key()) {
        // A lista inteira é baixada UMA vez, aqui na entrada do app.
        // Depois disso Canais, Filmes e Séries abrem na hora; só o botão
        // "Atualizar" volta a baixar. Carrega em sequência para não estourar
        // a memória do Fire TV Stick antigo.
        for (kind in listOf(MediaKind.LIVE, MediaKind.VOD, MediaKind.SERIES)) {
            preloadLabel = "Carregando ${kind.label.lowercase()}…"
            try {
                kotlinx.coroutines.withTimeout(LOAD_TIMEOUT_MS) {
                    ContentStore.load(
                        source = source,
                        cacheId = ContentStore.cacheId(session.key(), kind),
                        kind = kind
                    )
                }
            } catch (_: Throwable) {
                // Se uma aba falhar, as outras continuam. Ao abrir a aba que
                // falhou ela tenta carregar de novo, com a mensagem de erro.
            }
        }
        preloadLabel = null
    }

    var clock by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        val format = SimpleDateFormat("HH:mm", Locale.getDefault())
        while (true) {
            clock = format.format(Date())
            // Acorda no início do próximo minuto: antes isso acontecia a cada
            // segundo e recompunha a tela inteira 60x por minuto à toa.
            delay(60_000L - (System.currentTimeMillis() % 60_000L) + 50L)
        }
    }

    fun play(entry: MediaEntry) {
        if (resolving) return
        scope.launch {
            resolving = true
            toast = null
            val url = try {
                source.playUrl(entry)
            } catch (e: Exception) {
                toast = e.message ?: "Não foi possível abrir o item"
                null
            }
            resolving = false
            if (!url.isNullOrBlank()) {
                prefs.addRecent(entry)
                recents = prefs.recents()
                playing = PlayRequest(listOf(PlayItem(url, entry.name)), 0)
            }
        }
    }

    fun toggleFavorite(entry: MediaEntry) {
        prefs.toggleFavorite(entry)
        favorites = prefs.favorites()
    }

    fun playEpisode(queue: List<PlayItem>, index: Int) {
        val item = queue.getOrNull(index)
        if (item == null || item.url.isBlank()) {
            toast = "Episódio sem link de reprodução"
            return
        }
        playing = PlayRequest(queue, index)
    }

    val current = playing
    val open = tab

    BackHandler(enabled = current == null && open != null) { tab = null }

    Box(Modifier.fillMaxSize()) {
        if (open == null) {
            MainMenuScreen(
                accountLabel = session.displayName(),
                deviceCode = deviceCode,
                loadingLabel = preloadLabel,
                onOpen = { tab = it }
            )
        } else {
        Column(Modifier.fillMaxSize()) {
            TopBar(
                title = open.label,
                subtitle = session.displayName(),
                clock = clock,
                onRefresh = { refreshTick++ }
            )

            TopTabs(tab = open, onTab = { tab = it })

            Box(Modifier.weight(1f).fillMaxWidth()) {
                when (open) {
                    Tab.CHANNELS -> ChannelsScreen(
                        source = source,
                        prefs = prefs,
                        favorites = favorites,
                        recents = recents,
                        cacheKey = session.key(),
                        refreshKey = refreshTick,
                        previewEnabled = current == null,
                        onPlay = { play(it) },
                        onToggleFavorite = { toggleFavorite(it) }
                    )

                    Tab.MOVIES -> MoviesScreen(
                        source = source,
                        favorites = favorites,
                        recents = recents,
                        cacheKey = session.key(),
                        refreshKey = refreshTick,
                        onPlay = { play(it) },
                        onToggleFavorite = { toggleFavorite(it) }
                    )

                    Tab.SERIES -> SeriesScreen(
                        source = source,
                        favorites = favorites,
                        recents = recents,
                        cacheKey = session.key(),
                        refreshKey = refreshTick,
                        onPlayEpisode = { queue, index -> playEpisode(queue, index) },
                        onToggleFavorite = { toggleFavorite(it) }
                    )

                    Tab.SETTINGS -> SettingsScreen(
                        session = session,
                        source = source,
                        prefs = prefs,
                        onSwitchList = {
                            ContentCache.clearAll()
                            clearSourceCache()
                            onSwitch()
                        },
                        onRefresh = {
                            ContentCache.clearAll()
                            refreshTick++
                        },
                        onDataCleared = {
                            favorites = prefs.favorites()
                            recents = prefs.recents()
                        }
                    )
                }

                if (resolving) {
                    Box(
                        Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = 0.55f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("Abrindo…", color = ReptorGreen, fontSize = 14.sp)
                            Text(
                                "Conectando ao servidor",
                                color = ReptorTextDim,
                                fontSize = 11.sp
                            )
                        }
                    }
                }

                if (toast != null) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .background(Color(0xFFB71C1C))
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        Text(toast ?: "", color = Color.White, fontSize = 11.sp)
                    }
                }
            }
        }
        }

        // O player fica por cima da casca: assim a aba (série/temporada/episódio
        // escolhido, categoria, rolagem) continua exatamente onde estava.
        if (current != null) {
            val item = current.queue.getOrNull(current.index)
            if (item != null) {
                Box(Modifier.fillMaxSize().background(Color.Black)) {
                    PlayerScreen(
                        url = item.url,
                        title = item.title,
                        queue = current.queue,
                        startIndex = current.index,
                        onClose = { playing = null }
                    )
                }
            }
        }
    }
}
