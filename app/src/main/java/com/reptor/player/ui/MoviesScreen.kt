package com.reptor.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.reptor.player.data.Category
import com.reptor.player.data.ContentCache
import com.reptor.player.data.MediaEntry
import com.reptor.player.data.MediaKind
import com.reptor.player.data.PlaylistSource
import com.reptor.player.ui.theme.ReptorGreen
import com.reptor.player.ui.theme.ReptorOutline
import com.reptor.player.ui.theme.ReptorSurfaceHigh
import com.reptor.player.ui.theme.ReptorTextDim

enum class SortMode(val label: String) {
    DEFAULT("Padrão"),
    NAME_ASC("Nome A-Z"),
    NAME_DESC("Nome Z-A"),
    RATING("Melhor nota")
}

@Composable
fun MoviesScreen(
    source: PlaylistSource,
    favorites: List<MediaEntry>,
    recents: List<MediaEntry>,
    cacheKey: String = "",
    refreshKey: Int = 0,
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
    var sort by remember { mutableStateOf(SortMode.DEFAULT) }

    val cacheId = "$cacheKey|VOD"
    val mountRefreshKey = remember { refreshKey }

    LaunchedEffect(retry, refreshKey) {
        // Conteúdo já carregado volta na hora ao reabrir a aba.
        val isRefresh = refreshKey != mountRefreshKey
        if (retry == 0 && !isRefresh) {
            val cachedCategories = ContentCache.categories(cacheId)
            val cachedItems = ContentCache.items(cacheId)
            if (cachedCategories != null && cachedItems != null) {
                categories = cachedCategories
                allItems = cachedItems
                loading = false
                return@LaunchedEffect
            }
        }

        if (isRefresh) ContentCache.clear(cacheId)

        loading = true
        error = null
        try {
            categories = source.categories(MediaKind.VOD)
            allItems = source.items(MediaKind.VOD, null)
            ContentCache.putCategories(cacheId, categories)
            ContentCache.putItems(cacheId, allItems)
        } catch (e: Exception) {
            error = e.message ?: "Falha ao carregar os filmes"
        } finally {
            loading = false
        }
    }

    val favoritesVod = remember(favorites) { favorites.filter { it.kind == MediaKind.VOD } }
    val recentsVod = remember(recents) { recents.filter { it.kind == MediaKind.VOD } }
    val favoriteIds = remember(favoritesVod) { favoritesVod.mapTo(HashSet()) { it.id } }

    if (loading) {
        LoadingBox("Carregando filmes…")
        return
    }
    if (error != null) {
        ErrorBox(error ?: "", onRetry = { retry++ })
        return
    }

    val counts = remember(allItems) { allItems.groupingBy { it.categoryId.orEmpty() }.eachCount() }

    val visible = remember(filter, selectedCategory, query, sort, allItems, favoritesVod, recentsVod) {
        val base = when (filter) {
            Filter.FAVORITES -> favoritesVod
            Filter.RECENTS -> recentsVod
            Filter.ALL -> allItems.filter {
                selectedCategory == null || it.categoryId == selectedCategory
            }
        }
        val filtered = if (query.isBlank()) base
        else base.filter { it.name.contains(query.trim(), ignoreCase = true) }

        when (sort) {
            SortMode.DEFAULT -> filtered
            SortMode.NAME_ASC -> filtered.sortedBy { it.name.lowercase() }
            SortMode.NAME_DESC -> filtered.sortedByDescending { it.name.lowercase() }
            SortMode.RATING -> filtered.sortedByDescending { it.rating ?: 0.0 }
        }
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
            favoritesCount = favoritesVod.size,
            recentsCount = recentsVod.size,
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
                    placeholder = "Busca filmes",
                    modifier = Modifier.weight(1f)
                )
                Spacer(Modifier.width(10.dp))
                SortButton(sort) { sort = it }
                Spacer(Modifier.width(10.dp))
                Text(
                    text = "${visible.size} títulos",
                    color = ReptorTextDim,
                    fontSize = 11.sp
                )
            }

            when {
                visible.isEmpty() -> EmptyBox(
                    when (filter) {
                        Filter.FAVORITES -> "Nenhum filme favorito."
                        Filter.RECENTS -> "Nenhum filme visto ainda."
                        Filter.ALL -> "Nenhum filme nesta categoria."
                    }
                )

                else -> BoxWithConstraints(Modifier.fillMaxSize()) {
                    val columns = (maxWidth.value / 128f).toInt().coerceIn(2, 10)
                    PosterGrid(
                        items = visible,
                        favoriteIds = favoriteIds,
                        onClick = onPlay,
                        onStar = onToggleFavorite,
                        columns = columns
                    )
                }
            }
        }
    }
}

@Composable
fun SortButton(current: SortMode, onSelect: (SortMode) -> Unit) {
    var open by remember { mutableStateOf(false) }
    var focused by remember { mutableStateOf(false) }
    Box {
        Box(
            Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(if (focused) ReptorGreen.copy(alpha = 0.18f) else ReptorSurfaceHigh)
                .border(
                    width = if (focused) 1.5.dp else 0.dp,
                    color = if (focused) ReptorGreen else Color.Transparent,
                    shape = RoundedCornerShape(8.dp)
                )
                .onFocusChanged { focused = it.isFocused }
                .clickable { open = true }
                .padding(horizontal = 12.dp, vertical = 9.dp)
        ) {
            Text(
                text = "Ordenar: ${current.label}",
                color = ReptorGreen,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            SortMode.entries.forEach { mode ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = mode.label,
                            fontSize = 12.sp,
                            color = if (mode == current) ReptorGreen else ReptorTextDim
                        )
                    },
                    onClick = {
                        onSelect(mode)
                        open = false
                    }
                )
            }
        }
    }
}
