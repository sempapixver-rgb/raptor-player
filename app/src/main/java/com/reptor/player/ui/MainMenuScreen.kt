package com.reptor.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.runtime.LaunchedEffect
import kotlinx.coroutines.delay
import com.reptor.player.ui.theme.ReptorBackground
import com.reptor.player.ui.theme.ReptorGreen
import com.reptor.player.ui.theme.ReptorOutline
import com.reptor.player.ui.theme.ReptorSurfaceHigh
import com.reptor.player.ui.theme.ReptorText
import com.reptor.player.ui.theme.ReptorTextDim

/**
 * Menu principal do app na TV: Canais, Filmes, Séries e Ajustes.
 *
 * É a primeira tela depois da ativação, igual à versão da LG. Voltar de uma
 * aba cai aqui de novo.
 */
@Composable
fun MainMenuScreen(
    accountLabel: String,
    deviceCode: String,
    loadingLabel: String? = null,
    onOpen: (Tab) -> Unit
) {
    val firstFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        // A tela pode ainda não estar montada no primeiro frame; tenta de novo
        // até o cartão "Canais" aceitar o foco (senão o controle fica sem
        // seleção ao voltar de uma aba).
        repeat(6) {
            delay(80)
            if (runCatching { firstFocus.requestFocus() }.isSuccess) return@LaunchedEffect
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(ReptorBackground, Color(0xFF07260F), ReptorBackground)
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 28.dp, vertical = 22.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "REPTOR",
                    color = ReptorGreen,
                    fontSize = 34.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 8.sp
                )
                Spacer(Modifier.width(14.dp))
                Text(
                    text = "VIDEO PLAYER",
                    color = ReptorTextDim,
                    fontSize = 11.sp,
                    letterSpacing = 5.sp
                )
                Spacer(Modifier.weight(1f))
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = accountLabel,
                        color = ReptorText,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "Aparelho $deviceCode",
                        color = ReptorTextDim,
                        fontSize = 10.sp,
                        letterSpacing = 1.sp
                    )
                }
            }

            Spacer(Modifier.height(34.dp))

            Text(
                text = "O que você quer assistir?",
                color = ReptorText,
                fontSize = 30.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = "Use as setas do controle para escolher e OK para abrir.",
                color = ReptorTextDim,
                fontSize = 13.sp,
                modifier = Modifier.padding(top = 6.dp)
            )

            Spacer(Modifier.height(22.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                MenuCard(
                    glyph = "TV",
                    title = "Canais",
                    detail = "Assistir ao vivo",
                    modifier = Modifier.weight(1f).fillMaxSize(),
                    focusRequester = firstFocus,
                    onClick = { onOpen(Tab.CHANNELS) }
                )
                MenuCard(
                    glyph = "FILME",
                    title = "Filmes",
                    detail = "Catálogo de filmes",
                    modifier = Modifier.weight(1f).fillMaxSize(),
                    onClick = { onOpen(Tab.MOVIES) }
                )
                MenuCard(
                    glyph = "SÉRIES",
                    title = "Séries",
                    detail = "Temporadas e episódios",
                    modifier = Modifier.weight(1f).fillMaxSize(),
                    onClick = { onOpen(Tab.SERIES) }
                )
                MenuCard(
                    glyph = "AJUSTES",
                    title = "Ajustes",
                    detail = "Conta e ativação",
                    modifier = Modifier.weight(1f).fillMaxSize(),
                    onClick = { onOpen(Tab.SETTINGS) }
                )
            }

            Row(
                modifier = Modifier.padding(top = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (loadingLabel != null) {
                    CircularProgressIndicator(
                        color = ReptorGreen,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = loadingLabel,
                        color = ReptorGreen,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = "Preparando as pastas. Você já pode abrir uma aba.",
                        color = ReptorTextDim,
                        fontSize = 11.sp
                    )
                } else {
                    Text(
                        text = "Pastas prontas. Voltar fecha esta tela. Dentro de uma aba, Voltar retorna ao menu.",
                        color = ReptorTextDim,
                        fontSize = 11.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun MenuCard(
    glyph: String,
    title: String,
    detail: String,
    modifier: Modifier = Modifier,
    focusRequester: FocusRequester? = null,
    onClick: () -> Unit
) {
    var focused by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(if (focused) ReptorSurfaceHigh else Color(0xFF0E1A12))
            .border(
                width = if (focused) 2.dp else 1.dp,
                color = if (focused) ReptorGreen else ReptorOutline.copy(alpha = 0.5f),
                shape = RoundedCornerShape(16.dp)
            )
            .then(if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = onClick)
            .padding(20.dp),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = glyph,
            color = if (focused) ReptorGreen else ReptorGreen.copy(alpha = 0.65f),
            fontSize = 24.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 2.sp
        )
        Column {
            Text(
                text = title,
                color = ReptorText,
                fontSize = 24.sp,
                fontWeight = FontWeight.ExtraBold
            )
            Text(
                text = detail,
                color = ReptorTextDim,
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}
