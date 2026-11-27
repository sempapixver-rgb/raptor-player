import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {useKeplerBackHandler} from '@amazon-devices/react-native-kepler';
import {Loading} from './components/ui';
import {TERMS_VERSION} from './config/app';
import {deviceCode as readDeviceCode} from './core/device';
import {clearSource, loadSource, saveSource} from './core/sourceStore';
import {readJSON, writeJSON} from './core/storage';
import {ActivationScreen} from './screens/ActivationScreen';
import {HomeScreen} from './screens/HomeScreen';
import {PlayerScreen} from './screens/PlayerScreen';
import {SectionScreen} from './screens/SectionScreen';
import {SettingsScreen} from './screens/SettingsScreen';
import {TermsScreen} from './screens/TermsScreen';
import type {Entry, Kind, PlayHandler, SourceConfig} from './types';
import {colors} from './theme';

type Route =
  | {name: 'boot'}
  | {name: 'terms'}
  | {name: 'activation'}
  | {name: 'home'}
  | {name: 'section'; kind: Kind}
  | {name: 'settings'};

type PlayerState = {
  entry: Entry;
  list: Entry[];
  index: number;
  autoAdvance: boolean;
  allowSeek: boolean;
};

const DEMO: SourceConfig = {mode: 'DEMO', label: 'Demonstracao'};

export function App() {
  const [route, setRoute] = useState<Route>({name: 'boot'});
  const [source, setSource] = useState<SourceConfig | null>(null);
  const [code, setCode] = useState('');
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const sectionBack = useRef<(() => boolean) | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const device = await readDeviceCode();
      const stored = await loadSource();
      const terms = await readJSON<{version?: number}>('terms', {});
      if (!alive) {
        return;
      }
      setCode(device);
      setSource(stored);
      if (!terms || terms.version !== TERMS_VERSION) {
        setRoute({name: 'terms'});
      } else {
        setRoute(stored ? {name: 'home'} : {name: 'activation'});
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const acceptTerms = useCallback(async () => {
    await writeJSON('terms', {version: TERMS_VERSION, at: Date.now()});
    setRoute(source ? {name: 'home'} : {name: 'activation'});
  }, [source]);

  const onActivated = useCallback(async (next: SourceConfig) => {
    await saveSource(next);
    setSource(next);
    setPlayer(null);
    setRoute({name: 'home'});
  }, []);

  const onDemo = useCallback(async () => {
    await saveSource(DEMO);
    setSource(DEMO);
    setPlayer(null);
    setRoute({name: 'home'});
  }, []);

  const onChangeActivation = useCallback(async () => {
    await clearSource();
    setSource(null);
    setPlayer(null);
    setRoute({name: 'activation'});
  }, []);

  const openSection = useCallback((kind: Kind) => {
    setPlayer(null);
    setRoute({name: 'section', kind});
  }, []);

  // O player fica por cima da casca: a aba, a pasta, a busca e a rolagem
  // continuam exatamente onde estavam, como no Fire OS.
  const play = useCallback<PlayHandler>((entry, list, options = {}) => {
    const queue: Entry[] = options.list ?? list;
    const found = queue.findIndex(
      item => item.id === entry.id && item.kind === entry.kind,
    );
    const index = options.index ?? (found >= 0 ? found : 0);
    setPlayer({
      entry,
      list: queue,
      index,
      autoAdvance: options.autoAdvance ?? false,
      allowSeek: options.allowSeek ?? entry.kind !== 'LIVE',
    });
  }, []);

  const closePlayer = useCallback(() => {
    setPlayer(null);
  }, []);

  const back = useKeplerBackHandler();

  useEffect(() => {
    const subscription = back.addEventListener('hardwareBackPress', () => {
      if (player) {
        closePlayer();
        return true;
      }
      if (route.name === 'section') {
        if (sectionBack.current && sectionBack.current()) {
          return true;
        }
        setRoute({name: 'home'});
        return true;
      }
      if (route.name === 'settings') {
        setRoute({name: 'home'});
        return true;
      }
      if (route.name === 'home' || route.name === 'activation') {
        back.exitApp();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [back, closePlayer, player, route]);

  let screen: React.ReactNode;

  if (route.name === 'boot') {
    screen = <Loading label="Iniciando o player..." />;
  } else if (route.name === 'terms') {
    screen = <TermsScreen onAccept={acceptTerms} />;
  } else if (!source || route.name === 'activation') {
    screen = (
      <ActivationScreen
        deviceCode={code}
        onActivated={onActivated}
        onDemo={onDemo}
      />
    );
  } else if (route.name === 'home') {
    screen = (
      <HomeScreen
        source={source}
        deviceCode={code}
        onOpen={openSection}
        onSettings={() => setRoute({name: 'settings'})}
      />
    );
  } else if (route.name === 'section') {
    screen = (
      <SectionScreen
        key={route.kind}
        source={source}
        kind={route.kind}
        onExit={() => setRoute({name: 'home'})}
        onPlay={play}
        backRef={sectionBack}
      />
    );
  } else {
    screen = (
      <SettingsScreen
        source={source}
        deviceCode={code}
        onDemo={onDemo}
        onChangeActivation={onChangeActivation}
        onExit={() => setRoute({name: 'home'})}
      />
    );
  }

  return (
    <View style={styles.root}>
      {screen}
      {player ? (
        <View style={styles.playerOverlay}>
          <PlayerScreen
            source={source!}
            entry={player.entry}
            list={player.list}
            index={player.index}
            autoAdvance={player.autoAdvance}
            allowSeek={player.allowSeek}
            onClose={closePlayer}
            onSelect={play}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  playerOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
  },
});
