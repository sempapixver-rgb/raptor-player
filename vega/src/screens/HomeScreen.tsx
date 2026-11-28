import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Button, Brand, Focusable} from '../components/ui';
import type {Kind, SourceConfig} from '../types';
import {colors, f, s, space} from '../theme';

type Props = {
  source: SourceConfig;
  deviceCode: string;
  onOpen: (kind: Kind) => void;
  onSettings: () => void;
};

const CARDS: Array<{
  kind: Kind;
  num: string;
  label: string;
  sub: string;
}> = [
  {kind: 'LIVE', num: '01', label: 'Canais', sub: 'Assistir ao vivo'},
  {kind: 'VOD', num: '02', label: 'Filmes', sub: 'Catalogo de filmes'},
  {kind: 'SERIES', num: '03', label: 'Series', sub: 'Episodios por temporada'},
];

/** Menu principal: mesmo desenho do menu da LG. */
export function HomeScreen({source, deviceCode, onOpen, onSettings}: Props) {
  const isDemo = source.mode === 'DEMO';
  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <View style={styles.brandBig}>
          <Text style={styles.logo}>RAPTOR</Text>
          <Text style={styles.tag}>VIDEO PLAYER</Text>
        </View>
      </View>

      <View style={styles.cards}>
        {CARDS.map((card, index) => (
          <Focusable
            key={card.kind}
            accessibilityLabel={card.label}
            hasTVPreferredFocus={index === 0}
            onPress={() => onOpen(card.kind)}
            style={styles.card}
            focusedStyle={styles.cardFocused}>
            <Text style={styles.cardNum}>{card.num}</Text>
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={styles.cardSub}>{card.sub}</Text>
          </Focusable>
        ))}

        <Focusable
          accessibilityLabel="Ajustes"
          onPress={onSettings}
          style={styles.card}
          focusedStyle={styles.cardFocused}>
          <Text style={styles.cardNum}>04</Text>
          <Text style={styles.cardLabel}>Ajustes</Text>
          <Text style={styles.cardSub}>Conta, ativacao e sobre</Text>
        </Focusable>
      </View>

      <View style={styles.foot}>
        <Text style={styles.footText}>
          OK abre a aba {'·'} Volta fecha o app
        </Text>
        <Text style={styles.footCode}>
          {isDemo ? 'Modo demonstracao' : deviceCode}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: s(120),
    justifyContent: 'center',
  },
  head: {
    paddingBottom: s(54),
  },
  brandBig: {
    flexDirection: 'column',
  },
  logo: {
    color: colors.accent,
    fontSize: f(62),
    fontWeight: '900',
    letterSpacing: s(18),
  },
  tag: {
    color: colors.textDim,
    fontSize: f(16),
    letterSpacing: s(8),
    marginTop: s(12),
  },
  cards: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  card: {
    // Largura proporcional: quatro cartoes cabem em 720p, 1080p e 4K.
    flex: 1,
    minWidth: 0,
    height: s(258),
    marginRight: s(30),
    paddingVertical: s(32),
    paddingHorizontal: s(30),
    borderRadius: s(18),
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    justifyContent: 'flex-end',
  },
  cardFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.panelSoft,
  },
  cardNum: {
    color: colors.textDim,
    fontSize: f(20),
    letterSpacing: s(3),
    marginBottom: 'auto',
  },
  cardLabel: {
    color: colors.text,
    fontSize: f(44),
    fontWeight: '800',
  },
  cardSub: {
    color: colors.textSoft,
    fontSize: f(19),
    marginTop: s(8),
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: s(54),
  },
  footText: {
    color: colors.textDim,
    fontSize: f(20),
  },
  footCode: {
    color: colors.textDim,
    fontSize: f(18),
    letterSpacing: s(2),
  },
});
