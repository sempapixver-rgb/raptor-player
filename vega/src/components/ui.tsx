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
import {colors, radius, space} from '../theme';
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

export function BrandMark({size = 46}: {size?: number}) {
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

export function Brand({compact}: {compact?: boolean}) {
  return (
    <View style={styles.brand}>
      <BrandMark size={compact ? 34 : 46} />
      <View style={styles.brandText}>
        <Text style={[styles.brandName, compact ? styles.brandNameCompact : null]}>
          REPTOR
        </Text>
        <Text style={styles.brandSub}>VIDEO PLAYER</Text>
      </View>
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
            <Text style={styles.backLabel}>Voltar</Text>
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
    borderWidth: 2,
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
    fontSize: 15,
    textAlign: 'center',
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.bgSoft,
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
    marginLeft: space.lg,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '700',
  },
  headerSub: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 2,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandText: {
    marginLeft: space.sm,
  },
  brandName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 3,
  },
  brandNameCompact: {
    fontSize: 17,
    letterSpacing: 2,
  },
  brandSub: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 3,
    marginTop: 1,
  },
  mark: {
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
  },
  backButtonFocused: {
    backgroundColor: colors.accentSoft,
  },
  backLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
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
    backgroundColor: '#57E8BC',
    borderColor: colors.focus,
  },
  buttonLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  buttonLabelPrimary: {
    color: colors.bg,
    fontWeight: '800',
  },
  buttonLabelDanger: {
    color: colors.danger,
  },
  tile: {
    flex: 1,
    marginRight: space.sm + 2,
    marginBottom: space.sm + 2,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
  },
  tileFocused: {
    backgroundColor: colors.panelSoft,
  },
  tileArt: {
    height: 92,
    borderRadius: radius.sm,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileLetter: {
    color: colors.line,
    fontSize: 34,
    fontWeight: '800',
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
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  tileName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: space.xs + 2,
    minHeight: 34,
  },
  tileSub: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
});
