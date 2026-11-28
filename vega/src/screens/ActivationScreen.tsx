import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Brand, Button} from '../components/ui';
import {SITE_BASE} from '../config/app';
import {fetchActivation} from '../core/activation';
import type {SourceConfig} from '../types';
import {colors, f, radius, s, space} from '../theme';

type Props = {
  deviceCode: string;
  onActivated: (source: SourceConfig) => void;
  onDemo: () => void;
};

export function ActivationScreen({deviceCode, onActivated, onDemo}: Props) {
  const [message, setMessage] = useState('Aguardando ativacao pelo site...');
  const [checking, setChecking] = useState(false);
  const [stopped, setStopped] = useState(false);
  const running = useRef(false);
  const alive = useRef(true);

  const check = useCallback(
    async (silent: boolean) => {
      if (running.current) {
        return;
      }
      running.current = true;
      if (!silent) {
        setChecking(true);
      }
      const result = await fetchActivation(deviceCode);
      running.current = false;
      if (!alive.current) {
        return;
      }
      setChecking(false);

      if (result.status === 'ok') {
        setMessage('Aparelho ativado! Abrindo...');
        setStopped(true);
        onActivated(result.source);
        return;
      }
      if (result.status === 'blocked' || result.status === 'expired') {
        setStopped(true);
        setMessage(result.message);
        return;
      }
      if (result.status === 'offline') {
        setMessage('Sem conexao com o servidor. Tentando novamente...');
        return;
      }
      if (result.status === 'error') {
        setMessage(result.message);
        return;
      }
      setMessage('Aguardando ativacao pelo site...');
    },
    [deviceCode, onActivated],
  );

  useEffect(() => {
    alive.current = true;
    check(true);
    const timer = setInterval(() => {
      if (!stopped) {
        check(true);
      }
    }, 6000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [check, stopped]);

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <View style={styles.brandBig}>
          <Text style={styles.logo}>RAPTOR</Text>
          <Text style={styles.tag}>VIDEO PLAYER</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.left}>
          <Text style={styles.title}>Ative este aparelho</Text>
          <Text style={styles.text}>
            No celular ou computador, abra o site abaixo e informe o codigo do
            aparelho. A liberacao e automatica. Nada e digitado no controle.
          </Text>

          <View style={styles.siteBox}>
            <Text style={styles.lbl}>SITE DE ATIVACAO</Text>
            <Text style={styles.site}>{SITE_BASE.replace(/^https?:\/\//, '')}</Text>
          </View>

          <View style={styles.actions}>
            <Button
              kind="primary"
              label={checking ? 'Verificando...' : 'Ja ativei, verificar'}
              hasTVPreferredFocus
              onPress={() => check(false)}
            />
            <Button label="▶ Testar o player" onPress={onDemo} />
          </View>
        </View>

        <View style={styles.right}>
          <Text style={styles.lbl}>CODIGO DESTE APARELHO (MAC)</Text>
          <Text style={styles.code} numberOfLines={1}>
            {deviceCode}
          </Text>
          <View style={styles.status}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{message}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.footer}>
        O aplicativo e apenas um tocador de video. Nenhum conteudo vem instalado.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.bg, padding: s(80)},
  top: {marginBottom: s(34)},
  brandBig: {flexDirection: 'column'},
  logo: {
    color: colors.accent,
    fontSize: f(30),
    fontWeight: '900',
    letterSpacing: s(10),
  },
  tag: {color: colors.textDim, fontSize: f(11), letterSpacing: s(4), marginTop: s(5)},
  body: {flex: 1, flexDirection: 'row', alignItems: 'center'},
  left: {flex: 1.15, paddingRight: s(56)},
  right: {
    flex: 0.85,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: s(36),
  },
  title: {color: colors.text, fontSize: f(30), fontWeight: '800', marginTop: s(34)},
  text: {
    color: colors.textSoft,
    fontSize: f(18),
    lineHeight: f(28),
    marginTop: s(10),
    maxWidth: s(660),
  },
  siteBox: {
    marginTop: s(34),
    padding: s(16),
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.line,
    alignSelf: 'flex-start',
  },
  lbl: {color: colors.textDim, fontSize: f(13), letterSpacing: s(2)},
  site: {color: colors.accent, fontSize: f(17), marginTop: s(4)},
  actions: {flexDirection: 'row', marginTop: s(34)},
  code: {
    color: colors.text,
    fontSize: f(40),
    fontWeight: '800',
    letterSpacing: s(2),
    marginTop: s(10),
  },
  status: {flexDirection: 'row', alignItems: 'center', marginTop: s(10)},
  statusDot: {
    width: s(9),
    height: s(9),
    borderRadius: s(5),
    backgroundColor: colors.gold,
    marginRight: s(9),
  },
  statusText: {color: colors.textSoft, fontSize: f(17)},
  footer: {
    color: colors.textDim,
    fontSize: f(15),
    textAlign: 'center',
    marginTop: space.md,
  },
});
