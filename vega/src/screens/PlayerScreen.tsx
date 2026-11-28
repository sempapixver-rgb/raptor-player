import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {
  useKeplerAppStateManager,
  useTVEventHandler,
} from '@amazon-devices/react-native-kepler';
import {
  KeplerMediaControlHandler,
  KeplerVideoSurfaceView,
  VideoPlayer,
} from '@amazon-devices/react-native-w3cmedia';
import {Button} from '../components/ui';
import {DlnaSheet} from '../components/DlnaSheet';
import {formatTime, normalizeText} from '../core/format';
import {freshUrl, resolveRedirect} from '../core/media';
import {readJSON, writeJSON} from '../core/storage';
import {playUrl} from '../core/xtream';
import type {Entry, PlayHandler, SourceConfig} from '../types';
import {colors, f, s} from '../theme';

type Props = {
  source: SourceConfig;
  entry: Entry;
  list: Entry[];
  index: number;
  autoAdvance: boolean;
  allowSeek: boolean;
  onClose: () => void;
  onSelect: PlayHandler;
};

type Status = 'loading' | 'playing' | 'paused' | 'ended' | 'error';

/** Enquadramento automatico (fit), o mesmo do app Android que funciona. */
const SCALE_MODE = 'fit';
const MAX_RETRIES = 3;
const MAX_AUTOPLAY_TRIES = 8;

export function PlayerScreen({
  source,
  entry,
  list,
  index,
  autoAdvance,
  allowSeek,
  onClose,
  onSelect,
}: Props) {
  const [surface, setSurface] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [reload, setReload] = useState(0);
  const [overlay, setOverlay] = useState(true);
  const [dlnaOpen, setDlnaOpen] = useState(false);

  const player = useRef<VideoPlayer | null>(null);
  const attemptRef = useRef(0);
  const userPaused = useRef(false);
  const wantPlay = useRef(true);
  const started = useRef(false);
  const dataReady = useRef(false);
  const noDataSince = useRef(Date.now());
  const retryScheduled = useRef(false);
  const endedRef = useRef(false);
  const readyRetries = useRef(0);
  const watchdog = useRef({time: -1, at: Date.now()});
  const resumeTarget = useRef(0);
  const resumeApplied = useRef(false);
  const saveTick = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appState = useKeplerAppStateManager();
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  const baseUrl = useMemo(() => playUrl(source, entry), [source, entry]);
  // canais nunca recebem seek; isso tambem define o watchdog de ao vivo.
  const isLive = !allowSeek || entry.kind === 'LIVE';
  const resumeKey = useMemo(
    () => 'resume.stable.' + normalizeText(entry.name),
    [entry.name],
  );
  // A retomada usa o titulo, nunca a URL (que muda a cada sessao Xtream).
  const url = useMemo(
    () => (baseUrl && attempt > 0 ? freshUrl(baseUrl) : baseUrl),
    [attempt, baseUrl],
  );

  useEffect(() => {
    attemptRef.current = 0;
    setAttempt(0);
    userPaused.current = false;
    wantPlay.current = true;
    endedRef.current = false;
  }, [entry.id, entry.kind]);

  useEffect(() => {
    if (!surface || !url) {
      if (surface && !url) {
        setStatus('error');
        setMessage('Este item nao tem uma URL reproduzivel.');
      }
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setMessage('');
    setTime(0);
    setDuration(0);
    started.current = false;
    dataReady.current = false;
    noDataSince.current = Date.now();
    retryScheduled.current = false;
    endedRef.current = false;
    readyRetries.current = 0;
    saveTick.current = 0;
    watchdog.current = {time: -1, at: Date.now()};
    resumeApplied.current = false;
    resumeTarget.current = 0;
    if (!isLive) {
      void readJSON<number>(resumeKey, 0)
        .then(value => {
          if (!cancelled) {
            resumeTarget.current = Number(value) || 0;
          }
        })
        .catch(() => undefined);
    }

    const video = new VideoPlayer();
    player.current = video;

    /** Insiste no play quando o primeiro comando e recusado pelo aparelho. */
    const playIt = async () => {
      if (cancelled || !wantPlay.current || player.current !== video) {
        return;
      }
      try {
        await video.play();
        if (!cancelled) {
          started.current = true;
          setStatus('playing');
        }
      } catch {
        readyRetries.current += 1;
        if (readyRetries.current > MAX_AUTOPLAY_TRIES) {
          return;
        }
        setTimeout(() => {
          if (!cancelled) {
            void playIt();
          }
        }, 500 + readyRetries.current * 300);
      }
    };

    /** Nova conexao ate 3 vezes; um unico erro por ciclo evita gastar todas. */
    const fail = (text: string) => {
      if (cancelled || retryScheduled.current) {
        return;
      }
      if (attemptRef.current < MAX_RETRIES) {
        retryScheduled.current = true;
        attemptRef.current += 1;
        setAttempt(attemptRef.current);
        return;
      }
      setStatus('error');
      setMessage(text);
    };

    const onReady = () => {
      if (cancelled) {
        return;
      }
      dataReady.current = true;
      started.current = true;
      setStatus('playing');
    };
    const onPlaying = () => {
      if (!cancelled) {
        dataReady.current = true;
        started.current = true;
        setStatus('playing');
      }
    };
    const onError = () => fail('Nao foi possivel reproduzir este item.');
    const onEnded = () => {
      if (!cancelled) {
        endedRef.current = true;
        setStatus('ended');
      }
    };

    video.addEventListener('canplay', onReady);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);
    video.addEventListener('ended', onEnded);

    /** Inicia sem esperar storage e resolve 302 entre http e https. */
    const start = async () => {
      try {
        await video.initialize();
        if (cancelled) {
          return;
        }
        try {
          await video.setMediaControlFocus(
            appStateRef.current.getComponentInstance(),
            new KeplerMediaControlHandler(),
          );
        } catch {
          // Sem foco de midia o player continua funcionando.
        }
        video.setSurfaceHandle(surface);
        const finalUrl = await resolveRedirect(url);
        if (cancelled) {
          return;
        }
        video.src = finalUrl;
        video.load();
        await video.play();
        if (!cancelled) {
          started.current = true;
          setStatus('playing');
        }
      } catch {
        fail('Nao foi possivel reproduzir este item.');
      }
    };
    void start();

    const timer = setInterval(() => {
      if (cancelled || player.current !== video) {
        return;
      }
      const current = Number(video.currentTime) || 0;
      const total = Number(video.duration) || 0;
      setTime(current);
      if (isFinite(total) && total > 0) {
        setDuration(total);
      }

      // Retomada so com duracao conhecida; seekTo antes do prepare e ignorado.
      const target = resumeTarget.current;
      if (
        !resumeApplied.current &&
        target > 5 &&
        total > 0 &&
        target < total - 2
      ) {
        try {
          video.currentTime = target;
          setTime(target);
        } catch {
          // Fluxo sem seek.
        }
        resumeApplied.current = true;
      }

      // Autoplay: se ficou pronto mas parou, insiste como a LG/Android fazem.
      if (!video.paused && started.current && userPaused.current === false) {
        readyRetries.current = 0;
      } else if (video.paused && wantPlay.current && !userPaused.current) {
        readyRetries.current += 1;
        if (readyRetries.current <= MAX_AUTOPLAY_TRIES) {
          void playIt();
        }
      }

      // Watchdog: canal ao vivo e VOD podem travar sem dispensar erro.
      const now = Date.now();
      // Nenhum dado apos 12 s tambem e travamento (buffer que nunca começa).
      if (!dataReady.current && now - noDataSince.current > 12000) {
        fail('Servidor nao enviou o video. Reconectando...');
        noDataSince.current = now;
      }
      if (current > 0 && !video.paused) {
        const previous = watchdog.current.time;
        if (previous >= 0 && Math.abs(current - previous) < 0.2) {
          if (now - watchdog.current.at > 10000) {
            fail(
              isLive
                ? 'Canal parado. Reconectando...'
                : 'Video parado. Reconectando...',
            );
            watchdog.current = {time: -1, at: now};
          }
        } else {
          watchdog.current = {time: current, at: now};
        }
      } else if (current > 0) {
        watchdog.current = {time: current, at: now};
      }

      // Salva a posicao a cada 10 s (nunca em canal ao vivo).
      saveTick.current += 1;
      if (saveTick.current >= 20) {
        saveTick.current = 0;
        if (!isLive && current > 5) {
          void writeJSON(resumeKey, current).catch(() => undefined);
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      const last = Number(video.currentTime) || 0;
      if (!isLive && last > 5) {
        void writeJSON(resumeKey, last).catch(() => undefined);
      }
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
      video.removeEventListener('ended', onEnded);
      if (player.current === video) {
        player.current = null;
      }
      try {
        Promise.resolve(video.deinitialize()).catch(() => undefined);
      } catch {
        // Player ja liberado.
      }
    };
  }, [isLive, reload, resumeKey, surface, url]);

  const showOverlay = useCallback(() => {
    setOverlay(true);
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  /** Controles some sozinhos enquanto o video esta rolando. */
  useEffect(() => {
    if (!overlay || status !== 'playing') {
      return;
    }
    const timer = setTimeout(() => setOverlay(false), 4500);
    return () => clearTimeout(timer);
  }, [overlay, status]);

  const toggle = useCallback(() => {
    const video = player.current;
    if (!video) {
      return;
    }
    try {
      showOverlay();
      if (status === 'ended') {
        endedRef.current = false;
        video.currentTime = 0;
        wantPlay.current = true;
        userPaused.current = false;
        void video.play().then(() => setStatus('playing'));
        return;
      }
      if (status === 'playing') {
        userPaused.current = true;
        wantPlay.current = false;
        video.pause();
        setStatus('paused');
        return;
      }
      userPaused.current = false;
      wantPlay.current = true;
      void video.play().then(() => setStatus('playing'));
    } catch {
      setStatus('error');
      setMessage('Nao foi possivel controlar a reproducao.');
    }
  }, [showOverlay, status]);

  const seek = useCallback(
    (delta: number) => {
      const video = player.current;
      if (!video || !allowSeek) {
        return;
      }
      const current = Number(video.currentTime) || 0;
      const total = Number(video.duration) || 0;
      let next = current + delta;
      if (next < 0) {
        next = 0;
      }
      if (total > 0 && next > total - 1) {
        next = total - 1;
      }
      try {
        video.currentTime = next;
        setTime(next);
      } catch {
        // Fluxo sem seek.
      }
      showOverlay();
    },
    [allowSeek, showOverlay],
  );

  const safeIndex = Math.max(0, Math.min(index, Math.max(0, list.length - 1)));
  const previous = safeIndex > 0 ? list[safeIndex - 1] : null;
  const next =
    list.length > 0 && safeIndex < list.length - 1
      ? list[safeIndex + 1]
      : null;

  const goTo = useCallback(
    (item: Entry, targetIndex: number) => {
      onSelect(item, list, {
        list,
        index: targetIndex,
        autoAdvance,
        allowSeek,
      });
    },
    [allowSeek, autoAdvance, list, onSelect],
  );

  useEffect(() => {
    if (status !== 'ended' || !autoAdvance || !next) {
      return;
    }
    const timer = setTimeout(() => goTo(next, safeIndex + 1), 1500);
    return () => clearTimeout(timer);
  }, [autoAdvance, goTo, next, safeIndex, status]);

  useTVEventHandler((event: any) => {
    const type = event && event.eventType;
    if (type === 'playPause') {
      toggle();
    } else if (type === 'rewind') {
      seek(-10);
    } else if (type === 'fastForward') {
      seek(10);
    } else {
      showOverlay();
    }
  });

  const percent = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <View style={styles.root}>
      <KeplerVideoSurfaceView
        style={StyleSheet.absoluteFill}
        scalingmode={SCALE_MODE}
        onSurfaceViewCreated={setSurface}
      />

      {status === 'loading' ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.error}>
          <Text style={styles.errorTitle}>Nao foi possivel abrir este video</Text>
          <Text style={styles.loadingText}>{message}</Text>
          <View style={styles.errorActions}>
            <Button
              kind="primary"
              label="Tentar de novo"
              hasTVPreferredFocus
              onPress={() => {
                attemptRef.current = 0;
                setAttempt(0);
                setReload(value => value + 1);
              }}
            />
            <Button label="Voltar" onPress={onClose} />
          </View>
        </View>
      ) : null}

      {overlay && status !== 'error' ? (
        <View style={styles.overlay}>
          <View style={styles.playerTop}>
            <Text style={styles.playerTitle} numberOfLines={1}>
              {entry.name}
            </Text>
            <Text style={styles.playerBadge}>
              {isLive ? 'AO VIVO' : 'VIDEO'}
            </Text>
          </View>

          <View style={styles.playerCenter}>
            <Button
              label={status === 'playing' ? '❚❚' : '▶'}
              onPress={toggle}
              style={styles.pbtnBig}
            />
          </View>

          <View style={styles.playerBottom}>
            <View style={styles.playerNav}>
              {previous ? (
                <Button
                  label="◀ Anterior"
                  onPress={() => goTo(previous, safeIndex - 1)}
                  style={styles.pbtnNav}
                />
              ) : null}
              {next ? (
                <Button
                  label="Proximo ▶"
                  onPress={() => goTo(next, safeIndex + 1)}
                  style={styles.pbtnNav}
                />
              ) : null}
            </View>

            {allowSeek ? (
              <View style={styles.progress}>
                <View style={styles.bar}>
                  <View style={[styles.fill, {width: (percent + '%') as any}]} />
                </View>
                <View style={styles.times}>
                  <Text style={styles.time}>{formatTime(time)}</Text>
                  <Text style={styles.time}>{formatTime(duration)}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.playerControls}>
              <Button label="Voltar" onPress={onClose} />
              {allowSeek ? (
                <>
                  <Button label="-10s" onPress={() => seek(-10)} />
                  <Button label="+10s" onPress={() => seek(10)} />
                </>
              ) : null}
              <Button label="📺 TV" onPress={() => setDlnaOpen(true)} />
            </View>
          </View>
        </View>
      ) : null}

      <DlnaSheet
        visible={dlnaOpen}
        source={source}
        entry={entry}
        onClose={() => setDlnaOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#000000'},
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 2,
  },
  loadingText: {
    color: colors.textSoft,
    fontSize: f(20),
    marginTop: s(14),
  },
  error: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    zIndex: 4,
    paddingHorizontal: s(120),
  },
  errorTitle: {color: colors.text, fontSize: f(32), fontWeight: '700'},
  errorActions: {flexDirection: 'row', marginTop: s(40)},
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: s(44),
    paddingBottom: s(44),
    paddingHorizontal: s(64),
    zIndex: 3,
  },
  playerTop: {flexDirection: 'row', alignItems: 'flex-start'},
  playerTitle: {
    color: colors.text,
    fontSize: f(34),
    fontWeight: '700',
    marginRight: s(22),
    flex: 1,
  },
  playerBadge: {
    color: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    fontSize: f(13),
    fontWeight: '800',
    letterSpacing: s(2),
    paddingHorizontal: s(12),
    paddingVertical: s(5),
    borderRadius: 999,
  },
  playerCenter: {alignItems: 'center', justifyContent: 'center'},
  playerBottom: {flexDirection: 'column'},
  playerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s(22),
  },
  pbtnBig: {
    width: s(104),
    height: s(104),
    borderRadius: s(52),
    paddingHorizontal: 0,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  pbtnNav: {
    height: s(74),
    borderRadius: 999,
    paddingHorizontal: s(40),
    marginHorizontal: s(14),
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  progress: {marginBottom: s(12), padding: s(10)},
  bar: {height: s(8), borderRadius: s(4), backgroundColor: 'rgba(255,255,255,0.2)'},
  fill: {height: s(8), borderRadius: s(4), backgroundColor: colors.accent},
  times: {flexDirection: 'row', justifyContent: 'space-between', marginTop: s(7)},
  time: {color: colors.textSoft, fontSize: f(16)},
  playerControls: {flexDirection: 'row', marginTop: s(12)},
});
