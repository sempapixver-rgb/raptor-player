package com.raptor.player.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.raptor.player.data.Category
import com.raptor.player.data.ContentStore
import com.raptor.player.data.Episode
import com.raptor.player.data.MediaEntry
import com.raptor.player.data.MediaKind
import com.raptor.player.data.PlaylistSource
import com.raptor.player.data.Season
import com.raptor.player.data.SeriesDetail
import com.raptor.player.ui.theme.RaptorGreen
import com.raptor.player.ui.theme.RaptorOutline
import com.raptor.player.ui.theme.RaptorSurfaceHigh
import com.raptor.player.ui.theme.RaptorText
import com.raptor.player.ui.theme.RaptorTextDim

/**
 * Séries em três níveis, como o usuário pediu:
 *   categoria (ex.: "Series | Netflix") -> série -> temporada -> episódio
 *
 * Nada de episódio solto na grade: a grade mostra apenas séries. Os episódios
 * só aparecem depois de abrir a série e escolher a temporada.
 */
@Composable
fun SeriesScreen(
    source: PlaylistSource,
    favorites: List<MediaEntry>,
    recents: List<MediaEntry>,
    cacheKey: String = "",
    refreshKey: Int = 0,
    onPlayEpisode: (queue: List<PlayItem>, index: Int) -> Unit,
    onToggleFavorite: (MediaEntry) -> Unit
) {
    var categories by remember { mutableStateOf<List<Category>>(emptyList()) }
    var allItems by remember { mutableStateOf<List<MediaEntry>>(emptyList()) }
    var categoriesReady by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var itemsLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var retry by remember { mutableIntStateOf(0) }

    var filter by remember { mutableStateOf(Filter.ALL) }
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var query by remember { mutableStateOf("") }

    // Busca em todas as pastas (igual à LG): o índice só é baixado quando o
    // usuário digita 2+ letras, nunca ao entrar na aba.
    var searchIndex by remember { mutableStateOf<List<MediaEntry>?>(null) }
    var searchLoading by remember { mutableStateOf(false) }

    // Série aberta (null = grade de séries).
    var opened by remember { mutableStateOf<MediaEntry?>(null) }
    var detail by remember { mutableStateOf<SeriesDetail?>(null) }
    var detailLoading by remember { mutableStateOf(false) }
    var detailError by remember { mutableStateOf<String?>(null) }
    var detailTick by remember { mutableIntStateOf(0) }

    val base = cacheKey
    // Muda quando as pastas terminam de carregar. Os itens esperam por isso
    // para não baixar a pasta errada antes da hora.
    var catsVersion by remember { mutableIntStateOf(0) }

    // Pastas da aba (leves). Ao entrar, o app já as baixou — aqui só reaproveita.
    LaunchedEffect(retry, refreshKey) {
        error = null

        val cached = ContentStore.cachedCategories(base, MediaKind.SERIES)
        if (cached != null) {
            categories = cached
            categoriesReady = true
            loading = false
        } else {
            loading = categories.isEmpty()
            try {
                categories = kotlinx.coroutines.withTimeout(LOAD_TIMEOUT_MS) {
                    ContentStore.categories(source, base, MediaKind.SERIES)
                }
                categoriesReady = true
            } catch (e: Throwable) {
                error = loadErrorMessage(e, "as séries")
            } finally {
                loading = false
            }
        }

        if (categoriesReady) {
            // Filmes/Séries nunca abrem em "Tudo": volta na última pasta usada
            // ou entra na primeira. A lista completa passa de 8 MB.
            val saved = ContentStore.lastFolder(base, MediaKind.SERIES)
            selectedCategory = when {
                saved != null && categories.any { it.id == saved } -> saved
                categories.isNotEmpty() -> categories.first().id
                else -> null
            }
            catsVersion++
        }
    }

    // Itens SÓ da pasta escolhida.
    LaunchedEffect(selectedCategory, catsVersion) {
        if (!categoriesReady) return@LaunchedEffect
        val folder = selectedCategory
        if (folder == null) {
            allItems = emptyList()
            itemsLoading = false
            return@LaunchedEffect
        }

        ContentStore.cachedItems(base, MediaKind.SERIES, folder)?.let { list ->
            allItems = list
            itemsLoading = false
            return@LaunchedEffect
        }

        itemsLoading = true
        allItems = emptyList()
        error = null
        try {
            allItems = kotlinx.coroutines.withTimeout(LOAD_TIMEOUT_MS) {
                ContentStore.items(source, base, MediaKind.SERIES, folder)
            }
        } catch (e: Throwable) {
            error = loadErrorMessage(e, "as séries")
        } finally {
            itemsLoading = false
        }
    }

    // Busca global da aba: baixa o índice uma vez, só depois de digitar.
    LaunchedEffect(query) {
        val q = query.trim()
        if (q.length < 2 || searchIndex != null || searchLoading) return@LaunchedEffect
        // Aba já pesquisada antes: reaproveita o índice sem tocar na rede.
        ContentStore.cachedSearch(base, MediaKind.SERIES)?.let {
            searchIndex = it
            return@LaunchedEffect
        }
        searchLoading = true
        try {
            searchIndex = kotlinx.coroutines.withTimeout(LOAD_TIMEOUT_MS) {
                ContentStore.searchIndex(source, base, MediaKind.SERIES)
            }
        } catch (_: Throwable) {
            // Sem o índice a busca continua na pasta aberta.
        } finally {
            searchLoading = false
        }
    }

    val favoritesSeries = remember(favorites) { favorites.filter { it.kind == MediaKind.SERIES } }
    val recentsSeries = remember(recents) { recents.filter { it.kind == MediaKind.SERIES } }
    val favoriteIds = remember(favoritesSeries) { favoritesSeries.mapTo(HashSet()) { it.id } }

    // Abre a série e monta temporadas/episódios.
    LaunchedEffect(opened?.id, detailTick) {
        val entry = opened ?: run {
            detail = null
            detailError = null
            return@LaunchedEffect
        }
        detailLoading = true
        detailError = null
        detail = null
        try {
            val info = source.seriesDetail(entry.id)
            if (info == null) {
                detailError = "Não foi possível abrir esta série."
            } else {
                detail = if (info.name.isBlank()) info.copy(name = entry.name) else info
            }
        } catch (e: Exception) {
            detailError = e.message ?: "Não foi possível abrir esta série."
        } finally {
            detailLoading = false
        }
    }

    val current = opened
    if (current != null) {
        BackHandler { opened = null }
        SeriesDetailView(
            entry = current,
            detail = detail,
            loading = detailLoading,
            error = detailError,
            isFavorite = current.id in favoriteIds,
            onBack = { opened = null },
            onRetry = { detailTick++ },
            onStar = { onToggleFavorite(current) },
            onPlayEpisode = onPlayEpisode
        )
        return
    }

    if (loading) {
        LoadingBox("Carregando séries…")
        return
    }
    if (error != null) {
        ErrorBox(error ?: "", onRetry = { retry++ })
        return
    }

    // Só a pasta atual está em memória; a contagem das outras não é conhecida.
    val counts = remember(allItems, selectedCategory) {
        val folder = selectedCategory
        if (folder == null) emptyMap() else mapOf(folder to allItems.size)
    }

    val trimmedQuery = query.trim()
    val searching = trimmedQuery.isNotBlank()

    val visible = remember(filter, selectedCategory, trimmedQuery, allItems, favoritesSeries, recentsSeries, searchIndex) {
        val base = when {
            // Busca em todas as pastas da aba (igual à LG). Enquanto o índice
            // não chega, procura só na pasta aberta.
            searching -> searchIndex ?: allItems
            filter == Filter.FAVORITES -> favoritesSeries
            filter == Filter.RECENTS -> recentsSeries
            else -> allItems.filter {
                selectedCategory == null || selectedCategory in it.allCategoryIds()
            }
        }
        if (!searching) base
        else base.filter { it.name.contains(trimmedQuery, ignoreCase = true) }
    }

    Row(Modifier.fillMaxSize()) {
        CategoryPanel(
            categories = categories,
            filter = filter,
            onFilter = { filter = it },
            selectedCategory = selectedCategory,
            onCategory = {
                selectedCategory = it
                ContentStore.rememberFolder(base, MediaKind.SERIES, it)
            },
            counts = counts,
            totalCount = allItems.size,
            favoritesCount = favoritesSeries.size,
            recentsCount = recentsSeries.size,
            modifier = Modifier.width(196.dp),
            showAll = false
        )

        Box(
            Modifier
                .width(1.dp)
                .fillMaxHeight()
                .background(RaptorOutline.copy(alpha = 0.45f))
        )

        Column(Modifier.weight(1f).fillMaxHeight()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                SearchField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = "Busca séries",
                    modifier = Modifier.weight(1f)
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    text = if (searching) {
                        "${visible.size} resultados" + when {
                            searchLoading -> " · buscando em todas as pastas…"
                            searchIndex != null -> " · todas as pastas"
                            else -> " · nesta pasta"
                        }
                    } else {
                        "${visible.size} séries"
                    },
                    color = RaptorTextDim,
                    fontSize = 11.sp
                )
            }

            when {
                itemsLoading && allItems.isEmpty() -> LoadingBox("Carregando séries…")

                visible.isEmpty() -> EmptyBox(
                    if (searching) "Nenhum resultado para \"$trimmedQuery\"."
                    else when (filter) {
                        Filter.FAVORITES -> "Nenhuma série favorita."
                        Filter.RECENTS -> "Nenhuma série vista ainda."
                        Filter.ALL -> "Nenhuma série nesta categoria."
                    }
                )

                else -> {
                    // Paginação igual à LG: 60 séries por página.
                    var page by remember(visible) { mutableIntStateOf(0) }
                    val pageCount = ((visible.size + PAGE_SIZE - 1) / PAGE_SIZE).coerceAtLeast(1)
                    val safePage = page.coerceIn(0, pageCount - 1)
                    val pageItems = remember(visible, safePage) {
                        val from = safePage * PAGE_SIZE
                        val to = (from + PAGE_SIZE).coerceAtMost(visible.size)
                        if (from >= to) emptyList() else visible.subList(from, to)
                    }

                    Column(Modifier.fillMaxSize()) {
                        BoxWithConstraints(Modifier.weight(1f)) {
                            val columns = (maxWidth.value / 128f).toInt().coerceIn(2, 10)
                            PosterGrid(
                                items = pageItems,
                                favoriteIds = favoriteIds,
                                onClick = { opened = it },
                                onStar = onToggleFavorite,
                                columns = columns
                            )
                        }
                        PagerBar(
                            page = safePage,
                            pageCount = pageCount,
                            onPrev = { page = safePage - 1 },
                            onNext = { page = safePage + 1 }
                        )
                    }
                }
            }
        }
    }
}

// --------------------------------------------------------------- detalhe

/** "Series | Netflix" e "Filmes | ..." são pastas da lista, não gêneros. */
private fun isFolderGenre(value: String): Boolean {
    val lower = value.lowercase()
    return lower.startsWith("series |") || lower.startsWith("series|") ||
        lower.startsWith("filmes |") || lower.startsWith("filmes|")
}

@Composable
private fun SeriesDetailView(
    entry: MediaEntry,
    detail: SeriesDetail?,
    loading: Boolean,
    error: String?,
    isFavorite: Boolean,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onStar: () -> Unit,
    onPlayEpisode: (List<PlayItem>, Int) -> Unit
) {
    var seasonIndex by remember(detail?.id) { mutableIntStateOf(0) }
    var backFocused by remember { mutableStateOf(false) }
    var starFocused by remember { mutableStateOf(false) }
    val seasons: List<Season> = detail?.seasons.orEmpty()
    val safeIndex = seasonIndex.coerceIn(0, (seasons.size - 1).coerceAtLeast(0))
    val season = seasons.getOrNull(safeIndex)

    // Fila da série inteira: "Próximo" segue para o episódio seguinte,
    // inclusive na virada de temporada.
    val flatEpisodes = remember(seasons) { seasons.flatMap { it.episodes } }
    val playQueue = remember(flatEpisodes, detail?.name) {
        val seriesName = detail?.name.orEmpty()
        flatEpisodes.map { ep ->
            PlayItem(ep.url, "$seriesName · T${ep.season}E${ep.number} · ${ep.title}")
        }
    }
    val indexById = remember(flatEpisodes) {
        flatEpisodes.withIndex().associate { it.value.id to it.index }
    }

    // Ao abrir a série, o primeiro episódio já começa a tocar. Quando o player
    // fecha, esta lista (temporadas/episódios) continua exatamente aqui.
    var autoStarted by remember(detail?.id) { mutableStateOf(false) }
    LaunchedEffect(detail?.id, playQueue.size) {
        if (!autoStarted && playQueue.isNotEmpty()) {
            autoStarted = true
            onPlayEpisode(playQueue, 0)
        }
    }

    Column(Modifier.fillMaxSize()) {

        // ------------------------------------------------------- barra voltar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(RaptorSurfaceHigh.copy(alpha = 0.55f))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (backFocused) RaptorGreen.copy(alpha = 0.16f) else RaptorSurfaceHigh)
                    .border(
                        width = if (backFocused) 1.5.dp else 0.dp,
                        color = if (backFocused) RaptorGreen else Color.Transparent,
                        shape = RoundedCornerShape(8.dp)
                    )
                    .onFocusChanged { backFocused = it.isFocused }
                    .clickable(onClick = onBack)
                    .padding(horizontal = 12.dp, vertical = 7.dp)
            ) {
                Text(
                    text = "← Séries",
                    color = if (backFocused) RaptorGreen else RaptorGreen,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
            Spacer(Modifier.width(12.dp))
            Text(
                text = detail?.name ?: entry.name,
                color = RaptorText,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            if (seasons.isNotEmpty()) {
                Text(
                    text = "${seasons.size} temporada${if (seasons.size > 1) "s" else ""} · " +
                        "${seasons.sumOf { it.episodes.size }} episódios",
                    color = RaptorTextDim,
                    fontSize = 11.sp
                )
                Spacer(Modifier.width(12.dp))
            }
            Box(
                Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (starFocused) RaptorGreen.copy(alpha = 0.16f) else RaptorSurfaceHigh)
                    .border(
                        width = if (starFocused) 1.5.dp else 0.dp,
                        color = if (starFocused) RaptorGreen else Color.Transparent,
                        shape = RoundedCornerShape(8.dp)
                    )
                    .onFocusChanged { starFocused = it.isFocused }
                    .clickable(onClick = onStar)
                    .padding(horizontal = 12.dp, vertical = 7.dp)
            ) {
                Text(
                    text = if (isFavorite) "★ Favorito" else "☆ Favoritar",
                    color = if (isFavorite) Color(0xFFFFC107) else RaptorTextDim,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        when {
            loading -> LoadingBox("Carregando temporadas e episódios…")

            error != null -> ErrorBox(error, onRetry = onRetry)

            detail == null || seasons.isEmpty() -> EmptyBox(
                "Esta série não tem episódios disponíveis na lista."
            )

            else -> Row(Modifier.fillMaxSize()) {

                // -------------------------------------------- capa + sinopse
                BoxWithConstraints(
                    Modifier
                        .width(250.dp)
                        .fillMaxHeight()
                        .background(RaptorSurfaceHigh.copy(alpha = 0.3f))
                        .padding(12.dp)
                ) {
                    // Em paisagem sobra pouca altura: a capa ocupa o que resta
                    // depois de reservar espaço para sinopse e elenco.
                    val textReserve = 92.dp
                    val posterHeight = (maxHeight - textReserve)
                        .coerceIn(96.dp, 168.dp)
                    val posterWidth = posterHeight / 1.5f

                    Column(Modifier.fillMaxSize()) {
                        Row(Modifier.fillMaxWidth()) {
                            Box(
                                Modifier
                                    .width(posterWidth)
                                    .height(posterHeight)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(RaptorSurfaceHigh)
                            ) {
                                val art = detail.cover ?: entry.logo
                                if (!art.isNullOrBlank()) {
                                    AsyncImage(
                                        model = art,
                                        contentDescription = detail.name,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                } else {
                                    Text(
                                        text = detail.name,
                                        color = RaptorTextDim,
                                        fontSize = 11.sp,
                                        modifier = Modifier.align(Alignment.Center).padding(8.dp)
                                    )
                                }

                                if (detail.rating != null && detail.rating > 0) {
                                    Box(
                                        Modifier
                                            .align(Alignment.TopEnd)
                                            .padding(5.dp)
                                            .clip(RoundedCornerShape(5.dp))
                                            .background(Color(0xFF1E88E5))
                                            .padding(horizontal = 5.dp, vertical = 1.dp)
                                    ) {
                                        Text(
                                            text = String.format("%.1f", detail.rating),
                                            color = Color.White,
                                            fontSize = 9.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }

                            Spacer(Modifier.width(10.dp))

                            Column(Modifier.weight(1f)) {
                                val genreText = detail.displayGenre
                                    ?.takeIf { it.isNotBlank() }
                                    ?: detail.genre?.takeIf {
                                        it.isNotBlank() && !isFolderGenre(it)
                                    }
                                if (genreText != null) {
                                    Text(
                                        "GÊNERO",
                                        color = RaptorGreen,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        genreText,
                                        color = RaptorText,
                                        fontSize = 10.sp,
                                        maxLines = 3,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Spacer(Modifier.height(6.dp))
                                }

                                val year = detail.releaseDate?.take(4)?.takeIf { it.isNotBlank() }
                                if (year != null) {
                                    Text(
                                        "ANO",
                                        color = RaptorGreen,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(year, color = RaptorText, fontSize = 10.sp)
                                    Spacer(Modifier.height(6.dp))
                                }

                                if (detail.rating != null && detail.rating > 0) {
                                    Text(
                                        "NOTA",
                                        color = RaptorGreen,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        String.format("%.1f", detail.rating),
                                        color = RaptorText,
                                        fontSize = 10.sp
                                    )
                                }
                            }
                        }

                        if (!detail.plot.isNullOrBlank()) {
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = detail.plot,
                                color = RaptorTextDim,
                                fontSize = 10.sp,
                                maxLines = 4,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        if (!detail.cast.isNullOrBlank()) {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = "Elenco: ${detail.cast}",
                                color = RaptorTextDim.copy(alpha = 0.85f),
                                fontSize = 9.sp,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }

                Box(
                    Modifier
                        .width(1.dp)
                        .fillMaxHeight()
                        .background(RaptorOutline.copy(alpha = 0.45f))
                )

                // -------------------------------------- temporadas + episódios
                Column(Modifier.weight(1f).fillMaxHeight().padding(12.dp)) {

                    Text(
                        "TEMPORADAS",
                        color = RaptorGreen,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(6.dp))

                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(end = 8.dp)
                    ) {
                        items(count = seasons.size, key = { seasons[it].number }) { index ->
                            val item = seasons[index]
                            val selected = index == safeIndex
                            var chipFocused by remember { mutableStateOf(false) }
                            Box(
                                Modifier
                                    .clip(RoundedCornerShape(9.dp))
                                    .background(
                                        when {
                                            selected -> RaptorGreen.copy(alpha = 0.2f)
                                            chipFocused -> RaptorGreen.copy(alpha = 0.12f)
                                            else -> RaptorSurfaceHigh
                                        }
                                    )
                                    .border(
                                        width = if (selected || chipFocused) 1.dp else 0.dp,
                                        color = if (selected || chipFocused) RaptorGreen else Color.Transparent,
                                        shape = RoundedCornerShape(9.dp)
                                    )
                                    .onFocusChanged { chipFocused = it.isFocused }
                                    .clickable { seasonIndex = index }
                                    .padding(horizontal = 14.dp, vertical = 8.dp)
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        text = "T${item.number}",
                                        color = if (selected) RaptorGreen else RaptorText,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${item.episodes.size} ep.",
                                        color = RaptorTextDim,
                                        fontSize = 9.sp
                                    )
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(10.dp))
                    HorizontalDivider(color = RaptorOutline.copy(alpha = 0.4f))
                    Spacer(Modifier.height(8.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "EPISÓDIOS · TEMPORADA ${season?.number ?: 1}",
                            color = RaptorGreen,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = "${season?.episodes?.size ?: 0} episódios",
                            color = RaptorTextDim,
                            fontSize = 10.sp
                        )
                    }

                    Spacer(Modifier.height(6.dp))

                    val episodes = season?.episodes.orEmpty()
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                        contentPadding = PaddingValues(bottom = 10.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(count = episodes.size, key = { episodes[it].id }) { index ->
                            EpisodeRow(
                                episode = episodes[index],
                                onPlay = {
                                    val ep = episodes[index]
                                    onPlayEpisode(playQueue, indexById[ep.id] ?: 0)
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EpisodeRow(episode: Episode, onPlay: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(
                if (focused) RaptorGreen.copy(alpha = 0.12f) else RaptorSurfaceHigh.copy(alpha = 0.4f)
            )
            .border(
                width = if (focused) 1.dp else 0.dp,
                color = if (focused) RaptorGreen else Color.Transparent,
                shape = RoundedCornerShape(8.dp)
            )
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onPlay)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier
                .width(40.dp)
                .height(28.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(RaptorGreen.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = if (episode.number > 0) episode.number.toString() else "•",
                color = RaptorGreen,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(Modifier.width(10.dp))

        Column(Modifier.weight(1f)) {
            Text(
                text = episode.title,
                color = RaptorText,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            val extra = listOfNotNull(
                if (episode.number > 0) "T${episode.season} E${episode.number}" else null,
                episode.duration
            ).joinToString(" · ")
            if (extra.isNotBlank()) {
                Text(extra, color = RaptorTextDim, fontSize = 9.sp)
            }
        }

        Box(
            Modifier
                .clip(RoundedCornerShape(7.dp))
                .background(RaptorGreen)
                .padding(horizontal = 12.dp, vertical = 5.dp)
        ) {
            Text("▶", color = Color(0xFF00210F), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}
