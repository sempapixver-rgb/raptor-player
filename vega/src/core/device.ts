import {readText, writeText} from './storage';

const CODE_KEY = 'device.code';

function randomByte(): number {
  return Math.floor(Math.random() * 256);
}

function randomCode(): string {
  const bytes: string[] = [];
  for (let i = 0; i < 6; i++) {
    bytes.push(randomByte().toString(16).toUpperCase().padStart(2, '0'));
  }
  return bytes.join(':');
}

/**
 * Codigo estavel do aparelho, no mesmo formato do MAC usado nas outras
 * plataformas (AA:BB:CC:DD:EE:FF). Fica gravado no armazenamento do app.
 */
export async function deviceCode(): Promise<string> {
  const saved = await readText(CODE_KEY);
  if (saved && /^[0-9A-F]{2}(:[0-9A-F]{2}){5}$/.test(saved)) {
    return saved;
  }
  const code = randomCode();
  await writeText(CODE_KEY, code);
  return code;
}

/** Somente letras e numeros, como o site espera. */
export function normalizeCode(code: string): string {
  return String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Link que pode virar QR Code em uma versao futura. */
export function siteLink(code: string, siteBase: string): string {
  return siteBase + '/?code=' + normalizeCode(code);
}
