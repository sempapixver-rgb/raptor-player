package com.raptor.player.ui

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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.raptor.player.ui.theme.RaptorBackground
import com.raptor.player.ui.theme.RaptorGreen
import com.raptor.player.ui.theme.RaptorOutline
import com.raptor.player.ui.theme.RaptorText
import com.raptor.player.ui.theme.RaptorTextDim
import kotlinx.coroutines.delay

/** Versão do termo. Se o texto mudar, aumente para pedir o aceite novamente. */
const val TERMS_VERSION = 2

/** Termos da edição de loja: apenas o tocador, o aparelho e os exemplos. */
val STORE_TERMS_SECTIONS: List<Pair<String, String>> = listOf(
    "1. O que é o Raptor Player" to
        "O Raptor Player é um tocador de vídeo. Ele reproduz os vídeos públicos " +
        "de demonstração incluídos no aplicativo.",
    "2. Código do aparelho" to
        "O aplicativo mostra o código MAC do aparelho e um QR Code. Eles servem " +
        "apenas para identificar a TV no site de cadastro.",
    "3. Cadastro da TV" to
        "Ao cadastrar o código no site, o aparelho fica reconhecido. O aplicativo " +
        "não pede login e não recebe dados de acesso pelo site.",
    "4. Vídeos de demonstração" to
        "O botão de teste reproduz vídeos públicos de exemplo, hospedados nos " +
        "arquivos do próprio projeto.",
    "5. Privacidade" to
        "Não coletamos localização, contatos, fotos nem arquivos do aparelho. " +
        "O código do aparelho é usado somente para o cadastro da TV.",
    "6. Aceite" to
        "Ao tocar em “Aceitar e continuar”, você confirma que leu e concorda " +
        "com estes termos."
)

const val STORE_TERMS_NOTICE =
    "Este aplicativo é um tocador de vídeo com exemplos públicos. Não há login " +
    "nem dados de acesso a informar."

/** Tela de primeiro acesso: o aceite é obrigatório antes de usar o app. */
@Composable
fun TermsScreen(
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    sections: List<Pair<String, String>> = STORE_TERMS_SECTIONS,
    notice: String = STORE_TERMS_NOTICE
) {
    var acceptFocused by remember { mutableStateOf(false) }
    var declineFocused by remember { mutableStateOf(false) }
    val acceptFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) {
        delay(120)
        runCatching { acceptFocus.requestFocus() }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(RaptorBackground, Color(0xFF07260F), RaptorBackground)
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
                text = "RAPTOR",
                color = RaptorGreen,
                fontSize = 34.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 8.sp
            )
            Text(
                text = "VIDEO PLAYER",
                color = RaptorTextDim,
                fontSize = 11.sp,
                letterSpacing = 5.sp
            )

            Spacer(Modifier.height(14.dp))

            Text(
                text = "TERMO DE USO E AVISO DE RESPONSABILIDADE",
                color = RaptorText,
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
                    sections.forEach { (title, body) ->
                        Text(
                            text = title,
                            color = RaptorGreen,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(3.dp))
                        Text(
                            text = body,
                            color = RaptorText,
                            fontSize = 12.sp,
                            lineHeight = 18.sp
                        )
                        Spacer(Modifier.height(12.dp))
                    }

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(10.dp))
                            .background(RaptorGreen.copy(alpha = 0.10f))
                            .border(
                                1.dp,
                                RaptorOutline.copy(alpha = 0.7f),
                                RoundedCornerShape(10.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 10.dp)
                    ) {
                        Text(
                            text = notice,
                            color = RaptorGreen,
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
                color = RaptorTextDim,
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
                TextButton(
                    onClick = onDecline,
                    modifier = Modifier.onFocusChanged { declineFocused = it.isFocused }
                ) {
                    Text(
                        text = "Não aceito",
                        color = if (declineFocused) RaptorText else RaptorTextDim,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Spacer(Modifier.width(16.dp))
                Button(
                    onClick = onAccept,
                    modifier = Modifier
                        .height(46.dp)
                        .focusRequester(acceptFocus)
                        .onFocusChanged { acceptFocused = it.isFocused }
                        .border(
                            width = if (acceptFocused) 2.dp else 0.dp,
                            color = if (acceptFocused) Color.White else Color.Transparent,
                            shape = RoundedCornerShape(12.dp)
                        ),
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
