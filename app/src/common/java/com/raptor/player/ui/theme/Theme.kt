package com.raptor.player.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val RaptorGreen = Color(0xFF00E676)
val RaptorGreenSoft = Color(0xFF69F0AE)
val RaptorBackground = Color(0xFF0B0F0C)
val RaptorSurface = Color(0xFF121A14)
val RaptorSurfaceHigh = Color(0xFF1B261E)
val RaptorText = Color(0xFFE6F2E9)
val RaptorTextDim = Color(0xFFA8C2B0)
val RaptorOutline = Color(0xFF2E4A36)

private val RaptorColors = darkColorScheme(
    primary = RaptorGreen,
    onPrimary = Color(0xFF00210F),
    primaryContainer = Color(0xFF00391C),
    onPrimaryContainer = RaptorGreenSoft,
    secondary = RaptorGreenSoft,
    onSecondary = Color(0xFF00210F),
    background = RaptorBackground,
    onBackground = RaptorText,
    surface = RaptorSurface,
    onSurface = RaptorText,
    surfaceVariant = RaptorSurfaceHigh,
    onSurfaceVariant = RaptorTextDim,
    outline = RaptorOutline,
    error = Color(0xFFFF6B6B),
    onError = Color(0xFF2B0000)
)

@Composable
fun RaptorTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = RaptorColors,
        typography = Typography(),
        content = content
    )
}
