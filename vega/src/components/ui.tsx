import React, {useState} from 'react';
import {
  ActivityIndicator,
  Image,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {colors, f, radius, s, space} from '../theme';
import type {Entry} from '../types';

/** TouchableOpacity aceita as props de TV do runtime Kepler. */
const TVPressable = TouchableOpacity as unknown as React.ComponentType<any>;

type FocusableProps = {
  children?: React.ReactNode;
  onPress?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: StyleProp<ViewStyle>;
  focusedStyle?: StyleProp<ViewStyle>;
  hasTVPreferredFocus?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function Focusable({
  children,
  onPress,
  onFocus,
  onBlur,
  style,
  focusedStyle,
  hasTVPreferredFocus,
  disabled,
  accessibilityLabel,
}: FocusableProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TVPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeOpacity={1}
      disabled={disabled}
      focusable={!disabled}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onBlur={() => {
        setFocused(false);
        if (onBlur) {
          onBlur();
        }
      }}
      onFocus={() => {
        setFocused(true);
        if (onFocus) {
          onFocus();
        }
      }}
      onPress={onPress}
      style={[
        styles.focusBase,
        style,
        focused ? styles.focused : null,
        focused ? focusedStyle : null,
      ]}>
      {children}
    </TVPressable>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
  kind?: 'primary' | 'ghost' | 'danger';
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  hasTVPreferredFocus,
  kind = 'ghost',
  style,
}: ButtonProps) {
  return (
    <Focusable
      accessibilityLabel={label}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onPress={onPress}
      style={[
        styles.button,
        kind === 'primary' ? styles.buttonPrimary : null,
        kind === 'danger' ? styles.buttonDanger : null,
        style,
      ]}
      focusedStyle={
        kind === 'primary' ? styles.buttonPrimaryFocused : styles.buttonFocused
      }>
      <Text
        style={[
          styles.buttonLabel,
          kind === 'primary' ? styles.buttonLabelPrimary : null,
          kind === 'danger' ? styles.buttonLabelDanger : null,
        ]}>
        {label}
      </Text>
    </Focusable>
  );
}

export function BrandMark({size = s(46)}: {size?: number}) {
  return (
    <View
      style={[
        styles.mark,
        {width: size, height: size, borderRadius: size * 0.3},
      ]}>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: size * 0.17,
          borderBottomWidth: size * 0.17,
          borderLeftWidth: size * 0.29,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: colors.bg,
          marginLeft: size * 0.07,
        }}
      />
    </View>
  );
}

/** Marca no estilo da LG: RAPTOR + VIDEO PLAYER. */
export function Brand({compact}: {compact?: boolean}) {
  return (
    <View style={styles.brand}>
      <Text style={[styles.brandName, compact ? styles.brandNameCompact : null]}>
        RAPTOR
      </Text>
      <Text style={[styles.brandSub, compact ? styles.brandSubCompact : null]}>
        VIDEO PLAYER
      </Text>
    </View>
  );
}

export function Header({
  title,
  subtitle,
  right,
  onBack,
}: {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {onBack ? (
          <Focusable
            accessibilityLabel="Voltar ao menu"
            onPress={onBack}
            style={styles.backButton}
            focusedStyle={styles.backButtonFocused}>
            <Text style={styles.backLabel}>‹ Voltar</Text>
          </Focusable>
        ) : (
          <Brand compact />
        )}
        {title ? (
          <View style={styles.headerTitles}>
            <Text style={styles.headerTitle}>{title}</Text>
            {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
          </View>
        ) : null}
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

export function Loading({label}: {label?: string}) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.centerText}>{label || 'Carregando...'}</Text>
    </View>
  );
}

export function Empty({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {detail ? <Text style={styles.centerText}>{detail}</Text> : null}
    </View>
  );
}

/** Cartao 2:3 da grade, mesmo desenho da LG. */
export function Tile({
  entry,
  onPress,
  onFocus,
  hasTVPreferredFocus,
  style,
}: {
  entry: Entry;
  onPress: () => void;
  onFocus?: () => void;
  hasTVPreferredFocus?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const letter = String(entry.name || '?').trim().charAt(0).toUpperCase();
  return (
    <Focusable
      accessibilityLabel={entry.name}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onFocus={onFocus}
      onPress={onPress}
      style={[styles.tile, style]}
      focusedStyle={styles.tileFocused}>
      <View style={styles.tileArt}>
        <Text style={styles.tileLetter}>{letter}</Text>
        {entry.logo ? (
          <Image
            source={{uri: entry.logo}}
            style={styles.tileImage}
            resizeMode="contain"
          />
        ) : null}
        {entry.kind === 'LIVE' ? <View style={styles.liveDot} /> : null}
      </View>
      <Text style={styles.tileName} numberOfLines={2}>
        {entry.name}
      </Text>
      <Text style={styles.tileSub} numberOfLines={1}>
        {entry.category || (entry.kind === 'LIVE' ? 'Ao vivo' : '')}
      </Text>
    </Focusable>
  );
}

export const styles = StyleSheet.create({
  focusBase: {
    borderWidth: s(3),
    borderColor: 'transparent',
  },
  focused: {
    borderColor: colors.accent,
    backgroundColor: colors.panelSoft,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  centerText: {
    marginTop: space.md,
    color: colors.textSoft,
    fontSize: f(20),
    textAlign: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: f(32),
    fontWeight: '700',
    textAlign: 'center',
  },
  header: {
    height: s(100),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s(38),
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: 'rgba(27,38,30,0.55)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitles: {
    marginLeft: s(26),
  },
  headerTitle: {
    color: colors.text,
    fontSize: f(38),
    fontWeight: '700',
  },
  headerSub: {
    color: colors.textSoft,
    fontSize: f(20),
    marginTop: 2,
  },
  brand: {
    flexDirection: 'column',
  },
  brandText: {
    marginLeft: space.sm,
  },
  brandName: {
    color: colors.accent,
    fontSize: f(30),
    fontWeight: '900',
    letterSpacing: s(10),
  },
  brandNameCompact: {
    fontSize: f(26),
    letterSpacing: s(6),
  },
  brandSub: {
    color: colors.textDim,
    fontSize: f(11),
    fontWeight: '700',
    letterSpacing: s(4),
    marginTop: 3,
  },
  brandSubCompact: {
    fontSize: f(9),
    letterSpacing: s(3),
  },
  mark: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    paddingHorizontal: s(20),
    paddingVertical: s(12),
    borderRadius: radius.md,
    backgroundColor: colors.panelSoft,
  },
  backButtonFocused: {
    backgroundColor: colors.accentSoft,
  },
  backLabel: {
    color: colors.text,
    fontSize: f(23),
    fontWeight: '600',
  },
  button: {
    paddingHorizontal: s(28),
    paddingVertical: s(15),
    borderRadius: radius.md,
    backgroundColor: colors.panelSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
  },
  buttonDanger: {
    backgroundColor: 'rgba(255,107,107,0.14)',
  },
  buttonFocused: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.accent,
  },
  buttonPrimaryFocused: {
    backgroundColor: '#69F0AE',
    borderColor: colors.focus,
  },
  buttonLabel: {
    color: colors.text,
    fontSize: f(17),
    fontWeight: '700',
  },
  buttonLabelPrimary: {
    color: '#00210F',
    fontWeight: '800',
  },
  buttonLabelDanger: {
    color: colors.danger,
  },
  tile: {
    // A largura vem da coluna do FlatList, entao a grade se ajusta sozinha.
    flex: 1,
    minWidth: 0,
    marginRight: s(20),
    marginBottom: s(20),
    padding: s(5),
    borderRadius: radius.md,
    backgroundColor: 'transparent',
  },
  tileFocused: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.accent,
  },
  tileArt: {
    height: s(324),
    borderRadius: s(10),
    backgroundColor: colors.panelSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileLetter: {
    color: colors.textDim,
    fontSize: f(34),
    fontWeight: '900',
  },
  tileImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  liveDot: {
    position: 'absolute',
    top: s(8),
    right: s(8),
    width: s(14),
    height: s(14),
    borderRadius: s(7),
    backgroundColor: colors.danger,
  },
  tileName: {
    color: colors.text,
    fontSize: f(23),
    fontWeight: '600',
    marginTop: s(9),
    minHeight: s(58),
  },
  tileSub: {
    color: colors.textSoft,
    fontSize: f(17),
    marginTop: 2,
  },
});
