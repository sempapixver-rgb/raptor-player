package com.raptor.player.ui

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
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.common.C
import androidx.media3.common.MediaItem as ExoMediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackGroup
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.raptor.player.data.Dlna
import com.raptor.player.data.DlnaDevice
import com.raptor.player.data.Prefs
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val SPEEDS = listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 1.75f, 2f)

/** Episódios de série: ponto em que a abertura termina. */
private const val SKIP_OPENING_MS = 40_000L

/** Canais ao vivo não têm duração nem ponto de retomada. */
private fun isLiveStream(url: String): Boolean {
    val low = url.lowercase()
    return low.contains("/live/") ||
        (low.contains(".m3u8") && !low.contains("/movie/") && !low.contains("/series/"))
}

private data class TrackOption(val label: String, val override: TrackSelectionOverride?)

/** Um item reproduzível: episódio ou filme/canal. */
data class PlayItem(val url: String, val title: String)

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(
    url: String,
    title: String,
    onClose: () -> Unit,
    queue: List<PlayItem> = emptyList(),
    startIndex: Int = 0,
    autoAdvance: Boolean = false,
    // Séries e filmes podem arrastar a barra; canais ao vivo, nunca.
    allowSeek: Boolean = true,
    showCastButton: Boolean = true
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val prefs = remember(context) { Prefs(context) }

    // Sem fila (filme/canal) toca um item só. Com fila (série) os botões
    // Anterior/Próximo trocam o episódio sem fechar o player.
    val items = remember(queue, url, title) {
        if (queue.isNotEmpty()) queue else listOf(PlayItem(url, title))
    }
    var index by remember(items) {
        mutableIntStateOf(startIndex.coerceIn(0, (items.size - 1).coerceAtLeast(0)))
    }
    val current = items.getOrNull(index) ?: PlayItem(url, title)

    var resizeMode by remember { mutableIntStateOf(AspectRatioFrameLayout.RESIZE_MODE_FIT) }
    var speed by remember { mutableFloatStateOf(1f) }
    var controlsVisible by remember { mutableStateOf(true) }
    var isPlaying by remember { mutableStateOf(true) }
    var position by remember { mutableLongStateOf(0L) }
    var duration by remember { mutableLongStateOf(0L) }
    // Arrastar a barra de tempo: mantém o dedo/enquanto o vídeo acompanha.
    var scrubbing by remember { mutableStateOf(false) }
    var scrubPosition by remember { mutableLongStateOf(0L) }
    var audioTracks by remember { mutableStateOf<List<TrackOption>>(emptyList()) }
    var textTracks by remember { mutableStateOf<List<TrackOption>>(emptyList()) }
    var showSpeed by remember { mutableStateOf(false) }
    var showAudio by remember { mutableStateOf(false) }
    var showSubs by remember { mutableStateOf(false) }
    var audioLabel by remember { mutableStateOf("Áudio") }
    var subsLabel by remember { mutableStateOf("Legendas") }
    // Erro de reprodução: aparece quando o vídeo não carrega mesmo após retries.
    var playbackError by remember { mutableStateOf<String?>(null) }
    var retryCount by remember { mutableIntStateOf(0) }
    val retryRef = rememberUpdatedState(retryCount)
    // Guarda do watchdog: nunca recarrega vídeo com o app em segundo plano.
    var appInForeground by remember { mutableStateOf(true) }
    val foregroundRef = rememberUpdatedState(appInForeground)
    var userPaused by remember { mutableStateOf(false) }
    val userPausedRef = rememberUpdatedState(userPaused)

    // Transmissão DLNA: o vídeo vai direto para a TV, sem espelhar a tela.
    var showCast by remember { mutableStateOf(false) }
    var castLoading by remember { mutableStateOf(false) }
    var castDevices by remember { mutableStateOf<List<DlnaDevice>>(emptyList()) }
    var castStatus by remember { mutableStateOf<String?>(null) }
    var castDevice by remember { mutableStateOf<DlnaDevice?>(null) }
    val castScope = rememberCoroutineScope()
    val castFocus = remember { FocusRequester() }
    val castRetryFocus = remember { FocusRequester() }

    BackHandler {
        when {
            showCast -> {
                showCast = false
                controlsVisible = true
            }
            showSpeed || showAudio || showSubs -> {
                showSpeed = false; showAudio = false; showSubs = false
            }
            else -> onClose()
        }
    }

    // Buffer menor que o padrão: abre mais rápido e usa menos memória.
    val player = remember {
        ExoPlayer.Builder(context)
            .setLoadControl(
                DefaultLoadControl.Builder()
                    .setBufferDurationsMs(20_000, 45_000, 1_500, 3_000)
                    .build()
            )
            .build()
    }

    // Recarrega o item atual do zero. Usado pelo botão "Tentar novamente" e
    // quando o usuário aperta play com o player em IDLE/erro.
    fun reloadCurrent() {
        playbackError = null
        userPaused = false
        controlsVisible = true
        player.playWhenReady = true
        player.setMediaItem(ExoMediaItem.fromUri(current.url))
        player.prepare()
        player.play()
    }

    // Play/pause do usuário: decide pelo estado REAL do player, não por
    // playWhenReady. Se o vídeo travou carregando, playWhenReady já é true e
    // o botão antigo PAUSAVA em vez de tocar — parecia que o play não funcionava.
    fun togglePlay() {
        // isPlaying é true também durante BUFFERING. Só consideramos "tocando"
        // quando há imagem na tela (STATE_READY); senão o botão ▶ pausava um
        // vídeo travado carregando e parecia não responder.
        val reallyPlaying = player.isPlaying && player.playbackState == Player.STATE_READY
        if (reallyPlaying) {
            userPaused = true
            player.playWhenReady = false
            player.pause()
        } else {
            userPaused = false
            playbackError = null
            player.playWhenReady = true
            if (player.playbackState == Player.STATE_IDLE ||
                player.playbackState == Player.STATE_ENDED ||
                player.playbackState == Player.STATE_BUFFERING ||
                player.playerError != null
            ) {
                player.setMediaItem(ExoMediaItem.fromUri(current.url))
                player.prepare()
            }
            player.play()
        }
    }

    // Troca de episódio: salva a posição do anterior, carrega o novo e
    // retoma de onde parou (filmes/séries).
    val currentUrl by rememberUpdatedState(current.url)
    val currentTitle by rememberUpdatedState(current.title)

    var lastUrl by remember { mutableStateOf<String?>(null) }
    var lastTitle by remember { mutableStateOf<String?>(null) }
    val resumeApplied = remember { mutableStateOf(false) }
    val resumeTarget = remember { mutableLongStateOf(0L) }
    val appliedRef = rememberUpdatedState(resumeApplied)
    val targetRef = rememberUpdatedState(resumeTarget)

    /** Move o vídeo para um ponto escolhido (barra de tempo ou "Pular abertura"). */
    fun seekTo(ms: Long) {
        // Canais ao vivo não têm ponto fixo: seek neles pode travar a transmissão.
        if (!allowSeek || isLiveStream(current.url)) return
        val target = ms.coerceIn(0L, if (duration > 0L) duration else Long.MAX_VALUE)
        // A retomada automática não pode voltar a acertar depois de um seek manual.
        resumeApplied.value = true
        player.seekTo(target)
        position = target
        scrubPosition = target
        controlsVisible = true
    }

    // Só episódios de série usam fila com avanço automático. Canais ao vivo
    // e filmes não ganham botão de abertura nem seek manual na barra.
    val isSeries = autoAdvance && items.size > 1

    LaunchedEffect(current.url) {
        val previous = lastUrl
        val previousTitle = lastTitle
        if (previous != null && previous != current.url) {
            val pos = player.currentPosition
            if (pos > 5_000L && previousTitle != null && !isLiveStream(previous)) {
                runCatching { prefs.saveResumeStable(previousTitle, pos) }
            }
        }
        lastUrl = current.url
        lastTitle = current.title
        position = 0L
        duration = 0L
        scrubbing = false
        scrubPosition = 0L
        isPlaying = true
        playbackError = null
        userPaused = false
        retryCount = 0
        // A chave de retomada é o TÍTULO (estável), não a URL (que muda no Xtream).
        resumeTarget.longValue = if (!isLiveStream(current.url)) prefs.resumeForStable(current.title) else 0L
        resumeApplied.value = false
        // playWhenReady primeiro: garante que o vídeo comece sozinho assim que
        // o primeiro frame estiver pronto (canais ao vivo, filmes e séries).
        player.playWhenReady = true
        player.setMediaItem(ExoMediaItem.fromUri(current.url))
        player.prepare()
    }

    // Aplica a posição salva SÓ quando o jogador já tem duração conhecida.
    // (seekTo antes do prepare ser concluído é ignorado e faz o vídeo começar do zero.)
    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                // Filme falhou ao carregar: tenta de novo algumas vezes sem
                // pedir nada ao usuário (o servidor costuma recusar a 1ª conexão).
                playbackError = error.message ?: "Não foi possível reproduzir"
                val tries = retryRef.value
                if (tries < 3 && !isLiveStream(currentUrl)) {
                    retryCount = tries + 1
                    playbackError = null
                    player.playWhenReady = true
                    player.setMediaItem(ExoMediaItem.fromUri(currentUrl))
                    player.prepare()
                }
            }

            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState != Player.STATE_READY) return
                playbackError = null
                // Autoplay: garante que comece sozinho quando o vídeo fica pronto.
                // Nunca reativa com o app em segundo plano.
                if (!player.playWhenReady && foregroundRef.value) player.playWhenReady = true
                if (!appliedRef.value.value && targetRef.value.longValue > 5_000L) {
                    val dur = player.duration
                    val target = targetRef.value.longValue
                    if (dur > 0L && target < dur - 2_000L) {
                        player.seekTo(target)
                    }
                    appliedRef.value.value = true
                }
            }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }

    // Watchdog: alguns servidores recusam a primeira conexão e o ExoPlayer fica
    // preso em BUFFERING sem disparar onPlayerError. Se o relógio não andar por
    // 10 s, recarregamos o item — sem isso o filme abria e ficava preto.
    LaunchedEffect(player) {
        while (true) {
            delay(2_000)
            if (!foregroundRef.value) continue
            if (player.playbackState != Player.STATE_BUFFERING || isLiveStream(currentUrl)) continue
            val before = player.currentPosition
            delay(10_000)
            if (player.playbackState != Player.STATE_BUFFERING ||
                player.currentPosition > before + 500L
            ) continue
            val tries = retryRef.value
            if (tries >= 3) {
                playbackError = "O vídeo não carregou. Verifique sua conexão."
                continue
            }
            retryCount = tries + 1
            playbackError = null
            player.playWhenReady = true
            player.setMediaItem(ExoMediaItem.fromUri(currentUrl))
            player.prepare()
            player.play()
        }
    }

    // Mantém a tela ligada enquanto o player está aberto.
    DisposableEffect(player) {
        val window = context.findActivity()?.window
        window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose {
            window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            // Salva a posição final somente se o player chegou a carregar e
            // avançou de verdade — salvar 0 apagava a retomada.
            val pos = player.currentPosition
            if (!isLiveStream(currentUrl) && pos > 5_000L) {
                runCatching { prefs.saveResumeStable(currentTitle, pos) }
            }
            player.release()
        }
    }

    // Ao sair do app (home, recentes, tela bloqueada) o vídeo para.
    DisposableEffect(lifecycleOwner, player) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                // Ao sair do app/homescreen, derruba playWhenReady: só pause()
                // deixava o ExoPlayer com intenção de tocar e o áudio continuava
                // em segundo plano (canais e filmes).
                Lifecycle.Event.ON_STOP, Lifecycle.Event.ON_PAUSE -> {
                    appInForeground = false
                    player.playWhenReady = false
                    player.pause()
                }
                Lifecycle.Event.ON_START -> appInForeground = true
                Lifecycle.Event.ON_RESUME -> {
                    appInForeground = true
                    if (!userPausedRef.value && player.playbackState != Player.STATE_IDLE) {
                        player.playWhenReady = true
                        player.play()
                    }
                }
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Atualiza a interface periodicamente (só quando o valor muda).
    LaunchedEffect(player) {
        while (true) {
            val playingNow = player.isPlaying
            if (playingNow != isPlaying) isPlaying = playingNow
            val pos = player.currentPosition.coerceAtLeast(0)
            if (pos != position) position = pos
            val dur = player.duration
            if (dur != duration) duration = dur
            delay(1000)
        }
    }

    // Salva a posição a cada 10 segundos (somente em filmes/episódios).
    LaunchedEffect(player) {
        while (true) {
            delay(10_000)
            if (player.isPlaying && !isLiveStream(currentUrl)) {
                val pos = player.currentPosition
                if (pos > 5_000L) runCatching { prefs.saveResumeStable(currentTitle, pos) }
            }
        }
    }

    // Canais ao vivo: se o relógio parar de andar (ex.: depois de ~30 s),
    // abrimos a URL novamente com um parâmetro novo para forçar uma conexão limpa.
    LaunchedEffect(player, current.url) {
        var lastPosition = -1L
        var stalled = 0
        while (true) {
            delay(10_000)
            val url = currentUrl
            if (!isLiveStream(url) || !player.isPlaying ||
                player.playbackState != Player.STATE_READY
            ) {
                lastPosition = -1L
                stalled = 0
                continue
            }
            val pos = player.currentPosition
            if (lastPosition >= 0 && pos <= lastPosition + 500L) stalled += 1 else stalled = 0
            lastPosition = pos
            if (stalled >= 2) {
                val separator = if (url.contains('?')) '&' else '?'
                player.playWhenReady = true
                player.setMediaItem(
                    ExoMediaItem.fromUri("$url${separator}reconnect=${System.currentTimeMillis()}")
                )
                player.prepare()
                stalled = 0
                lastPosition = -1L
            }
        }
    }

    // Esconde os controles sozinhos (só enquanto o vídeo está rodando).
    LaunchedEffect(controlsVisible, isPlaying) {
        if (controlsVisible && isPlaying) {
            delay(4500)
            controlsVisible = false
        }
    }

    // Série: quando um episódio termina, começa o próximo sozinho.
    DisposableEffect(player, autoAdvance) {
        val listener = object : Player.Listener {
            override fun onPlaybackStateChanged(playbackState: Int) {
                if (playbackState == Player.STATE_ENDED && autoAdvance && index < items.lastIndex) {
                    controlsVisible = true
                    index += 1
                }
            }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
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

    fun go(delta: Int) {
        val target = (index + delta).coerceIn(0, items.lastIndex)
        if (target != index) {
            controlsVisible = true
            index = target
        }
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

    fun openCast() {
        showCast = true
        controlsVisible = false
        castStatus = null
        castDevices = emptyList()
        castLoading = true
        castScope.launch {
            val found = Dlna.discover(context)
            castDevices = found
            castLoading = false
            if (found.isEmpty()) {
                castStatus = "Nenhuma TV encontrada. Confira se o celular e a TV estão na mesma Wi-Fi."
            }
        }
    }

    fun castTo(device: DlnaDevice) {
        val item = current
        castStatus = "Enviando para ${device.name}…"
        castScope.launch {
            Dlna.cast(device, item.url, item.title)
                .onSuccess {
                    castDevice = device
                    // O vídeo agora toca na TV: pausa o player local para não
                    // gastar duas conexões da lista.
                    player.pause()
                    showCast = false
                    castStatus = null
                    controlsVisible = true
                }
                .onFailure { error ->
                    castStatus = "Não foi possível: ${error.message ?: "erro de rede"}"
                }
        }
    }

    fun stopCast() {
        val device = castDevice ?: return
        castScope.launch {
            Dlna.stop(device)
            castDevice = null
            showCast = false
            controlsVisible = true
        }
    }

    // Foco raiz do player: permite usar o D-pad/controle remoto.
    val rootFocus = remember { FocusRequester() }
    val playFocus = remember { FocusRequester() }
    var rootSelfFocused by remember { mutableStateOf(true) }
    LaunchedEffect(controlsVisible) {
        delay(60)
        runCatching {
            // Controles visíveis: foco no play (D-pad navega os botões).
            // Controles escondidos: foco no vídeo (qualquer tecla reabre).
            if (controlsVisible) playFocus.requestFocus() else rootFocus.requestFocus()
        }
    }

    // Ao abrir a lista de TVs, leva o foco do controle para o primeiro item.
    LaunchedEffect(showCast, castLoading, castDevices.size) {
        if (!showCast) return@LaunchedEffect
        delay(150)
        runCatching {
            if (castDevices.isNotEmpty()) castFocus.requestFocus()
            else if (!castLoading) castRetryFocus.requestFocus()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
            .focusRequester(rootFocus)
            .onFocusChanged { rootSelfFocused = it.isFocused }
            .focusable()
            .onPreviewKeyEvent { event ->
                if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                when (event.key) {
                    // Botões de mídia do controle (play/pause e faixas).
                    Key.MediaPlayPause -> {
                        togglePlay()
                        controlsVisible = true
                        true
                    }

                    Key.MediaNext -> {
                        if (index < items.lastIndex) go(1)
                        true
                    }

                    Key.MediaPrevious -> {
                        if (index > 0) go(-1)
                        true
                    }

                    // ⏪ / ⏩ do controle: volta/avanza 10 s em vídeos com duração.
                    Key.MediaRewind, Key.MediaFastForward -> {
                        if (allowSeek && duration > 0 && !isLiveStream(currentUrl)) {
                            val step = if (event.key == Key.MediaFastForward) 10_000L else -10_000L
                            seekTo(player.currentPosition + step)
                        }
                        controlsVisible = true
                        true
                    }

                    Key.MediaStop -> {
                        onClose()
                        true
                    }

                    // Botão ☰ (Menu) do controle: mostra ou esconde os controles.
                    Key.Menu -> {
                        controlsVisible = !controlsVisible
                        true
                    }

                    // Esquerda/direita só mostram os controles (sem avanço/retorno).
                    Key.DirectionLeft, Key.DirectionRight -> {
                        if (!controlsVisible) {
                            controlsVisible = true
                            true
                        } else {
                            false
                        }
                    }

                    // Qualquer direção/OK mostra os controles.
                    Key.DirectionUp, Key.DirectionDown -> {
                        if (!controlsVisible) {
                            controlsVisible = true
                            true
                        } else {
                            false
                        }
                    }

                    Key.DirectionCenter, Key.Enter -> {
                        if (!controlsVisible) {
                            controlsVisible = true
                            true
                        } else if (rootSelfFocused) {
                            togglePlay()
                            true
                        } else {
                            false
                        }
                    }

                    else -> false
                }
            }
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
        // pointerInput (em vez de clickable) evita que a camada inteira entre
        // na navegação por D-pad e roube o foco dos botões.
        Box(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(Unit) {
                    detectTapGestures { toggleControls() }
                }
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
                        text = current.title,
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
                    if (showCastButton) {
                        TextButton(onClick = { openCast() }) {
                            Text(
                                text = if (castDevice != null) "📺 ON" else "📺 TV",
                                color = MaterialTheme.colorScheme.primary,
                                fontSize = 13.sp
                            )
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
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        val canPrev = index > 0
                        TextButton(onClick = { go(-1) }, enabled = canPrev) {
                            Text(
                                text = "⏮ Anterior",
                                color = if (canPrev) Color.White else Color.White.copy(alpha = 0.35f),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(Modifier.width(14.dp))
                        var playFocused by remember { mutableStateOf(false) }
                        Box(
                            modifier = Modifier
                                .size(62.dp)
                                .background(
                                    if (playFocused) Color.White.copy(alpha = 0.30f)
                                    else Color.White.copy(alpha = 0.16f),
                                    RoundedCornerShape(50)
                                )
                                .border(
                                    width = if (playFocused) 2.dp else 0.dp,
                                    color = if (playFocused) MaterialTheme.colorScheme.primary else Color.Transparent,
                                    shape = RoundedCornerShape(50)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            TextButton(
                                onClick = {
                                    togglePlay()
                                },
                                modifier = Modifier
                                    .fillMaxSize()
                                    .focusRequester(playFocus)
                                    .onFocusChanged { playFocused = it.isFocused }
                            ) {
                                Text(
                                    text = if (isPlaying) "❚❚" else "▶",
                                    color = Color.White,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                        Spacer(Modifier.width(14.dp))
                        val canNext = index < items.lastIndex
                        TextButton(onClick = { go(1) }, enabled = canNext) {
                            Text(
                                text = "Próximo ⏭",
                                color = if (canNext) Color.White else Color.White.copy(alpha = 0.35f),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    // Séries: atalho para pular os 40 s iniciais da abertura.
                    if (isSeries && duration > SKIP_OPENING_MS + 2_000L &&
                        position < SKIP_OPENING_MS
                    ) {
                        TextButton(onClick = { seekTo(SKIP_OPENING_MS) }) {
                            Text(
                                text = "⏭ Pular abertura (40s)",
                                color = MaterialTheme.colorScheme.primary,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                // Posição na fila (ex.: "Episódio 3 de 12").
                if (items.size > 1) {
                    Text(
                        text = "${index + 1} de ${items.size}",
                        color = Color.White.copy(alpha = 0.6f),
                        fontSize = 11.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 4.dp),
                        textAlign = TextAlign.Center
                    )
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
                        text = formatTime(if (scrubbing) scrubPosition else position),
                        color = Color.White,
                        fontSize = 12.sp
                    )
                    Spacer(Modifier.width(10.dp))
                    if (allowSeek && duration > 0 && !isLiveStream(current.url)) {
                        Slider(
                            value = (if (scrubbing) scrubPosition else position)
                                .coerceIn(0, duration).toFloat(),
                            onValueChange = { value ->
                                scrubbing = true
                                scrubPosition = value.toLong().coerceIn(0, duration)
                            },
                            onValueChangeFinished = {
                                val target = scrubPosition
                                scrubbing = false
                                seekTo(target)
                            },
                            valueRange = 0f..duration.toFloat(),
                            modifier = Modifier
                                .weight(1f)
                                // Arraste com o dedo/mouse ou ← → no D-pad; OK pausa/continua.
                                .onPreviewKeyEvent { event ->
                                    if (event.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                                    when (event.key) {
                                        Key.DirectionLeft -> {
                                            seekTo(player.currentPosition - 10_000L)
                                            true
                                        }

                                        Key.DirectionRight -> {
                                            seekTo(player.currentPosition + 10_000L)
                                            true
                                        }

                                        Key.DirectionCenter, Key.Enter -> {
                                            togglePlay()
                                            controlsVisible = true
                                            true
                                        }

                                        else -> false
                                    }
                                }
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

        // Falha de reprodução: sem isso o vídeo ficava preto e o botão ▶
        // parecia não funcionar. Agora há retry e uma saída explícita.
        if (playbackError != null && !showCast) {
            Column(
                modifier = Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Não foi possível reproduzir",
                    color = Color.White,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = playbackError ?: "",
                    color = Color.White.copy(alpha = 0.8f),
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center
                )
                Spacer(Modifier.height(18.dp))
                Row(horizontalArrangement = Arrangement.Center) {
                    TextButton(onClick = { retryCount = 0; reloadCurrent() }) {
                        Text("Tentar novamente", color = MaterialTheme.colorScheme.primary)
                    }
                    Spacer(Modifier.width(12.dp))
                    TextButton(onClick = onClose) {
                        Text("Voltar", color = Color.White)
                    }
                }
            }
        }

        // Escolha da TV (DLNA). Fica fora dos controles para continuar
        // visível mesmo com a barra escondida.
        if (showCast) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.86f)),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth(0.72f)
                        .background(Color(0xFF0E1A12), RoundedCornerShape(16.dp))
                        .padding(22.dp)
                ) {
                    Text(
                        text = "📺 Transmitir para a TV",
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "O celular e a TV precisam estar na mesma rede Wi-Fi.",
                        color = Color.White.copy(alpha = 0.6f),
                        fontSize = 12.sp
                    )
                    Spacer(Modifier.height(16.dp))

                    when {
                        castLoading -> Text(
                            text = "Procurando TVs…",
                            color = MaterialTheme.colorScheme.primary,
                            fontSize = 14.sp
                        )

                        castDevices.isEmpty() -> Text(
                            text = castStatus ?: "Nenhuma TV encontrada.",
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 13.sp
                        )

                        else -> {
                            castStatus?.let { status ->
                                Text(
                                    text = status,
                                    color = Color(0xFFFFB74D),
                                    fontSize = 12.sp
                                )
                                Spacer(Modifier.height(8.dp))
                            }
                            castDevices.forEachIndexed { i, device ->
                                TextButton(
                                    onClick = { castTo(device) },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .then(
                                            if (i == 0) Modifier.focusRequester(castFocus)
                                            else Modifier
                                        )
                                ) {
                                    Text(
                                        text = "▶  ${device.name}",
                                        color = Color.White,
                                        fontSize = 15.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                        }
                    }

                    if (castDevice != null) {
                        Spacer(Modifier.height(10.dp))
                        TextButton(onClick = { stopCast() }) {
                            Text(
                                text = "⏹ Parar TV (${castDevice?.name})",
                                color = Color(0xFFFF8A80),
                                fontSize = 13.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }

                    Spacer(Modifier.height(12.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TextButton(
                            onClick = { openCast() },
                            modifier = if (castDevices.isEmpty() && !castLoading) {
                                Modifier.focusRequester(castRetryFocus)
                            } else {
                                Modifier
                            }
                        ) {
                            Text(
                                text = "Procurar de novo",
                                color = MaterialTheme.colorScheme.primary,
                                fontSize = 13.sp
                            )
                        }
                        Spacer(Modifier.width(8.dp))
                        TextButton(onClick = { showCast = false; controlsVisible = true }) {
                            Text(
                                text = "Fechar",
                                color = Color.White.copy(alpha = 0.7f),
                                fontSize = 13.sp
                            )
                        }
                    }
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
