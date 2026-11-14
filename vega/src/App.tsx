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
import type {Entry, Kind, SourceConfig} from './types';
import {colors} from './theme';

type Route =
  | {name: 'boot'}
  | {name: 'terms'}
  | {name: 'activation'}
  | {name: 'home'}
  | {name: 'section'; kind: Kind}
  | {name: 'settings'}
  | {name: 'player'; entry: Entry; list: Entry[]};

const DEMO: SourceConfig = {mode: 'DEMO', label: 'Demonstracao'};

export function App() {
  const [route, setRoute] = useState<Route>({name: 'boot'});
  const [source, setSource] = useState<SourceConfig | null>(null);
  const [code, setCode] = useState('');
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
    setRoute({name: 'home'});
  }, []);

  const onDemo = useCallback(async () => {
    await saveSource(DEMO);
    setSource(DEMO);
    setRoute({name: 'home'});
  }, []);

  const onChangeActivation = useCallback(async () => {
    await clearSource();
    setSource(null);
    setRoute({name: 'activation'});
  }, []);

  const openSection = useCallback((kind: Kind) => {
    setRoute({name: 'section', kind});
  }, []);

  const play = useCallback((entry: Entry, list: Entry[]) => {
    setRoute({name: 'player', entry, list});
  }, []);

  const closePlayer = useCallback(() => {
    setRoute(current =>
      current.name === 'player'
        ? {name: 'section', kind: current.entry.kind}
        : current,
    );
  }, []);

  const back = useKeplerBackHandler();

  useEffect(() => {
    const subscription = back.addEventListener('hardwareBackPress', () => {
      if (route.name === 'section') {
        if (sectionBack.current && sectionBack.current()) {
          return true;
        }
        setRoute({name: 'home'});
        return true;
      }
      if (route.name === 'player') {
        setRoute({name: 'section', kind: route.entry.kind});
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
  }, [back, route]);

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
  } else if (route.name === 'player') {
    screen = (
      <PlayerScreen
        source={source}
        entry={route.entry}
        list={route.list}
        onClose={closePlayer}
        onSelect={play}
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

  return <View style={styles.root}>{screen}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
