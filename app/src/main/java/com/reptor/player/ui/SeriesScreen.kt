package com.reptor.player.ui

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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.reptor.player.data.Category
import com.reptor.player.data.Episode
import com.reptor.player.data.MediaEntry
import com.reptor.player.data.MediaKind
import com.reptor.player.data.PlaylistSource
import com.reptor.player.data.Season
import com.reptor.player.data.SeriesDetail
import com.reptor.player.ui.theme.ReptorGreen
import com.reptor.player.ui.theme.ReptorOutline
import com.reptor.player.ui.theme.ReptorSurfaceHigh
import com.reptor.player.ui.theme.ReptorText
import com.reptor.player.ui.theme.ReptorTextDim

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
    refreshKey: Int = 0,
    onPlayEpisode: (url: String, title: String) -> Unit,
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

    // Série aberta (null = grade de séries).
    var opened by remember { mutableStateOf<MediaEntry?>(null) }
    var detail by remember { mutableStateOf<SeriesDetail?>(null) }
    var detailLoading by remember { mutableStateOf(false) }
    var detailError by remember { mutableStateOf<String?>(null) }
    var detailTick by remember { mutableIntStateOf(0) }

    LaunchedEffect(retry, refreshKey) {
        loading = true
        error = null
        try {
            categories = source.categories(MediaKind.SERIES)
            allItems = source.items(MediaKind.SERIES, null)
        } catch (e: Exception) {
            error = e.message ?: "Falha ao carregar as séries"
        } finally {
            loading = false
        }
    }

    val favoritesSeries = favorites.filter { it.kind == MediaKind.SERIES }
    val recentsSeries = recents.filter { it.kind == MediaKind.SERIES }

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
            isFavorite = favoritesSeries.any { it.id == current.id },
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

    val counts = remember(allItems) {
        val map = HashMap<String, Int>()
        allItems.forEach { entry ->
            entry.allCategoryIds().forEach { id ->
                map[id] = (map[id] ?: 0) + 1
            }
        }
        map
    }

    val visible = remember(filter, selectedCategory, query, allItems, favoritesSeries, recentsSeries) {
        val trimmed = query.trim()
        val searching = trimmed.isNotBlank()
        val base = when (filter) {
            Filter.FAVORITES -> favoritesSeries
            Filter.RECENTS -> recentsSeries
            // Enquanto digita, a busca varre todas as séries (como na
            // referência); a pasta escolhida só filtra quando não há busca.
            Filter.ALL -> if (searching) allItems
            else allItems.filter {
                selectedCategory == null || selectedCategory in it.allCategoryIds()
            }
        }
        if (!searching) base
        else base.filter { it.name.contains(trimmed, ignoreCase = true) }
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
            favoritesCount = favoritesSeries.size,
            recentsCount = recentsSeries.size,
            modifier = Modifier.width(196.dp)
        )

        Box(
            Modifier
                .width(1.dp)
                .fillMaxHeight()
                .background(ReptorOutline.copy(alpha = 0.45f))
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
                    text = "${visible.size} séries",
                    color = ReptorTextDim,
                    fontSize = 11.sp
                )
            }

            when {
                visible.isEmpty() -> EmptyBox(
                    when (filter) {
                        Filter.FAVORITES -> "Nenhuma série favorita."
                        Filter.RECENTS -> "Nenhuma série vista ainda."
                        Filter.ALL -> "Nenhuma série nesta categoria."
                    }
                )

                else -> BoxWithConstraints(Modifier.fillMaxSize()) {
                    val columns = (maxWidth.value / 128f).toInt().coerceIn(2, 10)
                    PosterGrid(
                        items = visible,
                        favorites = favoritesSeries,
                        onClick = { opened = it },
                        onStar = onToggleFavorite,
                        columns = columns
                    )
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
    onPlayEpisode: (String, String) -> Unit
) {
    var seasonIndex by remember(detail?.id) { mutableIntStateOf(0) }
    val seasons: List<Season> = detail?.seasons.orEmpty()
    val safeIndex = seasonIndex.coerceIn(0, (seasons.size - 1).coerceAtLeast(0))
    val season = seasons.getOrNull(safeIndex)

    Column(Modifier.fillMaxSize()) {

        // ------------------------------------------------------- barra voltar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(ReptorSurfaceHigh.copy(alpha = 0.55f))
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(ReptorSurfaceHigh)
                    .clickable(onClick = onBack)
                    .padding(horizontal = 12.dp, vertical = 7.dp)
            ) {
                Text("← Séries", color = ReptorGreen, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.width(12.dp))
            Text(
                text = detail?.name ?: entry.name,
                color = ReptorText,
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
                    color = ReptorTextDim,
                    fontSize = 11.sp
                )
                Spacer(Modifier.width(12.dp))
            }
            Box(
                Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(ReptorSurfaceHigh)
                    .clickable(onClick = onStar)
                    .padding(horizontal = 12.dp, vertical = 7.dp)
            ) {
                Text(
                    text = if (isFavorite) "★ Favorito" else "☆ Favoritar",
                    color = if (isFavorite) Color(0xFFFFC107) else ReptorTextDim,
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
                        .background(ReptorSurfaceHigh.copy(alpha = 0.3f))
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
                                    .background(ReptorSurfaceHigh)
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
                                        color = ReptorTextDim,
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
                                        color = ReptorGreen,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        genreText,
                                        color = ReptorText,
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
                                        color = ReptorGreen,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(year, color = ReptorText, fontSize = 10.sp)
                                    Spacer(Modifier.height(6.dp))
                                }

                                if (detail.rating != null && detail.rating > 0) {
                                    Text(
                                        "NOTA",
                                        color = ReptorGreen,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        String.format("%.1f", detail.rating),
                                        color = ReptorText,
                                        fontSize = 10.sp
                                    )
                                }
                            }
                        }

                        if (!detail.plot.isNullOrBlank()) {
                            Spacer(Modifier.height(8.dp))
                            Text(
                                text = detail.plot,
                                color = ReptorTextDim,
                                fontSize = 10.sp,
                                maxLines = 4,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        if (!detail.cast.isNullOrBlank()) {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = "Elenco: ${detail.cast}",
                                color = ReptorTextDim.copy(alpha = 0.85f),
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
                        .background(ReptorOutline.copy(alpha = 0.45f))
                )

                // -------------------------------------- temporadas + episódios
                Column(Modifier.weight(1f).fillMaxHeight().padding(12.dp)) {

                    Text(
                        "TEMPORADAS",
                        color = ReptorGreen,
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
                            Box(
                                Modifier
                                    .clip(RoundedCornerShape(9.dp))
                                    .background(if (selected) ReptorGreen.copy(alpha = 0.2f) else ReptorSurfaceHigh)
                                    .border(
                                        width = if (selected) 1.dp else 0.dp,
                                        color = if (selected) ReptorGreen else Color.Transparent,
                                        shape = RoundedCornerShape(9.dp)
                                    )
                                    .clickable { seasonIndex = index }
                                    .padding(horizontal = 14.dp, vertical = 8.dp)
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        text = "T${item.number}",
                                        color = if (selected) ReptorGreen else ReptorText,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = "${item.episodes.size} ep.",
                                        color = ReptorTextDim,
                                        fontSize = 9.sp
                                    )
                                }
                            }
                        }
                    }

                    Spacer(Modifier.height(10.dp))
                    HorizontalDivider(color = ReptorOutline.copy(alpha = 0.4f))
                    Spacer(Modifier.height(8.dp))

                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "EPISÓDIOS · TEMPORADA ${season?.number ?: 1}",
                            color = ReptorGreen,
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = "${season?.episodes?.size ?: 0} episódios",
                            color = ReptorTextDim,
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
                                    onPlayEpisode(
                                        ep.url,
                                        "${detail.name} · T${ep.season}E${ep.number} · ${ep.title}"
                                    )
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
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(ReptorSurfaceHigh.copy(alpha = 0.4f))
            .clickable(onClick = onPlay)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier
                .width(40.dp)
                .height(28.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(ReptorGreen.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = if (episode.number > 0) episode.number.toString() else "•",
                color = ReptorGreen,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold
            )
        }

        Spacer(Modifier.width(10.dp))

        Column(Modifier.weight(1f)) {
            Text(
                text = episode.title,
                color = ReptorText,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            val extra = listOfNotNull(
                if (episode.number > 0) "T${episode.season} E${episode.number}" else null,
                episode.duration
            ).joinToString(" · ")
            if (extra.isNotBlank()) {
                Text(extra, color = ReptorTextDim, fontSize = 9.sp)
            }
        }

        Box(
            Modifier
                .clip(RoundedCornerShape(7.dp))
                .background(ReptorGreen)
                .clickable(onClick = onPlay)
                .padding(horizontal = 12.dp, vertical = 5.dp)
        ) {
            Text("▶", color = Color(0xFF00210F), fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}
