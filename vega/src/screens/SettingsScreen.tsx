import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Brand, Button, Focusable, Header} from '../components/ui';
import {
  APP_VERSION,
  BUILD_DATE,
  BUILD_NUMBER,
  PACKAGE_ID,
  PRIVACY_URL,
} from '../config/app';
import type {SourceConfig} from '../types';
import {colors, radius, space} from '../theme';

type Props = {
  source: SourceConfig;
  deviceCode: string;
  onDemo: () => void;
  onChangeActivation: () => void;
  onExit: () => void;
};

function modeLabel(source: SourceConfig): string {
  if (source.mode === 'DEMO') {
    return 'Demonstracao';
  }
  if (source.mode === 'M3U') {
    return 'Lista M3U';
  }
  return 'Servidor de midia';
}

export function SettingsScreen({
  source,
  deviceCode,
  onDemo,
  onChangeActivation,
  onExit,
}: Props) {
  return (
    <View style={styles.root}>
      <Header title="Ajustes" subtitle="Conta, ativacao e sobre" onBack={onExit} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>APARELHO</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Codigo</Text>
            <Text style={styles.rowValue}>{deviceCode}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Conta</Text>
            <Text style={styles.rowValue}>{source.label || 'Conta ativa'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Fonte</Text>
            <Text style={styles.rowValue}>{modeLabel(source)}</Text>
          </View>

          <View style={styles.actions}>
            <Focusable
              accessibilityLabel="Usar modo demonstracao"
              hasTVPreferredFocus
              onPress={onDemo}
              style={styles.action}
              focusedStyle={styles.actionFocused}>
              <Text style={styles.actionTitle}>Usar modo demonstracao</Text>
              <Text style={styles.actionDetail}>
                Videos publicos, sem conta e sem lista.
              </Text>
            </Focusable>

            <Focusable
              accessibilityLabel="Trocar ativacao"
              onPress={onChangeActivation}
              style={styles.action}
              focusedStyle={styles.actionFocused}>
              <Text style={styles.actionTitle}>Trocar ativacao</Text>
              <Text style={styles.actionDetail}>
                Remove a configuracao atual deste aparelho e volta para a tela
                de codigo.
              </Text>
            </Focusable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>SOBRE</Text>
          <View style={styles.aboutRow}>
            <Brand compact />
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Versao</Text>
            <Text style={styles.rowValue}>
              {APP_VERSION} ({BUILD_NUMBER})
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Build</Text>
            <Text style={styles.rowValue}>{BUILD_DATE}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Pacote</Text>
            <Text style={styles.rowValue}>{PACKAGE_ID}</Text>
          </View>
          <Text style={styles.note}>
            Este aplicativo e um tocador de video. Ele nao inclui, hospeda ou
            distribui conteudo. A reproducao usa apenas a lista ou o servidor
            configurado pelo usuario.
          </Text>
          <Text style={styles.link}>Privacidade: {PRIVACY_URL}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    marginBottom: space.lg,
  },
  cardTitle: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLabel: {
    color: colors.textDim,
    fontSize: 13,
  },
  rowValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    marginTop: space.lg,
  },
  action: {
    flex: 1,
    marginRight: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgSoft,
  },
  actionFocused: {
    backgroundColor: colors.panelSoft,
  },
  actionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  actionDetail: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  aboutRow: {
    marginBottom: space.sm,
  },
  note: {
    color: colors.textSoft,
    fontSize: 12,
    lineHeight: 18,
    marginTop: space.md,
  },
  link: {
    color: colors.accentSoft,
    fontSize: 11,
    marginTop: space.sm,
  },
});
