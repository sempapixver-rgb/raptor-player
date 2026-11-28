import {Dimensions} from 'react-native';

/**
 * Layout de referencia: 1920x1080 (mesmo desenho do app LG webOS).
 * Toda medida e convertida para a resolucao real da TV, entao a interface
 * se ajusta sozinha ao aparelho, sem depender de tamanho fixo.
 */
const window = Dimensions.get('window');

export const screenWidth = window.width;
export const screenHeight = window.height;

// Usa a menor das duas razoes para nao estourar nem na largura nem na altura.
// Sem teto baixo: em 4K a interface acompanha a TV, nao fica pequena.
const ratio = Math.min(screenWidth / 1920, screenHeight / 1080);
export const scale = Math.max(0.85, Math.min(2, ratio));

/** Converte medida do desenho (1920x1080) para a TV atual. */
export const s = (px: number): number => Math.round(px * scale);

/** Fonte com piso de legibilidade em televisores menores. */
export const f = (px: number): number => Math.max(15, Math.round(px * scale));

/** Paleta unica: identidade visual do app LG, portada para a Vega. */
export const colors = {
  bg: '#0B0F0C',
  bgSoft: '#121A14',
  panel: '#121A14',
  panelSoft: '#1B261E',
  line: '#2E4A36',
  text: '#E6F2E9',
  textSoft: '#A8C2B0',
  textDim: '#6F8A77',
  accent: '#00E676',
  accentSoft: '#1B7F66',
  focus: '#FFFFFF',
  focusRing: '#00E676',
  danger: '#FF6B6B',
  gold: '#FFC857',
};

export const space = {
  xs: s(6),
  sm: s(10),
  md: s(16),
  lg: s(24),
  xl: s(36),
  xxl: s(56),
};

export const radius = {
  sm: s(8),
  md: s(14),
  lg: s(20),
  pill: 999,
};
