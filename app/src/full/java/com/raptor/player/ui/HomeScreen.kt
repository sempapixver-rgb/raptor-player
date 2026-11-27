package com.raptor.player.ui

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
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.raptor.player.data.Activation
import com.raptor.player.data.ContentStore
import com.raptor.player.data.MediaEntry
import com.raptor.player.data.Prefs
import com.raptor.player.data.Session
import com.raptor.player.data.clearSourceCache
import com.raptor.player.data.createSource
import com.raptor.player.data.displayName
import com.raptor.player.data.key
import com.raptor.player.ui.theme.RaptorGreen
import com.raptor.player.ui.theme.RaptorTextDim
import kotlinx.coroutines.launch


/**
 * Casca do app: topo + uma aba por vez + menu inferior.
 * Canais ao vivo ficam somente em Canais, filmes em Filmes e séries em Séries.
 */
private data class PlayRequest(
    val queue: List<PlayItem>,
    val index: Int,
    val autoAdvance: Boolean = false,
    // Canais ao vivo não podem ser arrastados: seek congela a transmissão.
    val allowSeek: Boolean = true
)

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

    // Status da preparação da lista (mostrado no menu principal).
    var preloadLabel by remember { mutableStateOf<String?>("Preparando a lista…") }

    LaunchedEffect(session.key()) {
        // Igual à versão da LG: na entrada baixa SÓ as pastas (categorias) das
        // três abas. É uma resposta pequena e rápida. Os itens de cada pasta
        // são baixados quando a pasta é aberta — nunca a lista inteira, que
        // passa de 8 MB e derrubava o Fire TV Stick antigo.
        try {
            kotlinx.coroutines.withTimeout(LOAD_TIMEOUT_MS) {
                ContentStore.preloadCategories(source, session.key())
            }
        } catch (_: Throwable) {
            // Se falhar, cada aba tenta de novo ao abrir, com a mensagem de erro.
        }
        preloadLabel = null
    }



    /**
     * Abre um canal/filme. [queue] é a página visível: com ela os botões
     * Anterior/Próximo funcionam também em Canais e Filmes.
     */
    fun play(
        entry: MediaEntry,
        queue: List<MediaEntry> = emptyList(),
        allowSeek: Boolean = true
    ) {
        if (resolving) return
        scope.launch {
            resolving = true
            toast = null
            try {
                val url = source.playUrl(entry)
                if (url.isNullOrBlank()) {
                    toast = "Item sem link de reprodução"
                    return@launch
                }
                val items = ArrayList<PlayItem>(queue.size.coerceAtLeast(1))
                var start = 0
                if (queue.size > 1) {
                    for (e in queue) {
                        val u = if (e.id == entry.id) url
                        else runCatching { source.playUrl(e) }.getOrNull()
                        if (u.isNullOrBlank()) continue
                        if (e.id == entry.id) start = items.size
                        items.add(PlayItem(u, e.name))
                    }
                }
                if (items.isEmpty()) items.add(PlayItem(url, entry.name))
                prefs.addRecent(entry)
                recents = prefs.recents()
                playing = PlayRequest(
                    items,
                    start.coerceIn(0, items.lastIndex),
                    autoAdvance = false,
                    allowSeek = allowSeek
                )
            } catch (e: Exception) {
                toast = e.message ?: "Não foi possível abrir o item"
            } finally {
                resolving = false
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
        playing = PlayRequest(queue, index, autoAdvance = true, allowSeek = true)
    }

    val current = playing
    val open = tab

    BackHandler(enabled = current == null && open != null) { tab = null }

    Box(
        Modifier
            .fillMaxSize()
            .onPreviewKeyEvent { event ->
                // Botão ☰ (Menu) do controle do Fire TV: abre/fecha os Ajustes.
                if (current == null && event.type == KeyEventType.KeyDown && event.key == Key.Menu) {
                    tab = if (tab == Tab.SETTINGS) null else Tab.SETTINGS
                    true
                } else {
                    false
                }
            }
    ) {
        if (open == null) {
            MainMenuScreen(
                accountLabel = session.displayName(),
                deviceCode = deviceCode,
                loadingLabel = preloadLabel,
                onOpen = { tab = it }
            )
        } else {
        Column(Modifier.fillMaxSize()) {
            // Topo limpo: sem "RAPTOR", nome da conta, relógio ou botão
            // Atualizar — tudo isso roubava altura da lista. A atualização
            // do catálogo continua disponível em Ajustes.
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
                        onPlay = { entry, queue -> play(entry, queue, allowSeek = false) },
                        onToggleFavorite = { toggleFavorite(it) }
                    )

                    Tab.MOVIES -> MoviesScreen(
                        source = source,
                        favorites = favorites,
                        recents = recents,
                        cacheKey = session.key(),
                        refreshKey = refreshTick,
                        active = current == null,
                        onPlay = { entry, queue -> play(entry, queue, allowSeek = true) },
                        onToggleFavorite = { toggleFavorite(it) }
                    )

                    Tab.SERIES -> SeriesScreen(
                        source = source,
                        favorites = favorites,
                        recents = recents,
                        cacheKey = session.key(),
                        refreshKey = refreshTick,
                        active = current == null,
                        onPlayEpisode = { queue, index -> playEpisode(queue, index) },
                        onToggleFavorite = { toggleFavorite(it) }
                    )

                    Tab.SETTINGS -> SettingsScreen(
                        session = session,
                        source = source,
                        prefs = prefs,
                        onSwitchList = {
                            ContentStore.clearAll()
                            clearSourceCache()
                            onSwitch()
                        },
                        onRefresh = {
                            ContentStore.clearAll()
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
                            Text("Abrindo…", color = RaptorGreen, fontSize = 14.sp)
                            Text(
                                "Conectando ao servidor",
                                color = RaptorTextDim,
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
                        autoAdvance = current.autoAdvance,
                        allowSeek = current.allowSeek,
                        onClose = { playing = null }
                    )
                }
            }
        }
    }
}
