package com.raptor.player.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.raptor.player.data.StoreActivation
import com.raptor.player.ui.theme.RaptorBackground
import com.raptor.player.ui.theme.RaptorGreen
import com.raptor.player.ui.theme.RaptorOutline
import com.raptor.player.ui.theme.RaptorText
import com.raptor.player.ui.theme.RaptorTextDim
import kotlinx.coroutines.delay

/**
 * Store-edition screen: shows the MAC code, the QR code in focus, the Activate TV
 * button and the player test. It opens no sign-in and no media configuration.
 */
@Composable
fun StoreHomeScreen(onDemo: () -> Unit) {
    val context = LocalContext.current
    val code = remember { StoreActivation.deviceCode(context) }
    val link = remember(code) { StoreActivation.siteLink(code) }
    val qr = remember(link) { StoreActivation.qrBitmap(link, 512) }

    var showQr by remember { mutableStateOf(false) }
    var qrFocused by remember { mutableStateOf(false) }
    val qrFocus = remember { FocusRequester() }

    BackHandler(enabled = showQr) { showQr = false }

    LaunchedEffect(showQr) {
        if (showQr) {
            delay(120)
            runCatching { qrFocus.requestFocus() }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(RaptorBackground)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 18.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "RAPTOR",
                color = RaptorGreen,
                fontSize = 30.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 8.sp
            )
            Text(
                text = "VIDEO PLAYER",
                color = RaptorTextDim,
                fontSize = 10.sp,
                letterSpacing = 5.sp
            )

            Spacer(Modifier.height(18.dp))

            Text(
                text = "Activate your TV",
                color = RaptorText,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(Modifier.height(5.dp))
            Text(
                text = "View the device code, scan the QR code and register the TV on the website.",
                color = RaptorTextDim,
                fontSize = 12.sp,
                lineHeight = 17.sp,
                textAlign = TextAlign.Center
            )

            Spacer(Modifier.height(16.dp))

            Card(
                modifier = Modifier.widthIn(max = 520.dp),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.96f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(210.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .padding(8.dp)
                            .onFocusChanged { qrFocused = it.isFocused }
                            .border(
                                width = if (qrFocused || showQr) 3.dp else 0.dp,
                                color = RaptorGreen,
                                shape = RoundedCornerShape(12.dp)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        if (qr != null) {
                            Image(
                                bitmap = qr.asImageBitmap(),
                                contentDescription = "QR code to register the TV",
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }

                    Spacer(Modifier.height(12.dp))

                    Text(
                        text = "MAC CODE",
                        color = RaptorTextDim,
                        fontSize = 10.sp,
                        letterSpacing = 2.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(3.dp))
                    Text(
                        text = code,
                        color = RaptorGreen,
                        fontSize = 19.sp,
                        letterSpacing = 2.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            Spacer(Modifier.height(18.dp))

            Button(
                onClick = { showQr = true },
                modifier = Modifier
                    .widthIn(max = 420.dp)
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                Text("Activate TV", fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(10.dp))

            Button(
                onClick = onDemo,
                modifier = Modifier
                    .widthIn(max = 420.dp)
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                Text(
                    "▶  Test the player (sample videos)",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(Modifier.height(16.dp))

            Text(
                text = "No sign-in or access details are requested.",
                color = RaptorTextDim,
                fontSize = 11.sp,
                textAlign = TextAlign.Center
            )
            Text(
                text = StoreActivation.SITE_BASE.removePrefix("https://")
                    .removePrefix("http://").removeSuffix("/"),
                color = RaptorTextDim,
                fontSize = 10.sp,
                letterSpacing = 1.sp
            )
        }

        if (showQr) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xD9000000)),
                contentAlignment = Alignment.Center
            ) {
                Card(
                    modifier = Modifier.widthIn(max = 560.dp).padding(20.dp),
                    shape = RoundedCornerShape(20.dp),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    )
                ) {
                    Column(
                        modifier = Modifier.padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "Activate TV",
                            color = RaptorText,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = "Scan the QR code or use the code below on the website.",
                            color = RaptorTextDim,
                            fontSize = 12.sp,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(14.dp))
                        Box(
                            modifier = Modifier
                                .size(260.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White)
                                .padding(8.dp)
                                .focusRequester(qrFocus)
                                .onFocusChanged { qrFocused = it.isFocused }
                                .border(
                                    width = if (qrFocused) 3.dp else 0.dp,
                                    color = RaptorGreen,
                                    shape = RoundedCornerShape(12.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            if (qr != null) {
                                Image(
                                    bitmap = qr.asImageBitmap(),
                                    contentDescription = "Enlarged QR code to activate the TV",
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        Text(
                            text = code,
                            color = RaptorGreen,
                            fontSize = 22.sp,
                            letterSpacing = 2.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        Spacer(Modifier.height(12.dp))
                        TextButton(onClick = { showQr = false }) {
                            Text("Close", color = RaptorGreen, fontSize = 13.sp)
                        }
                    }
                }
            }
        }
    }
}
