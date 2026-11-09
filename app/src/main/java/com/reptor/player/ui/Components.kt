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
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.reptor.player.data.Category
import com.reptor.player.data.MediaEntry
import com.reptor.player.ui.theme.ReptorGreen
import com.reptor.player.ui.theme.ReptorOutline
import com.reptor.player.ui.theme.ReptorSurfaceHigh
import com.reptor.player.ui.theme.ReptorText
import com.reptor.player.ui.theme.ReptorTextDim

enum class Tab(val label: String) {
    CHANNELS("Canais"),
    MOVIES("Filmes"),
    SERIES("Séries"),
    SETTINGS("Ajustes")
}

enum class Filter { ALL, FAVORITES, RECENTS }

// ------------------------------------------------------------------ topo

@Composable
fun TopBar(
    title: String,
    subtitle: String,
    clock: String,
    onRefresh: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(ReptorSurfaceHigh.copy(alpha = 0.55f))
            .padding(start = 20.dp, end = 14.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "REPTOR",
            color = ReptorGreen,
            fontSize = 20.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 4.sp
        )
        Spacer(Modifier.width(16.dp))
        Column(Modifier.weight(1f)) {
            Text(
                text = title,
                color = ReptorText,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = subtitle,
                color = ReptorTextDim,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Text(text = clock, color = ReptorTextDim, fontSize = 13.sp)
        Spacer(Modifier.width(10.dp))
        Box(
            Modifier
                .clip(RoundedCornerShape(8.dp))
                .background(ReptorSurfaceHigh)
                .clickable(onClick = onRefresh)
                .padding(horizontal = 12.dp, vertical = 7.dp)
        ) {
            Text("⟳  Atualizar", color = ReptorTextDim, fontSize = 12.sp)
        }
    }
}

// ------------------------------------------------------------- menu inferior

@Composable
fun BottomNav(tab: Tab, onTab: (Tab) -> Unit) {
    Column {
        HorizontalDivider(color = ReptorOutline.copy(alpha = 0.4f))
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(ReptorSurfaceHigh.copy(alpha = 0.85f))
                .padding(vertical = 5.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Tab.entries.forEach { entry ->
                val selected = tab == entry
                Column(
                    modifier = Modifier
                        .clip(RoundedCornerShape(9.dp))
                        .background(if (selected) ReptorGreen.copy(alpha = 0.16f) else Color.Transparent)
                        .clickable { onTab(entry) }
                        .padding(horizontal = 30.dp, vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = entry.label,
                        color = if (selected) ReptorGreen else ReptorTextDim,
                        fontSize = 13.sp,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal
                    )
                }
            }
        }
    }
}

// ------------------------------------------------------------------ busca

@Composable
fun SearchField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder, fontSize = 12.sp, color = ReptorTextDim) },
        singleLine = true,
        textStyle = MaterialTheme.typography.bodySmall,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        modifier = modifier
    )
}

// -------------------------------------------------------- painel de categorias

@Composable
fun CategoryPanel(
    categories: List<Category>,
    filter: Filter,
    onFilter: (Filter) -> Unit,
    selectedCategory: String?,
    onCategory: (String?) -> Unit,
    modifier: Modifier = Modifier,
    counts: Map<String, Int> = emptyMap(),
    totalCount: Int = 0,
    favoritesCount: Int = 0,
    recentsCount: Int = 0,
    categoryLabel: String = "Buscar categorias"
) {
    var query by remember { mutableStateOf("") }
    val filtered = categories.filter {
        query.isBlank() || it.name.contains(query.trim(), ignoreCase = true)
    }

    Column(
        modifier = modifier
            .fillMaxHeight()
            .background(ReptorSurfaceHigh.copy(alpha = 0.35f))
            .padding(horizontal = 10.dp, vertical = 10.dp)
    ) {
        SearchField(
            value = query,
            onValueChange = { query = it },
            placeholder = categoryLabel,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(8.dp))

        // Tudo, Favoritos, Visto recentemente e as categorias ficam na MESMA
        // lista rolável, como na referência: nada fixo, sem traço no meio e
        // sem rodapé espremendo as categorias.
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            item(key = "filters") {
                Column {
                    SideItem("Tudo", filter == Filter.ALL && selectedCategory == null, totalCount) {
                        onFilter(Filter.ALL)
                        onCategory(null)
                    }
                    SideItem("Favoritos", filter == Filter.FAVORITES, favoritesCount) {
                        onFilter(Filter.FAVORITES)
                    }
                    SideItem("Visto recentemente", filter == Filter.RECENTS, recentsCount) {
                        onFilter(Filter.RECENTS)
                    }
                }
            }

            items(count = filtered.size, key = { filtered[it].id }) { index ->
                val category = filtered[index]
                SideItem(
                    label = category.name,
                    selected = filter == Filter.ALL && selectedCategory == category.id,
                    count = counts[category.id]
                ) {
                    onFilter(Filter.ALL)
                    onCategory(category.id)
                }
            }
        }
    }
}

@Composable
fun SideItem(
    label: String,
    selected: Boolean,
    count: Int? = null,
    onClick: () -> Unit
) {
    var focused by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(
                when {
                    selected -> ReptorGreen.copy(alpha = 0.18f)
                    focused -> ReptorSurfaceHigh
                    else -> Color.Transparent
                }
            )
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            color = if (selected) ReptorGreen else ReptorTextDim,
            fontSize = 12.sp,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )
        if (count != null && count > 0) {
            Text(text = count.toString(), color = ReptorTextDim.copy(alpha = 0.75f), fontSize = 10.sp)
        }
    }
}

// ---------------------------------------------------------------- pôsteres

@Composable
fun PosterCard(
    entry: MediaEntry,
    isFavorite: Boolean,
    onClick: () -> Unit,
    onStar: () -> Unit,
    modifier: Modifier = Modifier
) {
    var focused by remember { mutableStateOf(false) }
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (focused) ReptorSurfaceHigh else Color.Transparent)
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(4.dp)
    ) {
        Box(
            Modifier
                .fillMaxWidth()
                .aspectRatio(2f / 3f)
                .clip(RoundedCornerShape(9.dp))
                .background(ReptorSurfaceHigh)
                .border(
                    width = if (focused) 2.dp else 0.dp,
                    color = if (focused) ReptorGreen else Color.Transparent,
                    shape = RoundedCornerShape(9.dp)
                )
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
                    text = entry.name,
                    color = ReptorTextDim,
                    fontSize = 11.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(8.dp)
                )
            }

            if (entry.rating != null && entry.rating > 0) {
                Box(
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(5.dp)
                        .clip(RoundedCornerShape(5.dp))
                        .background(Color(0xFF1E88E5))
                        .padding(horizontal = 5.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = String.format("%.1f", entry.rating),
                        color = Color.White,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Box(
                Modifier
                    .align(Alignment.TopStart)
                    .padding(4.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(Color.Black.copy(alpha = 0.45f))
                    .clickable(onClick = onStar)
                    .padding(horizontal = 5.dp, vertical = 1.dp)
            ) {
                Text(
                    text = if (isFavorite) "★" else "☆",
                    color = if (isFavorite) Color(0xFFFFC107) else Color.White,
                    fontSize = 13.sp
                )
            }

            if (focused) {
                Box(
                    Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                listOf(Color.Transparent, Color.Black.copy(alpha = 0.65f))
                            )
                        ),
                    contentAlignment = Alignment.BottomCenter
                ) {
                    Text(
                        text = "▶",
                        color = ReptorGreen,
                        fontSize = 22.sp,
                        modifier = Modifier.padding(bottom = 6.dp)
                    )
                }
            }
        }

        Text(
            text = entry.name,
            color = ReptorText,
            fontSize = 11.sp,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(start = 2.dp, top = 5.dp)
        )
    }
}

@Composable
fun PosterGrid(
    items: List<MediaEntry>,
    favorites: List<MediaEntry>,
    onClick: (MediaEntry) -> Unit,
    onStar: (MediaEntry) -> Unit,
    contentPadding: PaddingValues = PaddingValues(14.dp),
    columns: Int = 6
) {
    LazyVerticalGrid(
        columns = GridCells.Fixed(columns),
        contentPadding = contentPadding,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxSize()
    ) {
        items(items.size, key = { items[it].id }) { index ->
            val entry = items[index]
            PosterCard(
                entry = entry,
                isFavorite = favorites.any { it.kind == entry.kind && it.id == entry.id },
                onClick = { onClick(entry) },
                onStar = { onStar(entry) }
            )
        }
    }
}

// ------------------------------------------------------------- linha de canal

@Composable
fun ChannelRow(
    number: Int,
    entry: MediaEntry,
    isFavorite: Boolean,
    selected: Boolean,
    onClick: () -> Unit,
    onStar: () -> Unit
) {
    var focused by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(
                when {
                    selected -> ReptorGreen.copy(alpha = 0.14f)
                    focused -> ReptorSurfaceHigh
                    else -> Color.Transparent
                }
            )
            .border(
                width = if (selected) 1.dp else 0.dp,
                color = if (selected) ReptorGreen.copy(alpha = 0.6f) else Color.Transparent,
                shape = RoundedCornerShape(8.dp)
            )
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = number.toString(),
            color = ReptorTextDim.copy(alpha = 0.7f),
            fontSize = 10.sp,
            modifier = Modifier.width(30.dp)
        )

        Box(
            Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(6.dp))
                .background(ReptorSurfaceHigh)
        ) {
            if (!entry.logo.isNullOrBlank()) {
                AsyncImage(
                    model = entry.logo,
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize().padding(2.dp)
                )
            }
        }

        Spacer(Modifier.width(9.dp))

        Text(
            text = entry.name,
            color = if (selected) ReptorGreen else ReptorText,
            fontSize = 12.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f)
        )

        Box(
            Modifier
                .clip(RoundedCornerShape(6.dp))
                .clickable(onClick = onStar)
                .padding(horizontal = 6.dp, vertical = 2.dp)
        ) {
            Text(
                text = if (isFavorite) "★" else "☆",
                color = if (isFavorite) Color(0xFFFFC107) else ReptorTextDim,
                fontSize = 13.sp
            )
        }
    }
}

// ---------------------------------------------------------------- utilidades

@Composable
fun LoadingBox(text: String = "Carregando…") {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(color = ReptorGreen, strokeWidth = 2.dp)
            Spacer(Modifier.height(10.dp))
            Text(text, color = ReptorTextDim, fontSize = 12.sp)
        }
    }
}

@Composable
fun EmptyBox(text: String, action: (@Composable () -> Unit)? = null) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text, color = ReptorTextDim, fontSize = 13.sp, textAlign = TextAlign.Center)
            if (action != null) {
                Spacer(Modifier.height(10.dp))
                action()
            }
        }
    }
}

@Composable
fun ErrorBox(text: String, onRetry: () -> Unit) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, textAlign = TextAlign.Center)
            Spacer(Modifier.height(8.dp))
            TextButton(onClick = onRetry) { Text("Tentar novamente") }
        }
    }
}
