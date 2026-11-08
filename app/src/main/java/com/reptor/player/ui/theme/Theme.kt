package com.reptor.player.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val ReptorGreen = Color(0xFF00E676)
val ReptorGreenSoft = Color(0xFF69F0AE)
val ReptorBackground = Color(0xFF0B0F0C)
val ReptorSurface = Color(0xFF121A14)
val ReptorSurfaceHigh = Color(0xFF1B261E)
val ReptorText = Color(0xFFE6F2E9)
val ReptorTextDim = Color(0xFFA8C2B0)
val ReptorOutline = Color(0xFF2E4A36)

private val ReptorColors = darkColorScheme(
    primary = ReptorGreen,
    onPrimary = Color(0xFF00210F),
    primaryContainer = Color(0xFF00391C),
    onPrimaryContainer = ReptorGreenSoft,
    secondary = ReptorGreenSoft,
    onSecondary = Color(0xFF00210F),
    background = ReptorBackground,
    onBackground = ReptorText,
    surface = ReptorSurface,
    onSurface = ReptorText,
    surfaceVariant = ReptorSurfaceHigh,
    onSurfaceVariant = ReptorTextDim,
    outline = ReptorOutline,
    error = Color(0xFFFF6B6B),
    onError = Color(0xFF2B0000)
)

@Composable
fun ReptorTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ReptorColors,
        typography = Typography(),
        content = content
    )
}
