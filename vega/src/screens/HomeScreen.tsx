import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Brand, Focusable} from '../components/ui';
import type {Kind, SourceConfig} from '../types';
import {colors, radius, space} from '../theme';

type Props = {
  source: SourceConfig;
  deviceCode: string;
  onOpen: (kind: Kind) => void;
  onSettings: () => void;
};

const CARDS: Array<{
  kind: Kind;
  title: string;
  detail: string;
  glyph: string;
}> = [
  {kind: 'LIVE', title: 'Canais', detail: 'Assistir ao vivo', glyph: 'TV'},
  {kind: 'VOD', title: 'Filmes', detail: 'Catalogo de filmes', glyph: 'FILME'},
  {kind: 'SERIES', title: 'Series', detail: 'Episodios por temporada', glyph: 'SERIES'},
];

export function HomeScreen({source, deviceCode, onOpen, onSettings}: Props) {
  const isDemo = source.mode === 'DEMO';
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Brand />
        <View style={styles.status}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {isDemo ? 'Modo demonstracao' : source.label || 'Conta ativa'}
          </Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>O que voce quer assistir?</Text>
        <Text style={styles.heroSub}>
          Use as setas do controle para navegar e OK para abrir.
        </Text>
      </View>

      <View style={styles.cards}>
        {CARDS.map((card, index) => (
          <Focusable
            key={card.kind}
            accessibilityLabel={card.title}
            hasTVPreferredFocus={index === 0}
            onPress={() => onOpen(card.kind)}
            style={styles.card}
            focusedStyle={styles.cardFocused}>
            <View style={styles.cardGlyphBox}>
              <Text style={styles.cardGlyph}>{card.glyph}</Text>
            </View>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDetail}>{card.detail}</Text>
          </Focusable>
        ))}

        <Focusable
          accessibilityLabel="Ajustes"
          onPress={onSettings}
          style={styles.card}
          focusedStyle={styles.cardFocused}>
          <View style={styles.cardGlyphBox}>
            <Text style={styles.cardGlyph}>AJUSTES</Text>
          </View>
          <Text style={styles.cardTitle}>Ajustes</Text>
          <Text style={styles.cardDetail}>Conta, ativacao e sobre</Text>
        </Focusable>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {isDemo
            ? 'Demonstracao com videos publicos. Nenhuma conta necessaria.'
            : 'Ativado neste aparelho.'}
        </Text>
        <Text style={styles.footerCode}>Codigo: {deviceCode}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: space.sm,
  },
  statusText: {
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  hero: {
    marginTop: space.xl,
    marginBottom: space.lg,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
  },
  heroSub: {
    color: colors.textSoft,
    fontSize: 15,
    marginTop: space.xs,
  },
  cards: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    maxHeight: 320,
  },
  card: {
    flex: 1,
    marginRight: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    justifyContent: 'flex-end',
  },
  cardFocused: {
    backgroundColor: colors.panelSoft,
  },
  cardGlyphBox: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  cardGlyph: {
    color: colors.accentSoft,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  cardDetail: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
  },
  footerText: {
    color: colors.textDim,
    fontSize: 12,
  },
  footerCode: {
    color: colors.textDim,
    fontSize: 12,
    letterSpacing: 1,
  },
});
