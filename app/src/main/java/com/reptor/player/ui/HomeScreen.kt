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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.reptor.player.data.Category
import com.reptor.player.data.LoginMode
import com.reptor.player.data.MediaEntry
import com.reptor.player.data.MediaKind
import com.reptor.player.data.Prefs
import com.reptor.player.data.Session
import com.reptor.player.data.createSource
import com.reptor.player.data.displayName
import com.reptor.player.ui.theme.ReptorGreen
import com.reptor.player.ui.theme.ReptorTextDim
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private enum class Tab(val label: String) {
    CHANNELS("Canais"),
    MOVIES("Filmes"),
    SERIES("Séries"),
    SEARCH("Procurar"),
    SETTINGS("Ajustes")
}

private enum class Filter { ALL, FAVORITES, RECENTS }

private fun kindOf(tab: Tab): MediaKind? = when (tab) {
    Tab.CHANNELS -> MediaKind.LIVE
    Tab.MOVIES -> MediaKind.VOD
    Tab.SERIES -> MediaKind.SERIES
    else -> null
}

@Composable
fun HomeScreen(session: Session, onSwitch: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember(context) { Prefs(context) }
    val scope = rememberCoroutineScope()
    val source = remember(session) { createSource(session) }

    var tab by remember { mutableStateOf(Tab.CHANNELS) }
    var filter by remember { mutableStateOf(Filter.ALL) }
    var selectedCategory by remember { mutableStateOf<String?>(null) }
    var categoryQuery by remember { mutableStateOf("") }

    var categories by remember { mutableStateOf<Map<MediaKind, List<Category>>>(emptyMap()) }
    var items by remember { mutableStateOf<List<MediaEntry>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var retryTick by remember { mutableIntStateOf(0) }

    var favorites by remember { mutableStateOf(prefs.favorites()) }
    var recents by remember { mutableStateOf(prefs.recents()) }

    var query by remember { mutableStateOf("") }
    var searchKind by remember { mutableStateOf(MediaKind.LIVE) }
    var searchResults by remember { mutableStateOf<List<MediaEntry>>(emptyList()) }
    var searchCache by remember { mutableStateOf<Map<MediaKind, List<MediaEntry>>>(emptyMap()) }
    var searching by remember { mutableStateOf(false) }

    var resolving by remember { mutableStateOf(false) }
    var playing by remember { mutableStateOf<Pair<String, String>?>(null) }

    var clock by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        val format = SimpleDateFormat("HH:mm", Locale.getDefault())
        while (true) {
            clock = format.format(Date())
            delay(1000)
        }
    }

    fun play(entry: MediaEntry) {
        if (resolving) return
        scope.launch {
            resolving = true
            error = null
            val url = try {
                source.playUrl(entry)
            } catch (e: Exception) {
                error = e.message ?: "Não foi possível abrir o item"
                null
            }
            resolving = false
            if (url != null) {
                prefs.addRecent(entry)
                recents = prefs.recents()
                playing = url to entry.name
            }
        }
    }

    fun toggleFav(entry: MediaEntry) {
        prefs.toggleFavorite(entry)
        favorites = prefs.favorites()
    }

    // Carrega categorias e a lista completa da seção atual.
    LaunchedEffect(tab, selectedCategory, retryTick) {
        val kind = kindOf(tab) ?: return@LaunchedEffect
        loading = true
        error = null
        try {
            if (categories[kind] == null) {
                categories = categories + (kind to source.categories(kind))
            }
            items = source.items(kind, selectedCategory)
        } catch (e: Exception) {
            error = e.message ?: "Falha ao carregar o conteúdo"
            items = emptyList()
        } finally {
            loading = false
        }
    }

    // Busca com atraso para não consultar a cada letra.
    LaunchedEffect(tab, searchKind, query) {
        if (tab != Tab.SEARCH) return@LaunchedEffect
        val text = query.trim()
        if (text.length < 2) {
            searchResults = emptyList()
            searching = false
            return@LaunchedEffect
        }
        searching = true
        delay(350)
        val all = searchCache[searchKind] ?: try {
            source.items(searchKind, null).also { searchCache = searchCache + (searchKind to it) }
        } catch (e: Exception) {
            emptyList()
        }
        searchResults = all.asSequence()
            .filter { it.name.contains(text, ignoreCase = true) }
            .take(300)
            .toList()
        searching = false
    }

    val current = playing
    if (current != null) {
        PlayerScreen(url = current.first, title = current.second, onClose = { playing = null })
        return
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // ---------------------------------------------------------- topo
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 22.dp, end = 12.dp, top = 12.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "REPTOR",
                color = ReptorGreen,
                fontSize = 22.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 5.sp
            )
            Spacer(Modifier.width(14.dp))
            Text(
                text = session.displayName(),
                color = ReptorTextDim,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f)
            )
            Text(text = clock, color = ReptorTextDim, fontSize = 13.sp)
            Spacer(Modifier.width(12.dp))
            TextButton(onClick = { retryTick++ }) {
                Text("Atualizar", color = ReptorTextDim, fontSize = 13.sp)
            }
        }

        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.25f))

        // ------------------------------------------------- corpo principal
        Box(Modifier.weight(1f).fillMaxWidth()) {
            when (tab) {
                Tab.SEARCH -> SearchTab(
                    query = query,
                    onQuery = { query = it },
                    searchKind = searchKind,
                    onKind = { searchKind = it },
                    results = searchResults,
                    searching = searching,
                    favorites = favorites,
                    onPlay = { play(it) },
                    onStar = { toggleFav(it) }
                )

                Tab.SETTINGS -> SettingsTab(
                    session = session,
                    onSwitch = onSwitch,
                    onRefresh = { retryTick++ },
                    onClearHistory = {
                        prefs.clearRecents()
                        recents = emptyList()
                    },
                    onClearFavorites = {
                        prefs.clearFavorites()
                        favorites = emptyList()
                    }
                )

                else -> {
                    val kind = kindOf(tab) ?: MediaKind.LIVE
                    val shown = when (filter) {
                        Filter.FAVORITES -> favorites.filter { it.kind == kind }
                        Filter.RECENTS -> recents.filter { it.kind == kind }
                        Filter.ALL -> items
                    }
                    Row(Modifier.fillMaxSize()) {
                        CategoryPanel(
                            categories = categories[kind].orEmpty(),
                            filter = filter,
                            onFilter = {
                                if (filter != it) {
                                    filter = it
                                    selectedCategory = null
                                }
                            },
                            selectedCategory = selectedCategory,
                            onCategory = {
                                selectedCategory = it
                                filter = Filter.ALL
                            },
                            categoryQuery = categoryQuery,
                            onCategoryQuery = { categoryQuery = it }
                        )

                        Box(Modifier.weight(1f).fillMaxHeight()) {
                            when {
                                loading && filter == Filter.ALL -> Box(
                                    Modifier.fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(color = ReptorGreen)
                                }

                                error != null && filter == Filter.ALL -> Column(
                                    Modifier.fillMaxSize().padding(24.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.Center
                                ) {
                                    Text(
                                        text = error ?: "",
                                        color = MaterialTheme.colorScheme.error,
                                        fontSize = 14.sp
                                    )
                                    Spacer(Modifier.height(12.dp))
                                    TextButton(onClick = { retryTick++ }) {
                                        Text("Tentar novamente")
                                    }
                                }

                                shown.isEmpty() -> Box(
                                    Modifier.fillMaxSize(),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = when (filter) {
                                            Filter.FAVORITES -> "Nenhum favorito nesta seção."
                                            Filter.RECENTS -> "Nada visto ainda nesta seção."
                                            Filter.ALL -> "Nenhum item nesta categoria."
                                        },
                                        color = ReptorTextDim,
                                        fontSize = 14.sp
                                    )
                                }

                                kind == MediaKind.LIVE -> ChannelList(
                                    items = shown,
                                    favorites = favorites,
                                    onPlay = { play(it) },
                                    onStar = { toggleFav(it) }
                                )

                                else -> PosterGrid(
                                    items = shown,
                                    favorites = favorites,
                                    onPlay = { play(it) },
                                    onStar = { toggleFav(it) }
                                )
                            }

                            if (resolving) {
                                Box(
                                    Modifier
                                        .fillMaxSize()
                                        .background(Color.Black.copy(alpha = 0.35f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    CircularProgressIndicator(color = ReptorGreen)
                                }
                            }
                        }
                    }
                }
            }
        }

        // ------------------------------------------------------ menu inferior
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.25f))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.96f))
                .padding(vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Tab.entries.forEach { entry ->
                NavButton(
                    label = entry.label,
                    selected = tab == entry,
                    onClick = {
                        if (tab != entry) {
                            tab = entry
                            if (entry != Tab.SEARCH) {
                                filter = Filter.ALL
                                selectedCategory = null
                            }
                        }
                    }
                )
            }
        }
    }
}

// ------------------------------------------------------------------ painel lateral

@Composable
private fun CategoryPanel(
    categories: List<Category>,
    filter: Filter,
    onFilter: (Filter) -> Unit,
    selectedCategory: String?,
    onCategory: (String) -> Unit,
    categoryQuery: String,
    onCategoryQuery: (String) -> Unit
) {
    val filtered = categories.filter {
        categoryQuery.isBlank() || it.name.contains(categoryQuery.trim(), ignoreCase = true)
    }

    Column(
        modifier = Modifier
            .width(228.dp)
            .fillMaxHeight()
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.55f))
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        OutlinedTextField(
            value = categoryQuery,
            onValueChange = onCategoryQuery,
            label = { Text("Buscar categorias", fontSize = 11.sp) },
            singleLine = true,
            textStyle = MaterialTheme.typography.bodySmall,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(10.dp))

        SideItem("Tudo", selected = filter == Filter.ALL) { onFilter(Filter.ALL) }
        SideItem("Favoritos", selected = filter == Filter.FAVORITES) { onFilter(Filter.FAVORITES) }
        SideItem("Visto recentemente", selected = filter == Filter.RECENTS) {
            onFilter(Filter.RECENTS)
        }

        Spacer(Modifier.height(8.dp))
        HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.25f))
        Spacer(Modifier.height(6.dp))

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            items(count = filtered.size, key = { index -> filtered[index].id }) { index ->
                val category = filtered[index]
                SideItem(
                    label = category.name,
                    selected = filter == Filter.ALL && selectedCategory == category.id
                ) { onCategory(category.id) }
            }
        }

        Spacer(Modifier.height(4.dp))
        Text(
            text = "${categories.size} categorias",
            color = ReptorTextDim,
            fontSize = 10.sp,
            modifier = Modifier.padding(start = 6.dp)
        )
    }
}

@Composable
private fun SideItem(label: String, selected: Boolean, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(
                when {
                    selected -> ReptorGreen.copy(alpha = 0.20f)
                    focused -> MaterialTheme.colorScheme.surfaceVariant
                    else -> Color.Transparent
                }
            )
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp)
    ) {
        Text(
            text = label,
            color = if (selected) ReptorGreen else MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 13.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

// ------------------------------------------------------------------ listas

@Composable
private fun ChannelList(
    items: List<MediaEntry>,
    favorites: List<MediaEntry>,
    onPlay: (MediaEntry) -> Unit,
    onStar: (MediaEntry) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(start = 14.dp, end = 16.dp, top = 8.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        items(count = items.size, key = { index -> items[index].id }) { index ->
            val entry = items[index]
            ChannelRow(
                number = index + 1,
                entry = entry,
                favorite = favorites.any { it.kind == entry.kind && it.id == entry.id },
                onClick = { onPlay(entry) },
                onStar = { onStar(entry) }
            )
        }
    }
}

@Composable
private fun ChannelRow(
    number: Int,
    entry: MediaEntry,
    favorite: Boolean,
    onClick: () -> Unit,
    onStar: () -> Unit
) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(10.dp)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(
                if (focused) MaterialTheme.colorScheme.surfaceVariant
                else MaterialTheme.colorScheme.surface.copy(alpha = 0.35f)
            )
            .then(if (focused) Modifier.border(2.dp, ReptorGreen, shape) else Modifier)
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = number.toString(),
            color = ReptorTextDim,
            fontSize = 12.sp,
            modifier = Modifier.width(34.dp)
        )
        Box(
            modifier = Modifier
                .size(width = 58.dp, height = 36.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(Color(0xFF0A140D)),
            contentAlignment = Alignment.Center
        ) {
            if (!entry.logo.isNullOrBlank()) {
                AsyncImage(
                    model = entry.logo,
                    contentDescription = entry.name,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize().padding(3.dp)
                )
            } else {
                Text(
                    text = entry.name.take(1).uppercase(),
                    color = ReptorGreen,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Black
                )
            }
        }
        Spacer(Modifier.width(12.dp))
        Text(
            text = entry.name,
            color = MaterialTheme.colorScheme.onSurface,
            fontSize = 14.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
        TextButton(onClick = onStar) {
            Text(
                text = if (favorite) "★" else "☆",
                color = if (favorite) ReptorGreen else ReptorTextDim,
                fontSize = 18.sp
            )
        }
    }
}

@Composable
private fun PosterGrid(
    items: List<MediaEntry>,
    favorites: List<MediaEntry>,
    onPlay: (MediaEntry) -> Unit,
    onStar: (MediaEntry) -> Unit
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 118.dp),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 20.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(count = items.size, key = { index -> items[index].id }) { index ->
            val entry = items[index]
            PosterCard(
                entry = entry,
                favorite = favorites.any { it.kind == entry.kind && it.id == entry.id },
                onClick = { onPlay(entry) },
                onStar = { onStar(entry) }
            )
        }
    }
}

@Composable
private fun PosterCard(
    entry: MediaEntry,
    favorite: Boolean,
    onClick: () -> Unit,
    onStar: () -> Unit
) {
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(10.dp)

    Column(
        modifier = Modifier
            .clip(shape)
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .then(if (focused) Modifier.border(2.dp, ReptorGreen, shape) else Modifier)
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .background(Color(0xFF0A140D)),
            contentAlignment = Alignment.Center
        ) {
            if (!entry.logo.isNullOrBlank()) {
                AsyncImage(
                    model = entry.logo,
                    contentDescription = entry.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
            } else {
                Text(
                    text = entry.name.take(1).uppercase(),
                    color = ReptorGreen,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Black
                )
            }

            Box(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(2.dp)
                    .clip(RoundedCornerShape(50))
                    .background(Color.Black.copy(alpha = 0.55f))
                    .clickable(onClick = onStar)
                    .padding(horizontal = 7.dp, vertical = 2.dp)
            ) {
                Text(
                    text = if (favorite) "★" else "☆",
                    color = if (favorite) ReptorGreen else Color.White,
                    fontSize = 14.sp
                )
            }
        }
        Text(
            text = entry.name,
            color = MaterialTheme.colorScheme.onSurface,
            fontSize = 12.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp)
        )
    }
}

// ------------------------------------------------------------------ busca

@Composable
private fun SearchTab(
    query: String,
    onQuery: (String) -> Unit,
    searchKind: MediaKind,
    onKind: (MediaKind) -> Unit,
    results: List<MediaEntry>,
    searching: Boolean,
    favorites: List<MediaEntry>,
    onPlay: (MediaEntry) -> Unit,
    onStar: (MediaEntry) -> Unit
) {
    Column(Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 12.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = onQuery,
            label = { Text("Procurar por nome") },
            placeholder = { Text("Digite pelo menos 2 letras") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(10.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MediaKind.entries.forEach { entry ->
                Chip(
                    label = entry.label,
                    selected = searchKind == entry,
                    onClick = { onKind(entry) }
                )
            }
        }

        Spacer(Modifier.height(12.dp))

        Box(Modifier.weight(1f).fillMaxWidth()) {
            when {
                searching -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = ReptorGreen)
                }

                query.trim().length < 2 -> Box(
                    Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Digite o nome de um canal, filme ou série.",
                        color = ReptorTextDim,
                        fontSize = 14.sp
                    )
                }

                results.isEmpty() -> Box(
                    Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Nada encontrado.", color = ReptorTextDim, fontSize = 14.sp)
                }

                searchKind == MediaKind.LIVE -> ChannelList(
                    items = results,
                    favorites = favorites,
                    onPlay = onPlay,
                    onStar = onStar
                )

                else -> PosterGrid(
                    items = results,
                    favorites = favorites,
                    onPlay = onPlay,
                    onStar = onStar
                )
            }
        }
    }
}

// ------------------------------------------------------------------ ajustes

@Composable
private fun SettingsTab(
    session: Session,
    onSwitch: () -> Unit,
    onRefresh: () -> Unit,
    onClearHistory: () -> Unit,
    onClearFavorites: () -> Unit
) {
    Column(
        Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 18.dp)
    ) {
        Text(
            text = "AJUSTES",
            color = ReptorGreen,
            fontSize = 18.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 3.sp
        )
        Spacer(Modifier.height(16.dp))

        Surface(
            shape = RoundedCornerShape(14.dp),
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(18.dp)) {
                InfoLine("Lista", session.displayName())
                InfoLine(
                    "Tipo",
                    if (session.mode == LoginMode.XTREAM) "Xtream Codes" else "Lista M3U"
                )
                if (session.mode == LoginMode.XTREAM) {
                    InfoLine("Servidor", session.normalizedBase())
                    InfoLine("Usuário", session.username)
                }
                InfoLine("Player", "Reptor Player 1.1.0")
            }
        }

        Spacer(Modifier.height(20.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(onClick = onSwitch) { Text("Trocar lista") }
            Button(onClick = onRefresh) { Text("Atualizar conteúdo") }
        }

        Spacer(Modifier.height(10.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            TextButton(onClick = onClearHistory) {
                Text("Limpar histórico", color = ReptorTextDim)
            }
            TextButton(onClick = onClearFavorites) {
                Text("Limpar favoritos", color = ReptorTextDim)
            }
        }

        Spacer(Modifier.weight(1f))

        Text(
            text = "Nenhuma ativação. Nenhum MAC. Apenas a sua lista.",
            color = ReptorTextDim,
            fontSize = 12.sp
        )
    }
}

@Composable
private fun InfoLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Text(
            text = label,
            color = ReptorTextDim,
            fontSize = 13.sp,
            modifier = Modifier.width(100.dp)
        )
        Text(
            text = value,
            color = MaterialTheme.colorScheme.onSurface,
            fontSize = 13.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
    }
}

// ------------------------------------------------------------------ componentes

@Composable
private fun NavButton(label: String, selected: Boolean, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(
                when {
                    selected -> ReptorGreen.copy(alpha = 0.18f)
                    focused -> MaterialTheme.colorScheme.surfaceVariant
                    else -> Color.Transparent
                }
            )
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = label,
            color = if (selected) ReptorGreen else MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = 13.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
        )
    }
}

@Composable
private fun Chip(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(if (selected) ReptorGreen else MaterialTheme.colorScheme.surfaceVariant)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Text(
            text = label,
            color = if (selected) {
                MaterialTheme.colorScheme.onPrimary
            } else {
                MaterialTheme.colorScheme.onSurfaceVariant
            },
            fontSize = 13.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium
        )
    }
}
