package com.reptor.player.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.reptor.player.ui.theme.ReptorBackground
import com.reptor.player.ui.theme.ReptorGreen
import com.reptor.player.ui.theme.ReptorOutline
import com.reptor.player.ui.theme.ReptorText
import com.reptor.player.ui.theme.ReptorTextDim

/** Versão do termo. Se o texto mudar, aumente para pedir o aceite novamente. */
const val TERMS_VERSION = 1

/**
 * Texto do Termo de Uso. O Reptor é só um tocador de vídeo: não fornece
 * conteúdo e não responde pelo que o usuário cadastra na lista dele.
 */
val TERMS_SECTIONS: List<Pair<String, String>> = listOf(
    "1. O que é o Reptor Player" to
        "O Reptor Player é apenas um tocador de vídeo (media player). " +
        "Não fornecemos, hospedamos, distribuímos, vendemos, transmitimos nem " +
        "indicamos canais, filmes, séries ou qualquer outro conteúdo.",
    "2. Origem do conteúdo" to
        "Todo o conteúdo exibido vem de listas (M3U), links ou servidores " +
        "informados exclusivamente pelo usuário. Não temos vínculo, parceria " +
        "ou responsabilidade sobre esses provedores ou sobre o material que eles oferecem.",
    "3. Responsabilidade do usuário" to
        "O usuário declara que possui as autorizações, assinaturas e licenças " +
        "necessárias para acessar o conteúdo que cadastra, sendo o único " +
        "responsável por ele e pelo uso que faz do aplicativo.",
    "4. Isenção de responsabilidade" to
        "Não nos responsabilizamos por conteúdo ilegal, violação de direitos " +
        "autorais, indisponibilidade, qualidade, cobranças, bloqueios ou " +
        "qualquer dano decorrente do uso de listas de terceiros.",
    "5. Privacidade" to
        "As listas e credenciais ficam salvas apenas neste aparelho. " +
        "Não enviamos seus dados a terceiros e não temos acesso ao que você assiste.",
    "6. Aceite" to
        "Ao tocar em “Aceitar e continuar”, você confirma que leu e concorda " +
        "com estes termos e assume total responsabilidade pelo uso do " +
        "aplicativo e pelo conteúdo que nele inserir."
)

/** Versão em texto corrido, usada no diálogo dos Ajustes. */
fun termsPlainText(): String =
    TERMS_SECTIONS.joinToString("\n\n") { (title, body) -> "$title\n$body" }

/**
 * Tela de primeiro acesso: o usuário precisa aceitar o termo antes de usar.
 * Se recusar, o app fecha — igual aos players de referência.
 */
@Composable
fun TermsScreen(onAccept: () -> Unit, onDecline: () -> Unit) {
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
                .padding(horizontal = 20.dp, vertical = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "REPTOR",
                color = ReptorGreen,
                fontSize = 34.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 8.sp
            )
            Text(
                text = "IPTV PLAYER",
                color = ReptorTextDim,
                fontSize = 11.sp,
                letterSpacing = 5.sp
            )

            Spacer(Modifier.height(14.dp))

            Text(
                text = "TERMO DE USO E AVISO DE RESPONSABILIDADE",
                color = ReptorText,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
                textAlign = TextAlign.Center
            )

            Spacer(Modifier.height(12.dp))

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 900.dp)
                    .weight(1f),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.95f)
                )
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp, vertical = 16.dp)
                ) {
                    TERMS_SECTIONS.forEach { (title, body) ->
                        Text(
                            text = title,
                            color = ReptorGreen,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(3.dp))
                        Text(
                            text = body,
                            color = ReptorText,
                            fontSize = 12.sp,
                            lineHeight = 18.sp
                        )
                        Spacer(Modifier.height(12.dp))
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(ReptorGreen.copy(alpha = 0.10f))
                            .border(
                                1.dp,
                                ReptorOutline.copy(alpha = 0.7f),
                                RoundedCornerShape(10.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 10.dp)
                    ) {
                        Text(
                            text = "Este aplicativo não fornece conteúdo. " +
                                "É apenas um player de vídeo.",
                            color = ReptorGreen,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            Text(
                text = "Se não concordar com os termos, feche o aplicativo.",
                color = ReptorTextDim,
                fontSize = 11.sp,
                textAlign = TextAlign.Center
            )

            Spacer(Modifier.height(10.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 900.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = onDecline) {
                    Text(
                        text = "Não aceito",
                        color = ReptorTextDim,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Spacer(Modifier.width(16.dp))
                Button(
                    onClick = onAccept,
                    modifier = Modifier.height(46.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = "Aceitar e continuar",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}
