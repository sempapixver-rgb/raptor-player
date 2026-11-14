import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Brand, Button} from '../components/ui';
import {SITE_BASE} from '../config/app';
import {fetchActivation} from '../core/activation';
import type {SourceConfig} from '../types';
import {colors, radius, space} from '../theme';

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
        <Brand />
      </View>

      <View style={styles.body}>
        <View style={styles.left}>
          <Text style={styles.step}>PASSO 1</Text>
          <Text style={styles.title}>Ative este aparelho</Text>
          <Text style={styles.text}>
            No celular ou computador, abra o site abaixo, entre na sua conta e
            informe o codigo do aparelho. A liberacao e automatica.
          </Text>

          <View style={styles.siteBox}>
            <Text style={styles.siteLabel}>SITE DE ATIVACAO</Text>
            <Text style={styles.site}>{SITE_BASE.replace(/^https?:\/\//, '')}</Text>
          </View>

          <View style={styles.actions}>
            <Button
              kind="primary"
              label={checking ? 'Verificando...' : 'Ja ativei, verificar'}
              hasTVPreferredFocus
              onPress={() => check(false)}
            />
            <Button label="Usar modo demonstracao" onPress={onDemo} />
          </View>
        </View>

        <View style={styles.right}>
          <Text style={styles.codeLabel}>CODIGO DESTE APARELHO</Text>
          <View style={styles.codeBox}>
            <Text style={styles.code}>{deviceCode}</Text>
          </View>
          <Text style={styles.hint}>
            Informe exatamente este codigo no site. Ele fica salvo neste
            aparelho e nao muda.
          </Text>
          <View style={styles.statusBox}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{message}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.footer}>
        O aplicativo e apenas um tocador de video. Nenhum conteudo vem
        instalado.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: space.xl,
  },
  top: {
    marginBottom: space.lg,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    flex: 1.15,
    paddingRight: space.xl,
  },
  right: {
    flex: 0.85,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
  },
  step: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    marginTop: space.sm,
  },
  text: {
    color: colors.textSoft,
    fontSize: 15,
    lineHeight: 23,
    marginTop: space.sm,
    maxWidth: 560,
  },
  siteBox: {
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.line,
    alignSelf: 'flex-start',
    minWidth: 320,
  },
  siteLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  site: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: space.lg,
  },
  codeLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  codeBox: {
    marginTop: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
  },
  code: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 3,
  },
  hint: {
    color: colors.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: space.sm,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.lg,
    padding: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSoft,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    marginRight: space.sm,
  },
  statusText: {
    color: colors.textSoft,
    fontSize: 12,
    flex: 1,
  },
  footer: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginTop: space.md,
  },
});
