import React, {useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Brand, Button, Focusable} from '../components/ui';
import {colors, radius, space} from '../theme';

const TERMS = [
  'Este aplicativo e um tocador de video. Ele nao inclui, hospeda ou distribui conteudo.',
  'A reproducao usa apenas a lista ou o servidor que o proprio usuario configurar na conta dele.',
  'O usuario e o unico responsavel pelo conteudo exibido e por possuir as licencas necessarias para assisti-lo.',
  'Nenhuma lista, senha ou dado de reproducao e enviado para terceiros. O aparelho guarda apenas a configuracao da conta.',
  'O aplicativo nao coleta historico de navegacao, nao exibe anuncios e nao usa servicos de rastreamento.',
  'Ao continuar, voce concorda com estes termos e com a Politica de Privacidade.',
];

export function TermsScreen({onAccept}: {onAccept: () => void}) {
  const [accepted, setAccepted] = useState(false);
  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <Brand />
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Bem-vindo</Text>
        <Text style={styles.subtitle}>
          Antes de comecar, leia e aceite os termos de uso.
        </Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
          {TERMS.map((line, index) => (
            <Text key={String(index)} style={styles.paragraph}>
              {line}
            </Text>
          ))}
        </ScrollView>

        <View style={styles.actions}>
          <Focusable
            accessibilityLabel="Aceitar os termos"
            hasTVPreferredFocus
            onPress={() => setAccepted(!accepted)}
            style={styles.check}
            focusedStyle={styles.checkFocused}>
            <View style={[styles.box, accepted ? styles.boxOn : null]}>
              {accepted ? <Text style={styles.boxMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>Li e aceito os termos de uso</Text>
          </Focusable>

          <Button
            kind="primary"
            label="Continuar"
            onPress={() => {
              if (accepted) {
                onAccept();
              }
            }}
            style={accepted ? undefined : styles.disabled}
          />
        </View>
      </View>
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
    marginBottom: space.md,
  },
  card: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSoft,
    fontSize: 15,
    marginTop: space.xs,
  },
  scroll: {
    flex: 1,
    marginTop: space.md,
  },
  scrollInner: {
    paddingRight: space.md,
  },
  paragraph: {
    color: colors.textSoft,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: space.sm,
  },
  actions: {
    marginTop: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.md,
  },
  checkFocused: {
    backgroundColor: colors.panelSoft,
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  boxMark: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '900',
  },
  checkLabel: {
    color: colors.text,
    fontSize: 14,
    marginLeft: space.sm,
  },
  disabled: {
    opacity: 0.4,
  },
});
