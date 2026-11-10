package com.reptor.player.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.reptor.player.data.Activation
import com.reptor.player.data.Session
import com.reptor.player.ui.theme.ReptorGreen
import com.reptor.player.ui.theme.ReptorOutline
import com.reptor.player.ui.theme.ReptorText
import com.reptor.player.ui.theme.ReptorTextDim
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Cartão de ativação pelo site. Mostra o QR Code + código da TV e fica
 * consultando o site até a ativação chegar.
 */
@Composable
fun ActivationCard(onActivated: (Session) -> Unit) {
    val context = LocalContext.current
    val code = remember { Activation.deviceCode(context) }
    val link = remember(code) { Activation.siteLink(code) }
    val qr = remember(link) { Activation.qrBitmap(link, 512) }
    val scope = rememberCoroutineScope()

    var activated by remember { mutableStateOf(false) }
    var checking by remember { mutableStateOf(false) }
    var missed by remember { mutableStateOf(false) }

    fun manualCheck() {
        if (checking || activated) return
        checking = true
        scope.launch {
            val session = withContext(Dispatchers.IO) { Activation.fetch(code) }
            checking = false
            if (session != null) {
                activated = true
                onActivated(session)
            } else {
                missed = true
            }
        }
    }

    // Consulta periódica: 5s no começo, depois 20s para não gastar rede à toa.
    LaunchedEffect(code) {
        var tries = 0
        while (!activated) {
            val session = withContext(Dispatchers.IO) { Activation.fetch(code) }
            if (session != null) {
                activated = true
                onActivated(session)
                break
            }
            tries++
            delay(if (tries < 20) 5_000 else 20_000)
        }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .widthIn(max = 520.dp),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)
        )
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(116.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(Color.White)
                    .padding(6.dp),
                contentAlignment = Alignment.Center
            ) {
                if (qr != null) {
                    Image(
                        bitmap = qr.asImageBitmap(),
                        contentDescription = "QR Code para ativar a TV",
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            Spacer(Modifier.width(14.dp))

            Column(Modifier.weight(1f)) {
                Text(
                    text = "ATIVAR PELO SITE",
                    color = ReptorTextDim,
                    fontSize = 10.sp,
                    letterSpacing = 2.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(3.dp))
                Text(
                    text = code,
                    color = ReptorGreen,
                    fontSize = 20.sp,
                    letterSpacing = 2.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Escaneie o QR ou use este código no site. A TV entra sozinha.",
                    color = ReptorTextDim,
                    fontSize = 11.sp,
                    lineHeight = 15.sp
                )
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (checking || !missed) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(13.dp),
                            strokeWidth = 1.8.dp,
                            color = ReptorGreen
                        )
                        Spacer(Modifier.width(7.dp))
                    }
                    Text(
                        text = when {
                            activated -> "Ativação recebida. Entrando…"
                            checking -> "Verificando ativação…"
                            missed -> "Ainda não encontrei. Confira o código no site."
                            else -> "Aguardando ativação no site…"
                        },
                        color = if (missed && !checking) ReptorText else ReptorTextDim,
                        fontSize = 11.sp
                    )
                }
                TextButton(
                    onClick = { manualCheck() },
                    modifier = Modifier.height(34.dp)
                ) {
                    Text(
                        text = "Verificar agora",
                        color = ReptorGreen,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(ReptorOutline.copy(alpha = 0.4f))
        )
        Text(
            text = Activation.SITE_BASE.removePrefix("https://").removePrefix("http://")
                .removeSuffix("/"),
            color = ReptorTextDim,
            fontSize = 10.sp,
            letterSpacing = 1.sp,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp)
        )
    }
}
