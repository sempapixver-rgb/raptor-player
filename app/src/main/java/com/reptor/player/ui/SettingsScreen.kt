package com.reptor.player.ui

import android.provider.Settings
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.reptor.player.data.AccountInfo
import com.reptor.player.data.LoginMode
import com.reptor.player.data.PlaylistSource
import com.reptor.player.data.Prefs
import com.reptor.player.data.Session
import com.reptor.player.data.displayName
import com.reptor.player.data.key
import com.reptor.player.ui.theme.ReptorGreen
import com.reptor.player.ui.theme.ReptorOutline
import com.reptor.player.ui.theme.ReptorSurfaceHigh
import com.reptor.player.ui.theme.ReptorText
import com.reptor.player.ui.theme.ReptorTextDim
import kotlinx.coroutines.delay

private data class SettingItem(
    val icon: String,
    val title: String,
    val subtitle: String,
    val danger: Boolean = false,
    val action: () -> Unit
)

@Composable
fun SettingsScreen(
    session: Session,
    source: PlaylistSource,
    prefs: Prefs,
    onSwitchList: () -> Unit,
    onRefresh: () -> Unit,
    onDataCleared: () -> Unit
) {
    val context = LocalContext.current
    var account by remember { mutableStateOf<AccountInfo?>(null) }
    var accountLoading by remember { mutableStateOf(true) }
    var message by remember { mutableStateOf<String?>(null) }
    var showTerms by remember { mutableStateOf(false) }
    val firstFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        delay(120)
        runCatching { firstFocus.requestFocus() }
    }

    LaunchedEffect(session.key()) {
        accountLoading = true
        account = runCatching { source.account() }.getOrNull()
        accountLoading = false
    }

    val deviceId = remember {
        runCatching {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        }.getOrNull().orEmpty()
    }
    val formattedId = remember(deviceId) {
        if (deviceId.isBlank()) "—"
        else deviceId.uppercase().chunked(2).joinToString(":")
    }

    val options = listOf(
        SettingItem("👤", "Minha conta", "Status e validade da lista") {
            message = null
        },
        SettingItem("⇄", "Trocar lista", "Escolher outra lista salva") {
            onSwitchList()
        },
        SettingItem("⟳", "Atualizar catálogo", "Recarregar canais, filmes e séries") {
            onRefresh()
            message = "Catálogo será recarregado ao voltar para as abas."
        },
        SettingItem("★", "Limpar favoritos", "Remove todos os itens marcados") {
            prefs.clearFavorites()
            onDataCleared()
            message = "Favoritos removidos."
        },
        SettingItem("🕘", "Limpar histórico", "Apaga o que já foi assistido") {
            prefs.clearRecents()
            onDataCleared()
            message = "Histórico removido."
        },
        SettingItem("📄", "Termos de uso", "Player de vídeo: não fornece conteúdo") {
            showTerms = true
        },
        SettingItem("ⓘ", "Sobre o Reptor", "Versão, privacidade e créditos") {
            message = "Reptor Player 1.2.2 · Tudo fica salvo apenas neste aparelho."
        },
        SettingItem("📺", "Formato de tela", "Paisagem fixa, imersivo") {
            message = "O app foi feito para tela horizontal (TV, box e tablet)."
        },
        SettingItem("🔒", "Privacidade", "Nenhum dado enviado a terceiros") {
            message = "As listas e credenciais ficam somente no aparelho."
        }
    )

    Column(Modifier.fillMaxSize().padding(14.dp)) {

        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Ajustes", color = ReptorText, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Text(
                    text = session.displayName(),
                    color = ReptorTextDim,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            Box(
                Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(ReptorSurfaceHigh)
                    .padding(horizontal = 12.dp, vertical = 7.dp)
            ) {
                Text(
                    text = when (session.mode) {
                        LoginMode.XTREAM -> "Xtream Codes"
                        LoginMode.M3U -> "Lista M3U"
                    },
                    color = ReptorGreen,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        Spacer(Modifier.height(12.dp))

        // ------------------------------------------------------ cartão da conta
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(ReptorSurfaceHigh.copy(alpha = 0.45f))
                .border(1.dp, ReptorOutline.copy(alpha = 0.6f), RoundedCornerShape(10.dp))
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    "CONTA",
                    color = ReptorGreen,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(4.dp))
                if (accountLoading) {
                    Text("Verificando conta…", color = ReptorTextDim, fontSize = 12.sp)
                } else if (account == null) {
                    Text(
                        text = if (session.mode == LoginMode.M3U)
                            "Lista M3U — sem dados de conta."
                        else "Não foi possível ler os dados da conta.",
                        color = ReptorTextDim,
                        fontSize = 12.sp
                    )
                } else {
                    val info = account!!
                    Text(
                        text = info.username.ifBlank { session.username },
                        color = ReptorText,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "Status: ${info.status.ifBlank { "—" }}" +
                            if (info.isTrial) " (teste)" else "",
                        color = ReptorTextDim,
                        fontSize = 11.sp
                    )
                    Text(
                        text = "Validade: ${formatExpiry(info.expiresAt)}",
                        color = ReptorTextDim,
                        fontSize = 11.sp
                    )
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text("CONEXÕES", color = ReptorGreen, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text(
                    text = account?.let { "${it.activeConnections.ifBlank { "0" }}/${it.maxConnections.ifBlank { "—" }}" } ?: "—",
                    color = ReptorText,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(4.dp))
                Text("ID do aparelho", color = ReptorTextDim, fontSize = 9.sp)
                Text(formattedId, color = ReptorTextDim, fontSize = 10.sp)
            }
        }

        if (message != null) {
            Spacer(Modifier.height(8.dp))
            Text(message ?: "", color = ReptorGreen, fontSize = 11.sp)
        }

        Spacer(Modifier.height(12.dp))
        HorizontalDivider(color = ReptorOutline.copy(alpha = 0.4f))
        Spacer(Modifier.height(12.dp))

        LazyVerticalGrid(
            columns = GridCells.Fixed(4),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(options.size) { index ->
                SettingCard(
                    item = options[index],
                    focusRequester = if (index == 0) firstFocus else null
                )
            }
        }
    }

    if (showTerms) {
        AlertDialog(
            onDismissRequest = { showTerms = false },
            title = {
                Text(
                    text = "Termo de uso e responsabilidade",
                    color = ReptorText,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(
                    modifier = Modifier.verticalScroll(rememberScrollState())
                ) {
                    Text(
                        text = termsPlainText(),
                        color = ReptorTextDim,
                        fontSize = 11.sp,
                        lineHeight = 16.sp
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { showTerms = false }) {
                    Text("Fechar", color = ReptorGreen, fontSize = 13.sp)
                }
            }
        )
    }
}

@Composable
private fun SettingCard(item: SettingItem, focusRequester: FocusRequester? = null) {
    var focused by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .background(
                if (focused) ReptorGreen.copy(alpha = 0.12f) else ReptorSurfaceHigh.copy(alpha = 0.55f)
            )
            .border(
                width = if (focused) 1.5.dp else 1.dp,
                color = if (focused) ReptorGreen else ReptorOutline.copy(alpha = 0.5f),
                shape = RoundedCornerShape(10.dp)
            )
            .then(
                if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier
            )
            .onFocusChanged { focused = it.isFocused }
            .clickable(onClick = item.action)
            .padding(horizontal = 12.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier
                .width(34.dp)
                .height(34.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(ReptorGreen.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center
        ) {
            Text(item.icon, color = ReptorGreen, fontSize = 15.sp)
        }

        Spacer(Modifier.width(10.dp))

        Column(Modifier.weight(1f)) {
            Text(
                text = item.title,
                color = if (item.danger) androidx.compose.ui.graphics.Color(0xFFFF8A80) else ReptorText,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = item.subtitle,
                color = ReptorTextDim,
                fontSize = 9.sp,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

private fun formatExpiry(raw: String): String {
    val value = raw.trim()
    if (value.isBlank() || value == "null" || value == "0") return "—"
    val seconds = value.toLongOrNull() ?: return value
    if (seconds <= 0) return "—"
    val date = java.util.Date(seconds * 1000)
    return java.text.SimpleDateFormat("dd/MM/yyyy", java.util.Locale.getDefault()).format(date)
}
