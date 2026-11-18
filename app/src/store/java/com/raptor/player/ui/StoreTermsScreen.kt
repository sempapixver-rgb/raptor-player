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

/** Terms version. Increase it when the text changes so acceptance is requested again. */
const val STORE_TERMS_VERSION = 3

/** Store-edition terms: only the player, the device and the samples. */
val LOJA_TERMS_SECTIONS: List<Pair<String, String>> = listOf(
    "1. What Raptor Player is" to
        "Raptor Player is a video player. It plays the public sample videos " +
        "included in the app.",
    "2. Device code" to
        "The app shows the device's MAC code and a QR code. They are used only " +
        "to identify the TV on the registration website.",
    "3. TV registration" to
        "When you register the code on the website, the device is recognized. The app " +
        "does not ask for sign-in details and receives no access data from the website.",
    "4. Sample videos" to
        "The test button plays public sample videos hosted in the project's " +
        "own release files.",
    "5. Privacy" to
        "We do not collect location, contacts, photos or device files. " +
        "The device code is used only to register the TV.",
    "6. Acceptance" to
        "By selecting “Accept and continue”, you confirm that you have read and " +
        "agree to these terms."
)

const val LOJA_TERMS_NOTICE =
    "This app is a video player with public samples. No sign-in or access " +
    "details are required."

/** First-launch screen: acceptance is mandatory before using the app. */
@Composable
fun StoreTermsScreen(
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    sections: List<Pair<String, String>> = LOJA_TERMS_SECTIONS,
    notice: String = LOJA_TERMS_NOTICE
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
                text = "TERMS OF USE AND LIABILITY NOTICE",
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
                text = "If you do not agree to the terms, close the app.",
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
                        text = "I do not accept",
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
                        text = "Accept and continue",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}
