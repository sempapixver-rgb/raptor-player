import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  useKeplerAppStateManager,
  useTVEventHandler,
} from '@amazon-devices/react-native-kepler';
import {
  KeplerMediaControlHandler,
  KeplerVideoSurfaceView,
  VideoPlayer,
} from '@amazon-devices/react-native-w3cmedia';
import {Button, Focusable} from '../components/ui';
import {DlnaSheet} from '../components/DlnaSheet';
import {addRecent} from '../core/favorites';
import {formatTime} from '../core/format';
import {readJSON, removeKey, writeJSON} from '../core/storage';
import {playUrl} from '../core/xtream';
import type {Entry, PlayHandler, SourceConfig} from '../types';
import {colors, radius, space} from '../theme';

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
type ScaleMode = 'fit' | 'fill' | 'strech' | 'none';
type Sheet = 'speed' | 'audio' | 'subs' | null;
type TrackOption = {id: string; label: string; active: boolean};

const SCALES: ScaleMode[] = ['fit', 'fill', 'strech'];
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function sameTracks(a: TrackOption[], b: TrackOption[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].id !== b[i].id ||
      a[i].label !== b[i].label ||
      a[i].active !== b[i].active
    ) {
      return false;
    }
  }
  return true;
}

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
  const [scaleMode, setScaleMode] = useState<ScaleMode>('fit');
  const [dlnaOpen, setDlnaOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [speed, setSpeed] = useState(1);
  const [audioTracks, setAudioTracks] = useState<TrackOption[]>([]);
  const [textTracks, setTextTracks] = useState<TrackOption[]>([]);

  const player = useRef<VideoPlayer | null>(null);
  const attemptRef = useRef(0);
  const resumeKey = allowSeek ? entry.kind + ':' + entry.id : null;
  const resumeTarget = useRef(0);
  const resumeApplied = useRef(true);
  const userSeeked = useRef(false);
  const ended = useRef(false);
  const lastSave = useRef(0);
  const watchdog = useRef({time: 0, at: Date.now()});

  const appState = useKeplerAppStateManager();
  const appStateRef = useRef(appState);
  appStateRef.current = appState;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const baseUrl = useMemo(() => playUrl(source, entry), [source, entry]);
  const url = useMemo(() => {
    if (!baseUrl || attempt <= 0) {
      return baseUrl;
    }
    return (
      baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'r=' + Date.now()
    );
  }, [baseUrl, attempt]);

  useEffect(() => {
    attemptRef.current = 0;
    setAttempt(0);
    userSeeked.current = false;
    ended.current = false;
  }, [entry.id, entry.kind]);

  useEffect(() => {
    let alive = true;
    const fallback: ScaleMode = entry.kind === 'LIVE' ? 'fit' : 'fill';
    readJSON<ScaleMode>('player.scale', fallback)
      .then(saved => {
        if (alive && SCALES.indexOf(saved) >= 0) {
          setScaleMode(saved);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [entry.kind]);

  useEffect(() => {
    let alive = true;
    readJSON<number>('player.speed', 1)
      .then(saved => {
        if (alive && SPEEDS.indexOf(saved) >= 0) {
          setSpeed(saved);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    void addRecent(entry);
  }, [entry]);

  useEffect(() => {
    if (!surface || !url) {
      if (!url) {
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
    ended.current = false;
    lastSave.current = 0;
    watchdog.current = {time: 0, at: Date.now()};

    const video = new VideoPlayer();
    player.current = video;

    const start = async () => {
      let target = 0;
      if (resumeKey) {
        const saved = await readJSON<number>('resume.' + resumeKey, 0);
        target = Number(saved) || 0;
      }
      if (cancelled) {
        return;
      }
      resumeTarget.current = target;
      resumeApplied.current = userSeeked.current || target <= 5;

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
        video.src = url;
        video.load();
        await video.play();
        try {
          video.playbackRate = speedRef.current;
        } catch {
          // Velocidade nao suportada por este stream.
        }
        if (!cancelled) {
          setStatus('playing');
        }
      } catch {
        if (cancelled) {
          return;
        }
        if (attemptRef.current < 3) {
          attemptRef.current += 1;
          setAttempt(attemptRef.current);
          return;
        }
        setStatus('error');
        setMessage('Nao foi possivel reproduzir este item.');
      }
    };
    start();

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

      try {
        if (video.playbackRate !== speedRef.current) {
          video.playbackRate = speedRef.current;
        }
        const audioList = video.audioTracks as any;
        const audio: TrackOption[] = [];
        for (let i = 0; i < Number(audioList?.length || 0); i += 1) {
          const track = audioList[i];
          if (track) {
            audio.push({
              id: String(track.id ?? i),
              label: String(track.label || track.language || 'Faixa ' + (i + 1)),
              active: Boolean(track.enabled),
            });
          }
        }
        const textList = video.textTracks as any;
        const text: TrackOption[] = [];
        for (let i = 0; i < Number(textList?.length || 0); i += 1) {
          const track = textList[i];
          if (track) {
            text.push({
              id: String(track.id ?? i),
              label: String(track.label || track.language || 'Legenda ' + (i + 1)),
              active: track.mode === 'showing',
            });
          }
        }
        setAudioTracks(previous =>
          sameTracks(previous, audio) ? previous : audio,
        );
        setTextTracks(previous => (sameTracks(previous, text) ? previous : text));
      } catch {
        // Faixas indisponiveis neste stream.
      }

      if (
        total > 0 &&
        resumeTarget.current > 5 &&
        !resumeApplied.current
      ) {
        const target = resumeTarget.current;
        if (target < total - 2) {
          try {
            video.currentTime = target;
            setTime(target);
          } catch {
            // Player ainda nao aceita seek.
          }
        }
        resumeApplied.current = true;
      }

      if (resumeKey && current > 5 && Math.abs(current - lastSave.current) >= 10) {
        lastSave.current = current;
        void writeJSON('resume.' + resumeKey, current);
      }

      const paused = Boolean((video as any).paused);
      const now = Date.now();
      if (!paused && total > 0 && current > 0) {
        if (Math.abs(current - watchdog.current.time) < 0.2) {
          if (now - watchdog.current.at > 10000 && attemptRef.current < 3) {
            attemptRef.current += 1;
            setAttempt(attemptRef.current);
          }
        } else {
          watchdog.current = {time: current, at: now};
        }
      } else if (current > 0) {
        watchdog.current = {time: current, at: now};
      }

      setStatus(previous => {
        if (previous === 'loading' || previous === 'error' || previous === 'ended') {
          return previous;
        }
        return paused ? 'paused' : 'playing';
      });
    }, 500);

    const onEnded = () => {
      ended.current = true;
      setStatus('ended');
      if (resumeKey) {
        void removeKey('resume.' + resumeKey);
      }
    };
    try {
      (video as any).addEventListener('ended', onEnded);
    } catch {
      // Evento opcional.
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
      const current = Number(video.currentTime) || 0;
      if (resumeKey && !ended.current && current > 5) {
        void writeJSON('resume.' + resumeKey, current);
      }
      try {
        (video as any).removeEventListener('ended', onEnded);
      } catch {
        // Evento opcional.
      }
      if (player.current === video) {
        player.current = null;
      }
      try {
        Promise.resolve(video.deinitialize()).catch(() => undefined);
      } catch {
        // Player ja liberado.
      }
    };
  }, [surface, url, resumeKey]);

  const toggle = useCallback(() => {
    const video = player.current;
    if (!video) {
      return;
    }
    try {
      if (status === 'ended') {
        ended.current = false;
        video.currentTime = 0;
        video.play().then(() => setStatus('playing')).catch(() => undefined);
        return;
      }
      if (status === 'playing') {
        video.pause();
        setStatus('paused');
        return;
      }
      video.play().then(() => setStatus('playing')).catch(() => undefined);
    } catch {
      setStatus('error');
      setMessage('Nao foi possivel controlar a reproducao.');
    }
  }, [status]);

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
        userSeeked.current = true;
        resumeApplied.current = true;
        if (resumeKey) {
          void writeJSON('resume.' + resumeKey, next);
        }
      } catch {
        // Fluxo sem seek.
      }
    },
    [allowSeek, resumeKey],
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

  const goPrevious = useCallback(() => {
    if (previous) {
      goTo(previous, safeIndex - 1);
    }
  }, [goTo, previous, safeIndex]);

  const goNext = useCallback(() => {
    if (next) {
      goTo(next, safeIndex + 1);
    }
  }, [goTo, next, safeIndex]);

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
    }
  });

  const cycleScale = useCallback(() => {
    const current = SCALES.indexOf(scaleMode);
    const chosen = SCALES[(current + 1) % SCALES.length];
    setScaleMode(chosen);
    void writeJSON('player.scale', chosen);
  }, [scaleMode]);

  const chooseSpeed = useCallback((value: number) => {
    setSpeed(value);
    speedRef.current = value;
    const video = player.current;
    if (video) {
      try {
        video.playbackRate = value;
      } catch {
        // Stream nao aceita mudanca de velocidade.
      }
    }
    void writeJSON('player.speed', value);
    setSheet(null);
  }, []);

  const chooseAudio = useCallback((id: string | null) => {
    const video = player.current;
    const list = video?.audioTracks as any;
    if (!video || !list) {
      return;
    }
    try {
      for (let i = 0; i < Number(list.length || 0); i += 1) {
        const track = list[i];
        if (track) {
          track.enabled = (id === null ? 0 : i) === Number(id);
        }
      }
    } catch {
      // Faixas nao alteraveis.
    }
    setSheet(null);
  }, []);

  const chooseSubs = useCallback((id: string | null) => {
    const video = player.current;
    const list = video?.textTracks as any;
    if (!video || !list) {
      return;
    }
    try {
      for (let i = 0; i < Number(list.length || 0); i += 1) {
        const track = list[i];
        if (track) {
          track.mode = id !== null && i === Number(id) ? 'showing' : 'disabled';
        }
      }
    } catch {
      // Legendas nao alteraveis.
    }
    setSheet(null);
  }, []);

  const percent = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <View style={styles.root}>
      <KeplerVideoSurfaceView
        style={StyleSheet.absoluteFill}
        scalingmode={scaleMode}
        onSurfaceViewCreated={setSurface}
      />

      {status === 'loading' ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.overlayText}>Abrindo o video...</Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <View style={styles.overlay}>
          <Text style={styles.errorTitle}>Falha na reproducao</Text>
          <Text style={styles.overlayText}>{message}</Text>
          <View style={styles.errorActions}>
            <Button
              kind="primary"
              label="Tentar de novo"
              hasTVPreferredFocus
              onPress={() => {
                attemptRef.current = 0;
                setAttempt(0);
              }}
            />
            <Button label="Voltar" onPress={onClose} />
          </View>
        </View>
      ) : null}

      <View style={styles.topBar}>
        <Button label="Voltar" onPress={onClose} />
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {allowSeek ? entry.category || 'Video' : 'Ao vivo'}
          </Text>
        </View>
        <Button label="Ajustar" onPress={cycleScale} />
        <Button label="📺 TV" onPress={() => setDlnaOpen(true)} />
      </View>

      <View style={styles.bottomBar}>
        {allowSeek ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, {width: (percent + '%') as any}]}
              />
            </View>
            <View style={styles.times}>
              <Text style={styles.timeText}>{formatTime(time)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.liveText}>AO VIVO</Text>
        )}

        <View style={styles.controls}>
          <Button
            kind="primary"
            label={status === 'playing' ? 'Pausar' : 'Reproduzir'}
            hasTVPreferredFocus
            onPress={toggle}
          />
          {allowSeek ? (
            <>
              <Button label="-10s" onPress={() => seek(-10)} />
              <Button label="+10s" onPress={() => seek(10)} />
              {entry.kind === 'SERIES' ? (
                <Button label="Pular abertura" onPress={() => seek(40)} />
              ) : null}
            </>
          ) : null}
          <Button label="Anterior" onPress={goPrevious} />
          <Button label="Proximo" onPress={goNext} />
        </View>

        <View style={styles.controls}>
          <Button label={'Velocidade ' + speed + 'x'} onPress={() => setSheet('speed')} />
          <Button label={'Audio' + (audioTracks.length ? ' (' + audioTracks.length + ')' : '')} onPress={() => setSheet('audio')} />
          <Button label={'Legendas' + (textTracks.length ? ' (' + textTracks.length + ')' : '')} onPress={() => setSheet('subs')} />
        </View>
      </View>

      {sheet ? (
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>
                {sheet === 'speed'
                  ? 'Velocidade'
                  : sheet === 'audio'
                    ? 'Faixa de audio'
                    : 'Legendas'}
              </Text>
              <Button label="Fechar" onPress={() => setSheet(null)} />
            </View>
            <FlatList
              data={
                sheet === 'speed'
                  ? SPEEDS.map(value => ({
                      id: String(value),
                      label: value + 'x',
                      active: value === speed,
                    }))
                  : sheet === 'audio'
                    ? audioTracks
                    : textTracks
              }
              keyExtractor={item => item.id}
              style={styles.sheetList}
              ListEmptyComponent={
                <Text style={styles.sheetHint}>Nenhuma opcao neste video.</Text>
              }
              renderItem={({item}) => (
                <Focusable
                  accessibilityLabel={item.label}
                  onPress={() => {
                    if (sheet === 'speed') {
                      chooseSpeed(Number(item.id));
                    } else if (sheet === 'audio') {
                      chooseAudio(item.id);
                    } else {
                      chooseSubs(item.id);
                    }
                  }}
                  style={[styles.sheetRow, item.active ? styles.sheetRowActive : null]}
                  focusedStyle={styles.sheetRowFocused}>
                  <Text style={styles.sheetRowText}>
                    {item.active ? '✓ ' : ''}
                    {item.label}
                  </Text>
                </Focusable>
              )}
            />
            {sheet === 'audio' || sheet === 'subs' ? (
              <Button
                label="Padrao"
                onPress={() => {
                  if (sheet === 'audio') {
                    chooseAudio(null);
                  } else {
                    chooseSubs(null);
                  }
                }}
              />
            ) : null}
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
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    zIndex: 2,
  },
  overlayText: {
    color: colors.textSoft,
    fontSize: 14,
    marginTop: space.sm,
    textAlign: 'center',
    maxWidth: 520,
  },
  errorTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  errorActions: {
    flexDirection: 'row',
    marginTop: space.lg,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: 'rgba(7,11,18,0.78)',
    zIndex: 3,
  },
  titles: {
    marginLeft: space.md,
    marginRight: space.md,
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: 'rgba(7,11,18,0.82)',
    zIndex: 3,
  },
  progressWrap: {
    marginBottom: space.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    color: colors.textDim,
    fontSize: 11,
  },
  liveText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: space.sm,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    marginTop: space.xs,
  },
  sheetWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 4,
  },
  sheet: {
    width: 620,
    maxHeight: '70%',
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(7,11,18,0.98)',
    borderWidth: 1,
    borderColor: colors.line,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  sheetList: {
    flexGrow: 0,
    maxHeight: 380,
  },
  sheetHint: {
    color: colors.textDim,
    fontSize: 13,
    paddingVertical: space.md,
  },
  sheetRow: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    marginBottom: 4,
    backgroundColor: colors.panel,
  },
  sheetRowActive: {
    backgroundColor: colors.accentSoft,
  },
  sheetRowFocused: {
    backgroundColor: colors.panelSoft,
    borderWidth: 2,
    borderColor: colors.focusRing,
  },
  sheetRowText: {
    color: colors.text,
    fontSize: 15,
  },
});
