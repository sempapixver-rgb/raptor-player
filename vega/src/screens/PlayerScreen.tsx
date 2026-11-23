import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
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
import {Button} from '../components/ui';
import {formatTime} from '../core/format';
import {playUrl} from '../core/xtream';
import type {Entry, SourceConfig} from '../types';
import {colors, radius, space} from '../theme';

type Props = {
  source: SourceConfig;
  entry: Entry;
  list: Entry[];
  onClose: () => void;
  onSelect: (entry: Entry, list: Entry[]) => void;
};

type Status = 'loading' | 'playing' | 'paused' | 'ended' | 'error';

export function PlayerScreen({source, entry, list, onClose, onSelect}: Props) {
  const [surface, setSurface] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const player = useRef<VideoPlayer | null>(null);
  const appState = useKeplerAppStateManager();
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  const isLive = entry.kind === 'LIVE';
  const url = useMemo(() => playUrl(source, entry), [source, entry]);

  useEffect(() => {
    if (!surface || !url) {
      return;
    }
    let cancelled = false;
    setStatus('loading');
    setMessage('');
    setTime(0);
    setDuration(0);

    const video = new VideoPlayer();
    player.current = video;

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
          // Sem foco de midia o player continua funcionando normalmente.
        }
        video.setSurfaceHandle(surface);
        video.src = url;
        video.load();
        await video.play();
        if (!cancelled) {
          setStatus('playing');
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage('Nao foi possivel reproduzir este item.');
        }
      }
    };
    start();

    const timer = setInterval(() => {
      if (player.current !== video) {
        return;
      }
      const current = Number(video.currentTime) || 0;
      const total = Number(video.duration) || 0;
      setTime(current);
      if (isFinite(total) && total > 0) {
        setDuration(total);
      }
      const paused = Boolean((video as any).paused);
      setStatus(previous => {
        if (previous === 'loading' || previous === 'error' || previous === 'ended') {
          return previous;
        }
        return paused ? 'paused' : 'playing';
      });
    }, 500);

    const onEnded = () => setStatus('ended');
    try {
      (video as any).addEventListener('ended', onEnded);
    } catch {
      // Evento opcional.
    }

    return () => {
      cancelled = true;
      clearInterval(timer);
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
  }, [surface, url, reloadKey]);

  const toggle = useCallback(() => {
    const video = player.current;
    if (!video) {
      return;
    }
    try {
      if (status === 'ended') {
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
      if (!video || isLive) {
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
    },
    [isLive],
  );

  const index = list.findIndex(
    item => item.id === entry.id && item.kind === entry.kind,
  );
  const previous = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;

  const goPrevious = useCallback(() => {
    if (previous) {
      onSelect(previous, list);
    }
  }, [list, onSelect, previous]);

  const goNext = useCallback(() => {
    if (next) {
      onSelect(next, list);
    }
  }, [list, next, onSelect]);

  useEffect(() => {
    if (status !== 'ended' || !next) {
      return;
    }
    const timer = setTimeout(() => onSelect(next, list), 1500);
    return () => clearTimeout(timer);
  }, [status, next, list, onSelect]);

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

  const percent = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <View style={styles.root}>
      <KeplerVideoSurfaceView
        style={StyleSheet.absoluteFill}
        scalingmode="fit"
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
              onPress={() => setReloadKey(key => key + 1)}
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
            {isLive ? 'Ao vivo' : entry.category || 'Video'}
          </Text>
        </View>
      </View>

      <View style={styles.bottomBar}>
        {!isLive ? (
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
        ) : null}

        <View style={styles.controls}>
          <Button
            kind="primary"
            label={status === 'playing' ? 'Pausar' : 'Reproduzir'}
            hasTVPreferredFocus
            onPress={toggle}
          />
          {!isLive ? (
            <>
              <Button label="-10s" onPress={() => seek(-10)} />
              <Button label="+10s" onPress={() => seek(10)} />
            </>
          ) : null}
          <Button label="Anterior" onPress={goPrevious} />
          <Button label="Proximo" onPress={goNext} />
        </View>
      </View>
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
  },
  titles: {
    marginLeft: space.md,
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
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
  },
});
