package com.raptor.player.ui

import android.view.ViewGroup
import android.widget.VideoView
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.raptor.player.ui.theme.RaptorBackground
import com.raptor.player.ui.theme.RaptorGreen
import com.raptor.player.ui.theme.RaptorText
import kotlinx.coroutines.delay

/** Um vídeo de demonstração. */
data class DemoPlayItem(val url: String, val title: String)

/**
 * Player dos vídeos de exemplo da edição de loja. Usa o player do próprio
 * Android, sem bibliotecas de formatos de mídia.
 */
@Composable
fun DemoPlayerScreen(
    url: String,
    title: String,
    onClose: () -> Unit,
    queue: List<DemoPlayItem> = emptyList(),
    startIndex: Int = 0,
    autoAdvance: Boolean = false,
    showCastButton: Boolean = false
) {
    val items = remember(queue, url, title) {
        if (queue.isNotEmpty()) queue else listOf(DemoPlayItem(url, title))
    }
    var index by remember(items) {
        mutableIntStateOf(startIndex.coerceIn(0, (items.size - 1).coerceAtLeast(0)))
    }
    val current = items.getOrNull(index) ?: DemoPlayItem(url, title)

    val videoRef = remember { mutableStateOf<VideoView?>(null) }
    var playing by remember { mutableStateOf(true) }
    var position by remember { mutableLongStateOf(0L) }
    var duration by remember { mutableLongStateOf(0L) }
    val closeFocus = remember { FocusRequester() }

    BackHandler(onBack = onClose)

    fun seekBy(deltaMs: Long) {
        val video = videoRef.value ?: return
        val target = (video.currentPosition.toLong() + deltaMs)
            .coerceIn(0L, video.duration.coerceAtLeast(0).toLong())
        video.seekTo(target.toInt())
        position = target
    }

    LaunchedEffect(index) {
        position = 0L
        duration = 0L
        playing = true
        delay(80)
        videoRef.value?.apply {
            setVideoPath(current.url)
            setOnPreparedListener { mp ->
                duration = mp.duration.toLong()
                start()
            }
            setOnCompletionListener {
                if (autoAdvance && index < items.lastIndex) {
                    index += 1
                } else {
                    playing = false
                    if (!autoAdvance) onClose()
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        while (true) {
            delay(400)
            videoRef.value?.let { video ->
                if (video.isPlaying) {
                    position = video.currentPosition.toLong()
                    duration = video.duration.toLong()
                }
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose { videoRef.value?.stopPlayback() }
    }

    LaunchedEffect(Unit) {
        delay(120)
        runCatching { closeFocus.requestFocus() }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                when (event.key) {
                    Key.DirectionLeft -> { seekBy(-30_000L); true }
                    Key.DirectionRight -> { seekBy(30_000L); true }
                    Key.ChannelUp -> { seekBy(600_000L); true }
                    Key.ChannelDown -> { seekBy(-600_000L); true }
                    Key.DirectionCenter -> {
                        playing = !playing
                        if (playing) videoRef.value?.start() else videoRef.value?.pause()
                        true
                    }
                    Key.Back -> { onClose(); true }
                    else -> false
                }
            }
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->
                VideoView(context).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    videoRef.value = this
                }
            }
        )

        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(Color(0xCC000000))
                .padding(horizontal = 16.dp, vertical = 10.dp)
        ) {
            Text(
                text = current.title,
                color = RaptorText,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.height(6.dp))

            Slider(
                value = position.toFloat().coerceIn(0f, duration.coerceAtLeast(1).toFloat()),
                valueRange = 0f..duration.coerceAtLeast(1).toFloat(),
                onValueChange = { value ->
                    position = value.toLong()
                    videoRef.value?.seekTo(value.toInt())
                },
                colors = SliderDefaults.colors(
                    activeTrackColor = RaptorGreen,
                    thumbColor = RaptorGreen
                ),
                modifier = Modifier.fillMaxWidth()
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                ControlButton("-30s") { seekBy(-30_000L) }
                ControlButton("-5min") { seekBy(-300_000L) }
                ControlButton(if (playing) "Pausar" else "Tocar") {
                    playing = !playing
                    if (playing) videoRef.value?.start() else videoRef.value?.pause()
                }
                ControlButton("+10min") { seekBy(600_000L) }
                ControlButton("+30s") { seekBy(30_000L) }
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = onClose,
                    modifier = Modifier
                        .height(38.dp)
                        .focusRequester(closeFocus),
                    shape = RoundedCornerShape(10.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        contentColor = RaptorGreen
                    )
                ) {
                    Text("Fechar", fontSize = 11.sp)
                }
            }
        }
    }
}

@Composable
private fun ControlButton(label: String, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        modifier = Modifier
            .padding(end = 5.dp)
            .height(38.dp)
            .sizeIn(minWidth = 60.dp),
        shape = RoundedCornerShape(10.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = RaptorGreen
        )
    ) {
        Text(label, fontSize = 11.sp)
    }
}
