package com.reptor.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.common.MediaItem as ExoMediaItem
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.reptor.player.data.Category
import com.reptor.player.data.ChannelEpg
import com.reptor.player.data.ContentCache
import com.reptor.player.data.EpgClient
import com.reptor.player.data.EpgProgram
import com.reptor.player.data.MediaEntry
import com.reptor.player.data.MediaKind
import com.reptor.player.data.PlaylistSource
import com.reptor.player.data.Prefs
import com.reptor.player.ui.theme.ReptorGreen
import com.reptor.player.ui.theme.ReptorOutline
import com.reptor.player.ui.theme.ReptorSurfaceHigh
import com.reptor.player.ui.theme.ReptorText
import com.reptor.player.ui.theme.ReptorTextDim
import java.util.Calendar

@Composable
fun ChannelsScreen(
    source: PlaylistSource,
    prefs: Prefs,
    favorites: List<MediaEntry>,
    recents: List<MediaEntry>,
    cacheKey: String = "",
    refreshKey: Int = 0,
    previewEnabled: Boolean = true,
    onPlay: (MediaEntry) -> Unit,
    onToggleFavorite: (MediaEntry) -> Unit
) {
    var categories by remember { mutableStateOf<List<Category>>(emptyList()) }
    var allItems by remember { mutableStateOf<List<MediaEntry>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var retry by remember { mutableIntStateOf(0) }

    var filter by remember { mutableStateOf(Filter.ALL) }
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var query by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf<MediaEntry?>(null) }

    var epgBoard by remember { mutableStateOf<List<EpgClient.Entry>>(emptyList()) }
    var epg by remember { mutableStateOf<ChannelEpg?>(null) }
    var epgLoading by remember { mutableStateOf(false) }
    var previewUrl by remember { mutableStateOf<String?>(null) }

    val cacheId = "$cacheKey|LIVE"
    val mountRefreshKey = remember { refreshKey }

    LaunchedEffect(retry, refreshKey) {
        // Ao voltar para esta aba o conteúdo já carregado é reaproveitado na
        // hora. Só baixa de novo quando o usuário pede "Atualizar" (refreshKey)
        // ou tenta novamente depois de um erro (retry).
        val isRefresh = refreshKey != mountRefreshKey
        if (retry == 0 && !isRefresh) {
            val cachedCategories = ContentCache.categories(cacheId)
            val cachedItems = ContentCache.items(cacheId)
            if (cachedCategories != null && cachedItems != null) {
                categories = cachedCategories
                allItems = cachedItems
                if (selected == null) selected = allItems.firstOrNull()
                loading = false
                return@LaunchedEffect
            }
        }

        if (isRefresh) ContentCache.clear(cacheId)

        loading = true
        error = null
        try {
            categories = source.categories(MediaKind.LIVE)
            allItems = source.items(MediaKind.LIVE, null)
            ContentCache.putCategories(cacheId, categories)
            ContentCache.putItems(cacheId, allItems)
            if (selected == null) selected = allItems.firstOrNull()
        } catch (e: Exception) {
            error = e.message ?: "Falha ao carregar os canais"
        } finally {
            loading = false
        }
    }

    // Grade do meuguia.tv: uma carga só, reaproveitada por todos os canais.
    LaunchedEffect(Unit) {
        runCatching { EpgClient.board() }.onSuccess { epgBoard = it }
    }

    // URL de prévia do canal selecionado.
    LaunchedEffect(selected?.id) {
        previewUrl = null
        val channel = selected ?: return@LaunchedEffect
        previewUrl = runCatching { source.playUrl(channel) }.getOrNull()
    }

    // Programação do canal selecionado.
    LaunchedEffect(selected?.id, epgBoard) {
        val channel = selected ?: return@LaunchedEffect
        epg = null
        epgLoading = true
        val entry = EpgClient.find(epgBoard, channel.name)
        if (entry != null) {
            val day = runCatching { EpgClient.schedule(entry.code) }.getOrNull().orEmpty()
            val programs = if (day.isNotEmpty()) day else entry.programs
            epg = ChannelEpg(entry.name, programs)
        }
        epgLoading = false
    }

    val favoritesLive = remember(favorites) { favorites.filter { it.kind == MediaKind.LIVE } }
    val recentsLive = remember(recents) { recents.filter { it.kind == MediaKind.LIVE } }
    val favoriteIds = remember(favoritesLive) { favoritesLive.mapTo(HashSet()) { it.id } }

    val visible = remember(filter, selectedCategory, query, allItems, favoritesLive, recentsLive) {
        val base = when (filter) {
            Filter.FAVORITES -> favoritesLive
            Filter.RECENTS -> recentsLive
            Filter.ALL -> allItems.filter {
                selectedCategory == null || selectedCategory in it.allCategoryIds()
            }
        }
        if (query.isBlank()) base
        else base.filter { it.name.contains(query.trim(), ignoreCase = true) }
    }

    if (loading) {
        LoadingBox("Carregando canais…")
        return
    }
    if (error != null) {
        ErrorBox(error ?: "", onRetry = { retry++ })
        return
    }

    val counts = remember(allItems) {
        val map = HashMap<String, Int>()
        allItems.forEach { entry ->
            entry.allCategoryIds().forEach { id ->
                map[id] = (map[id] ?: 0) + 1
            }
        }
        map
    }

    Row(Modifier.fillMaxSize()) {
        CategoryPanel(
            categories = categories,
            filter = filter,
            onFilter = { filter = it },
            selectedCategory = selectedCategory,
            onCategory = { selectedCategory = it },
            counts = counts,
            totalCount = allItems.size,
            favoritesCount = favoritesLive.size,
            recentsCount = recentsLive.size,
            modifier = Modifier.width(196.dp)
        )

        VerticalSeparator()

        // ------------------------------------------------ lista de canais
        Column(Modifier.width(300.dp).fillMaxHeight()) {
            SearchField(
                value = query,
                onValueChange = { query = it },
                placeholder = "Busca canais",
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 10.dp, vertical = 8.dp)
            )

            if (visible.isEmpty()) {
                EmptyBox(
                    when (filter) {
                        Filter.FAVORITES -> "Nenhum canal favorito."
                        Filter.RECENTS -> "Nenhum canal visto ainda."
                        Filter.ALL -> "Nenhum canal nesta categoria."
                    }
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(count = visible.size, key = { visible[it].id }) { index ->
                        val channel = visible[index]
                        ChannelRow(
                            number = index + 1,
                            entry = channel,
                            isFavorite = channel.id in favoriteIds,
                            selected = selected?.id == channel.id,
                            onClick = { selected = channel },
                            onStar = { onToggleFavorite(channel) }
                        )
                    }
                }
            }
        }

        VerticalSeparator()

        // --------------------------------------------- prévia + programação
        ChannelDetail(
            channel = selected,
            previewUrl = previewUrl,
            previewEnabled = previewEnabled,
            epg = epg,
            epgLoading = epgLoading,
            isFavorite = selected != null && selected?.id in favoriteIds,
            onPlay = { channel -> onPlay(channel) },
            onStar = { channel -> onToggleFavorite(channel) },
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun VerticalSeparator() {
    Box(
        Modifier
            .width(1.dp)
            .fillMaxHeight()
            .background(ReptorOutline.copy(alpha = 0.45f))
    )
}

@Composable
private fun ChannelDetail(
    channel: MediaEntry?,
    previewUrl: String?,
    previewEnabled: Boolean,
    epg: ChannelEpg?,
    epgLoading: Boolean,
    isFavorite: Boolean,
    onPlay: (MediaEntry) -> Unit,
    onStar: (MediaEntry) -> Unit,
    modifier: Modifier = Modifier
) {
    if (channel == null) {
        Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text("Selecione um canal na lista", color = ReptorTextDim, fontSize = 13.sp)
        }
        return
    }

    var muted by remember { mutableStateOf(true) }

    val nowMinutes = remember { mutableIntStateOf(nowInMinutes()) }
    LaunchedEffect(Unit) {
        while (true) {
            nowMinutes.intValue = nowInMinutes()
            kotlinx.coroutines.delay(30_000)
        }
    }

    val current = epg?.current(nowMinutes.intValue)
    val next = epg?.upcoming(nowMinutes.intValue, 6).orEmpty()

    Row(
        modifier = modifier.fillMaxSize().padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // ------------------------------------------- coluna esquerda: prévia
        Column(Modifier.weight(1f).fillMaxHeight()) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .aspectRatio(16f / 9f)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.Black)
            ) {
                LivePreview(
                    url = previewUrl,
                    muted = muted,
                    enabled = previewEnabled,
                    modifier = Modifier.fillMaxSize()
                )

                if (previewUrl == null) {
                    Text(
                        text = "Sem sinal de prévia",
                        color = ReptorTextDim,
                        fontSize = 12.sp,
                        modifier = Modifier.align(Alignment.Center)
                    )
                }

                Row(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(8.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    MiniButton(if (muted) "🔇" else "🔊") { muted = !muted }
                    MiniButton("⛶") { onPlay(channel) }
                }

                Box(
                    Modifier
                        .align(Alignment.TopStart)
                        .padding(8.dp)
                        .clip(RoundedCornerShape(5.dp))
                        .background(Color(0xFFD32F2F))
                        .padding(horizontal = 7.dp, vertical = 2.dp)
                ) {
                    Text("AO VIVO", color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(Modifier.height(10.dp))

        // ---------------------------------------------------------- cabeçalho
        Text(
            text = channel.name,
            color = ReptorText,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Text(
            text = epg?.channelName ?: "Programação não encontrada",
            color = ReptorTextDim,
            fontSize = 11.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )

        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            ActionButton(if (isFavorite) "★ Favorito" else "☆ Favoritar") { onStar(channel) }
            ActionButton("▶ Assistir", primary = true) { onPlay(channel) }
        }

        Spacer(Modifier.height(10.dp))
        HorizontalDivider(color = ReptorOutline.copy(alpha = 0.4f))
        Spacer(Modifier.height(8.dp))

        Text("CATEGORIA", color = ReptorGreen, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(3.dp))
        Text(
            text = channel.categoryId ?: "Canais",
            color = ReptorText,
            fontSize = 12.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Spacer(Modifier.height(8.dp))
        Text("SINAL", color = ReptorGreen, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(3.dp))
        Text("Ao vivo", color = ReptorText, fontSize = 12.sp)
        }

        // ------------------------------------------------ coluna direita: EPG
        Column(Modifier.width(178.dp).fillMaxHeight()) {
        Text("AGORA", color = ReptorGreen, fontSize = 10.sp, fontWeight = FontWeight.Bold)

        if (epgLoading) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                CircularProgressIndicator(color = ReptorGreen, strokeWidth = 2.dp, modifier = Modifier.width(16.dp))
                Spacer(Modifier.width(8.dp))
                Text("Carregando programação…", color = ReptorTextDim, fontSize = 12.sp)
            }
        } else if (current == null) {
            Text(
                text = "Programação indisponível para este canal.",
                color = ReptorTextDim,
                fontSize = 12.sp,
                modifier = Modifier.padding(top = 6.dp)
            )
        } else {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 6.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(ReptorGreen.copy(alpha = 0.10f))
                    .padding(horizontal = 10.dp, vertical = 8.dp)
            ) {
                Text(
                    text = current.title,
                    color = ReptorText,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${current.start} · ${current.genre ?: "Ao vivo"}",
                    color = ReptorTextDim,
                    fontSize = 10.sp
                )
            }

            Spacer(Modifier.height(10.dp))
            Text("A SEGUIR", color = ReptorGreen, fontSize = 10.sp, fontWeight = FontWeight.Bold)

            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(top = 4.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                items(count = next.size, key = { index -> next[index].start + "#" + index }) { index ->
                    val program: EpgProgram = next[index]
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(7.dp))
                            .background(ReptorSurfaceHigh.copy(alpha = 0.45f))
                            .padding(horizontal = 10.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = program.start,
                            color = ReptorGreen,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.width(46.dp)
                        )
                        Column(Modifier.weight(1f)) {
                            Text(
                                text = program.title,
                                color = ReptorText,
                                fontSize = 12.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            if (!program.genre.isNullOrBlank()) {
                                Text(
                                    text = program.genre,
                                    color = ReptorTextDim,
                                    fontSize = 9.sp,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }
                    }
                }
            }
        }
        }
    }
}

@Composable
private fun MiniButton(label: String, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Box(
        Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (focused) ReptorGreen.copy(alpha = 0.22f) else Color.Black.copy(alpha = 0.55f))
            .border(
                width = if (focused) 1.5.dp else 0.dp,
                color = if (focused) ReptorGreen else Color.Transparent,
                shape = RoundedCornerShape(6.dp)
            )
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 3.dp)
    ) {
        Text(label, color = if (focused) ReptorGreen else Color.White, fontSize = 12.sp)
    }
}

@Composable
private fun ActionButton(label: String, primary: Boolean = false, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Box(
        Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(
                when {
                    primary -> ReptorGreen
                    focused -> ReptorGreen.copy(alpha = 0.20f)
                    else -> ReptorSurfaceHigh
                }
            )
            .border(
                width = if (focused) 1.5.dp else 0.dp,
                color = if (focused) ReptorGreen else Color.Transparent,
                shape = RoundedCornerShape(8.dp)
            )
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) {
        Text(
            text = label,
            color = if (primary) Color(0xFF00210F) else if (focused) ReptorGreen else ReptorText,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

/** Prévia ao vivo (muda de canal sem sair da tela). */
@Composable
private fun LivePreview(
    url: String?,
    muted: Boolean,
    enabled: Boolean,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    // Um único player para esta tela. Antes ele era liberado a cada troca de
    // canal e a prévia seguinte usava um player já destruído — era isso que
    // fechava o app ao navegar entre os canais.
    val player = remember {
        ExoPlayer.Builder(context).build().apply {
            volume = 0f
        }
    }

    DisposableEffect(Unit) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_STOP -> player.pause()
                Lifecycle.Event.ON_START -> if (url != null && enabled) player.play()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            player.release()
        }
    }

    LaunchedEffect(url, enabled) {
        // Com o player em tela cheia aberto a prévia é descartada para não
        // ocupar uma conexão do servidor (limite de conexões da conta).
        if (url.isNullOrBlank() || !enabled) {
            player.stop()
            player.clearMediaItems()
        } else {
            player.setMediaItem(ExoMediaItem.fromUri(url))
            player.prepare()
            player.play()
        }
    }

    LaunchedEffect(muted) {
        player.volume = if (muted) 0f else 1f
    }

    AndroidView(
        factory = { ctx ->
            PlayerView(ctx).apply {
                useController = false
                resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                this.player = player
            }
        },
        modifier = modifier
    )
}

private fun nowInMinutes(): Int {
    // O meuguia.tv publica os horários no fuso de Brasília.
    val calendar = Calendar.getInstance(java.util.TimeZone.getTimeZone("America/Sao_Paulo"))
    return calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)
}
