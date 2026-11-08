package com.reptor.player.ui

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Context
import android.content.ContextWrapper
import android.os.Build
import android.util.Rational
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
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
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.common.C
import androidx.media3.common.MediaItem as ExoMediaItem
import androidx.media3.common.Player
import androidx.media3.common.TrackGroup
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.reptor.player.data.Prefs
import kotlinx.coroutines.delay

private val SPEEDS = listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 1.75f, 2f)

private data class TrackOption(val label: String, val override: TrackSelectionOverride?)

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(url: String, title: String, onClose: () -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val prefs = remember(context) { Prefs(context) }

    var resizeMode by remember { mutableIntStateOf(AspectRatioFrameLayout.RESIZE_MODE_FIT) }
    var speed by remember { mutableFloatStateOf(1f) }
    var controlsVisible by remember { mutableStateOf(true) }
    var isPlaying by remember { mutableStateOf(true) }
    var position by remember { mutableLongStateOf(0L) }
    var duration by remember { mutableLongStateOf(0L) }
    var audioTracks by remember { mutableStateOf<List<TrackOption>>(emptyList()) }
    var textTracks by remember { mutableStateOf<List<TrackOption>>(emptyList()) }
    var showSpeed by remember { mutableStateOf(false) }
    var showAudio by remember { mutableStateOf(false) }
    var showSubs by remember { mutableStateOf(false) }
    var audioLabel by remember { mutableStateOf("Áudio") }
    var subsLabel by remember { mutableStateOf("Legendas") }

    BackHandler {
        if (showSpeed || showAudio || showSubs) {
            showSpeed = false; showAudio = false; showSubs = false
        } else {
            onClose()
        }
    }

    val player = remember(url) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(ExoMediaItem.fromUri(url))
            prepare()
            playWhenReady = true
        }
    }

    // Retoma de onde parou (filmes/séries).
    LaunchedEffect(player) {
        val saved = prefs.resumeFor(url)
        if (saved > 5_000) {
            player.seekTo(saved)
        }
    }

    // Mantém a tela ligada enquanto o player está aberto.
    DisposableEffect(player) {
        val window = context.findActivity()?.window
        window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose {
            window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            runCatching { prefs.saveResume(url, player.currentPosition) }
            player.release()
        }
    }

    // Ao sair do app (home, recentes, tela bloqueada) o vídeo para.
    DisposableEffect(lifecycleOwner, player) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_STOP, Lifecycle.Event.ON_PAUSE -> player.pause()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Atualiza a interface periodicamente.
    LaunchedEffect(player) {
        while (true) {
            isPlaying = player.isPlaying
            position = player.currentPosition.coerceAtLeast(0)
            duration = player.duration
            delay(500)
        }
    }

    // Salva a posição a cada 10 segundos.
    LaunchedEffect(player) {
        while (true) {
            delay(10_000)
            if (player.isPlaying) {
                runCatching { prefs.saveResume(url, player.currentPosition) }
            }
        }
    }

    // Esconde os controles sozinhos.
    LaunchedEffect(controlsVisible, isPlaying) {
        if (controlsVisible) {
            delay(4500)
            controlsVisible = false
        }
    }

    // Lê as faixas de áudio e legenda disponíveis.
    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onTracksChanged(tracks: androidx.media3.common.Tracks) {
                val audio = ArrayList<TrackOption>()
                val text = ArrayList<TrackOption>()
                tracks.groups.forEach { group ->
                    if (group.type != C.TRACK_TYPE_AUDIO && group.type != C.TRACK_TYPE_TEXT) return@forEach
                    val target = if (group.type == C.TRACK_TYPE_AUDIO) audio else text
                    for (index in 0 until group.length) {
                        if (!group.isTrackSupported(index)) continue
                        val format = group.getTrackFormat(index)
                        val label = format.label
                            ?: format.language
                            ?: if (group.type == C.TRACK_TYPE_AUDIO) "Faixa ${index + 1}" else "Legenda ${index + 1}"
                        target.add(
                            TrackOption(
                                label = label,
                                override = TrackSelectionOverride(group.mediaTrackGroup, index)
                            )
                        )
                    }
                }
                audioTracks = audio
                textTracks = text
                if (audio.size > 1) audioLabel = "Áudio (${audio.size})"
                if (text.isNotEmpty()) subsLabel = "Legendas (${text.size})"
            }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }

    fun applyAudio(option: TrackOption?) {
        val builder = player.trackSelectionParameters.buildUpon()
        if (option?.override == null) {
            builder.clearOverridesOfType(C.TRACK_TYPE_AUDIO)
        } else {
            builder.setOverrideForType(option.override)
        }
        player.trackSelectionParameters = builder.build()
        audioLabel = option?.label ?: "Áudio"
    }

    fun applySubs(option: TrackOption?) {
        val builder = player.trackSelectionParameters.buildUpon()
        if (option?.override == null) {
            builder.clearOverridesOfType(C.TRACK_TYPE_TEXT)
            builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
            subsLabel = "Legendas"
        } else {
            builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
            builder.setOverrideForType(option.override)
            subsLabel = option.label
        }
        player.trackSelectionParameters = builder.build()
    }

    fun toggleControls() {
        controlsVisible = !controlsVisible
    }

    fun cycleResize() {
        resizeMode = when (resizeMode) {
            AspectRatioFrameLayout.RESIZE_MODE_FIT -> AspectRatioFrameLayout.RESIZE_MODE_FILL
            AspectRatioFrameLayout.RESIZE_MODE_FILL -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
            else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
        }
    }

    fun enterPip() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val activity = context.findActivity() ?: return
        runCatching {
            activity.enterPictureInPictureMode(
                PictureInPictureParams.Builder()
                    .setAspectRatio(Rational(16, 9))
                    .build()
            )
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    this.player = player
                    useController = false
                    setShowNextButton(false)
                    setShowPreviousButton(false)
                    resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                }
            },
            update = { view -> view.resizeMode = resizeMode },
            modifier = Modifier.fillMaxSize()
        )

        // Toque/clique em qualquer lugar mostra ou esconde os controles.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null
                ) { toggleControls() }
        )

        if (controlsVisible) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            0f to Color.Black.copy(alpha = 0.72f),
                            0.35f to Color.Transparent,
                            0.65f to Color.Transparent,
                            1f to Color.Black.copy(alpha = 0.82f)
                        )
                    )
            ) {
                // Topo
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = title,
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(onClick = { cycleResize() }) {
                        Text(
                            text = when (resizeMode) {
                                AspectRatioFrameLayout.RESIZE_MODE_FILL -> "Preencher"
                                AspectRatioFrameLayout.RESIZE_MODE_ZOOM -> "Zoom"
                                else -> "Ajustar"
                            },
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 13.sp
                        )
                    }
                    Box {
                        TextButton(onClick = { showSpeed = true }) {
                            Text(
                                text = if (speed == 1f) "1.0x" else "${speed}x",
                                color = MaterialTheme.colorScheme.primary,
                                fontSize = 13.sp
                            )
                        }
                        DropdownMenu(expanded = showSpeed, onDismissRequest = { showSpeed = false }) {
                            SPEEDS.forEach { option ->
                                DropdownMenuItem(
                                    text = { Text("${option}x") },
                                    onClick = {
                                        speed = option
                                        player.setPlaybackSpeed(option)
                                        showSpeed = false
                                    }
                                )
                            }
                        }
                    }
                    if (audioTracks.size > 1) {
                        Box {
                            TextButton(onClick = { showAudio = true }) {
                                Text(audioLabel, color = MaterialTheme.colorScheme.primary, fontSize = 13.sp)
                            }
                            DropdownMenu(expanded = showAudio, onDismissRequest = { showAudio = false }) {
                                audioTracks.forEach { option ->
                                    DropdownMenuItem(
                                        text = { Text(option.label) },
                                        onClick = { applyAudio(option); showAudio = false }
                                    )
                                }
                            }
                        }
                    }
                    if (textTracks.isNotEmpty()) {
                        Box {
                            TextButton(onClick = { showSubs = true }) {
                                Text(subsLabel, color = MaterialTheme.colorScheme.primary, fontSize = 13.sp)
                            }
                            DropdownMenu(expanded = showSubs, onDismissRequest = { showSubs = false }) {
                                DropdownMenuItem(
                                    text = { Text("Desligadas") },
                                    onClick = { applySubs(null); showSubs = false }
                                )
                                textTracks.forEach { option ->
                                    DropdownMenuItem(
                                        text = { Text(option.label) },
                                        onClick = { applySubs(option); showSubs = false }
                                    )
                                }
                            }
                        }
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        TextButton(onClick = { enterPip() }) {
                            Text("PiP", color = MaterialTheme.colorScheme.primary, fontSize = 13.sp)
                        }
                    }
                    TextButton(onClick = onClose) {
                        Text("Fechar", color = MaterialTheme.colorScheme.primary, fontSize = 13.sp)
                    }
                }

                Spacer(Modifier.weight(1f))

                // Centro
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = { player.seekTo((player.currentPosition - 10_000).coerceAtLeast(0)) }) {
                        Text("−10s", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.width(24.dp))
                    Box(
                        modifier = Modifier
                            .size(62.dp)
                            .background(Color.White.copy(alpha = 0.16f), RoundedCornerShape(50))
                            .focusable(),
                        contentAlignment = Alignment.Center
                    ) {
                        TextButton(onClick = {
                            if (player.isPlaying) player.pause() else player.play()
                        }) {
                            Text(
                                text = if (isPlaying) "❚❚" else "▶",
                                color = Color.White,
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                    Spacer(Modifier.width(24.dp))
                    TextButton(onClick = { player.seekTo(player.currentPosition + 10_000) }) {
                        Text("+10s", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(Modifier.weight(1f))

                // Base
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = formatTime(position),
                        color = Color.White,
                        fontSize = 12.sp
                    )
                    Spacer(Modifier.width(10.dp))
                    if (duration > 0) {
                        Slider(
                            value = position.coerceIn(0, duration).toFloat(),
                            onValueChange = { player.seekTo(it.toLong()) },
                            valueRange = 0f..duration.toFloat(),
                            modifier = Modifier.weight(1f)
                        )
                    } else {
                        Text(
                            text = "AO VIVO",
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Spacer(Modifier.width(10.dp))
                    Text(
                        text = if (duration > 0) formatTime(duration) else "",
                        color = Color.White,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}

private fun formatTime(millis: Long): String {
    if (millis <= 0) return "00:00"
    val totalSeconds = millis / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) {
        "%d:%02d:%02d".format(hours, minutes, seconds)
    } else {
        "%02d:%02d".format(minutes, seconds)
    }
}

private fun Context.findActivity(): Activity? {
    var current: Context = this
    while (current is ContextWrapper) {
        if (current is Activity) return current
        current = current.baseContext
    }
    return null
}
