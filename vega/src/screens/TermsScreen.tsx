import React, {useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import {Brand, Button, Focusable} from '../components/ui';
import {colors, f, radius, s, space} from '../theme';

const TERMS: Array<{title: string; text: string}> = [
  {
    title: '1. O que e o Raptor Player',
    text: 'Este aplicativo e apenas um tocador de video. Ele nao inclui, hospeda nem distribui conteudo.',
  },
  {
    title: '2. Videos de demonstracao',
    text: 'Para testar o player, o app reproduz videos publicos de demonstracao. Nenhuma conta e necessaria.',
  },
  {
    title: '3. Ativacao do aparelho',
    text: 'O codigo exibido na tela identifica apenas este aparelho no site de ativacao. Nenhum dado de acesso e digitado no controle.',
  },
  {
    title: '4. Privacidade',
    text: 'O app nao solicita camera, microfone, localizacao, contatos nem compras. O codigo e as preferencias ficam no proprio aparelho.',
  },
  {
    title: '5. Responsabilidade',
    text: 'O usuario e responsavel pelo uso do aplicativo e deve respeitar as leis e os direitos aplicaveis ao material reproduzido.',
  },
  {
    title: '6. Aceite',
    text: 'Ao selecionar continuar, voce confirma que leu e concorda com estes termos.',
  },
];

export function TermsScreen({onAccept}: {onAccept: () => void}) {
  const [accepted, setAccepted] = useState(false);
  return (
    <View style={styles.root}>
      <View style={styles.box}>
        <View style={styles.brandBig}>
          <Text style={styles.logo}>RAPTOR</Text>
          <Text style={styles.tag}>VIDEO PLAYER</Text>
        </View>

        <Text style={styles.title}>Termos de uso e aviso de responsabilidade</Text>
        <Text style={styles.updated}>Versao 3 — atualizado em novembro de 2026</Text>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
          {TERMS.map((item, index) => (
            <View key={String(index)} style={styles.block}>
              <Text style={styles.blockTitle}>{item.title}</Text>
              <Text style={styles.paragraph}>{item.text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.actions}>
          <Focusable
            accessibilityLabel="Li e aceito os termos"
            hasTVPreferredFocus
            onPress={() => setAccepted(!accepted)}
            style={styles.check}
            focusedStyle={styles.checkFocused}>
            <View style={[styles.boxCheck, accepted ? styles.boxOn : null]}>
              {accepted ? <Text style={styles.boxMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>Li e aceito os termos de uso</Text>
          </Focusable>

          <Button
            kind="primary"
            label="Aceitar e continuar"
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(60),
    paddingVertical: s(40),
  },
  box: {
    width: s(1180),
    maxHeight: '96%',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: s(52),
    paddingTop: s(40),
    paddingBottom: s(32),
  },
  brandBig: {flexDirection: 'column'},
  logo: {
    color: colors.accent,
    fontSize: f(22),
    fontWeight: '900',
    letterSpacing: s(7),
  },
  tag: {color: colors.textDim, fontSize: f(9), letterSpacing: s(3), marginTop: s(5)},
  title: {
    color: colors.text,
    fontSize: f(34),
    fontWeight: '700',
    marginTop: s(26),
  },
  updated: {color: colors.textDim, fontSize: f(15), marginTop: s(8)},
  scroll: {flex: 1, marginTop: s(22)},
  scrollInner: {paddingRight: s(18)},
  block: {marginBottom: s(16)},
  blockTitle: {color: colors.accent, fontSize: f(20), fontWeight: '700'},
  paragraph: {
    color: colors.textSoft,
    fontSize: f(18),
    lineHeight: f(30),
    marginTop: s(8),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: s(26),
  },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
  },
  checkFocused: {backgroundColor: colors.panelSoft},
  boxCheck: {
    width: s(24),
    height: s(24),
    borderRadius: s(6),
    borderWidth: 2,
    borderColor: colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {backgroundColor: colors.accent, borderColor: colors.accent},
  boxMark: {color: colors.bg, fontSize: f(15), fontWeight: '900'},
  checkLabel: {color: colors.text, fontSize: f(17), marginLeft: space.sm},
  disabled: {opacity: 0.4},
});
