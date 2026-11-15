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
import com.reptor.player.data.ContentStore
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
    var categoriesReady by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var itemsLoading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var retry by remember { mutableIntStateOf(0) }

    var filter by remember { mutableStateOf(Filter.ALL) }
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var query by remember { mutableStateOf("") }
    var sort by remember { mutableStateOf(SortMode.DEFAULT) }

    // Busca em todas as pastas (igual à LG): o índice só é baixado quando o
    // usuário digita 2+ letras, nunca ao entrar na aba.
    var searchIndex by remember { mutableStateOf<List<MediaEntry>?>(null) }
    var searchLoading by remember { mutableStateOf(false) }

    val base = cacheKey
    // Muda quando as pastas terminam de carregar. Os itens esperam por isso
    // para não baixar a pasta errada antes da hora.
    var catsVersion by remember { mutableIntStateOf(0) }

    // Pastas da aba (leves). Ao entrar, o app já as baixou — aqui só reaproveita.
    LaunchedEffect(retry, refreshKey) {
        error = null

        val cached = ContentStore.cachedCategories(base, MediaKind.VOD)
        if (cached != null) {
            categories = cached
            categoriesReady = true
            loading = false
        } else {
            loading = categories.isEmpty()
            try {
                categories = kotlinx.coroutines.withTimeout(LOAD_TIMEOUT_MS) {
                    ContentStore.categories(source, base, MediaKind.VOD)
                }
                categoriesReady = true
            } catch (e: Throwable) {
                error = loadErrorMessage(e, "os filmes")
            } finally {
                loading = false
            }
        }

        if (categoriesReady) {
            // Filmes/Séries nunca abrem em "Tudo": volta na última pasta usada
            // ou entra na primeira. A lista completa passa de 8 MB.
            val saved = ContentStore.lastFolder(base, MediaKind.VOD)
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

        ContentStore.cachedItems(base, MediaKind.VOD, folder)?.let { list ->
            allItems = list
            itemsLoading = false
            return@LaunchedEffect
        }

        itemsLoading = true
        allItems = emptyList()
        error = null
        try {
            allItems = kotlinx.coroutines.withTimeout(LOAD_TIMEOUT_MS) {
                ContentStore.items(source, base, MediaKind.VOD, folder)
            }
        } catch (e: Throwable) {
            error = loadErrorMessage(e, "os filmes")
        } finally {
            itemsLoading = false
        }
    }

    // Busca global da aba: baixa o índice uma vez, só depois de digitar.
    LaunchedEffect(query) {
        val q = query.trim()
        if (q.length < 2 || searchIndex != null || searchLoading) return@LaunchedEffect
        // Aba já pesquisada antes: reaproveita o índice sem tocar na rede.
        ContentStore.cachedSearch(base, MediaKind.VOD)?.let {
            searchIndex = it
            return@LaunchedEffect
        }
        searchLoading = true
        try {
            searchIndex = kotlinx.coroutines.withTimeout(LOAD_TIMEOUT_MS) {
                ContentStore.searchIndex(source, base, MediaKind.VOD)
            }
        } catch (_: Throwable) {
            // Sem o índice a busca continua na pasta aberta.
        } finally {
            searchLoading = false
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

    // Só a pasta atual está em memória; a contagem das outras não é conhecida.
    val counts = remember(allItems, selectedCategory) {
        val folder = selectedCategory
        if (folder == null) emptyMap() else mapOf(folder to allItems.size)
    }

    val trimmedQuery = query.trim()
    val searching = trimmedQuery.isNotBlank()

    val visible = remember(filter, selectedCategory, trimmedQuery, sort, allItems, favoritesVod, recentsVod, searchIndex) {
        val base = when {
            // Busca em todas as pastas da aba (igual à LG). Enquanto o índice
            // não chega, procura só na pasta aberta.
            searching -> searchIndex ?: allItems
            filter == Filter.FAVORITES -> favoritesVod
            filter == Filter.RECENTS -> recentsVod
            else -> allItems.filter {
                selectedCategory == null || it.categoryId == selectedCategory
            }
        }
        val filtered = if (!searching) base
        else base.filter { it.name.contains(trimmedQuery, ignoreCase = true) }

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
            onCategory = {
                selectedCategory = it
                ContentStore.rememberFolder(base, MediaKind.VOD, it)
            },
            counts = counts,
            totalCount = allItems.size,
            favoritesCount = favoritesVod.size,
            recentsCount = recentsVod.size,
            modifier = Modifier.width(196.dp),
            showAll = false
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
                    text = if (searching) {
                        "${visible.size} resultados" + when {
                            searchLoading -> " · buscando em todas as pastas…"
                            searchIndex != null -> " · todas as pastas"
                            else -> " · nesta pasta"
                        }
                    } else {
                        "${visible.size} títulos"
                    },
                    color = ReptorTextDim,
                    fontSize = 11.sp
                )
            }

            when {
                itemsLoading && allItems.isEmpty() -> LoadingBox("Carregando filmes…")

                visible.isEmpty() -> EmptyBox(
                    if (searching) "Nenhum resultado para \"$trimmedQuery\"."
                    else when (filter) {
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
