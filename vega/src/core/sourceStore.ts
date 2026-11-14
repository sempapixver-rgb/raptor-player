import type {SourceConfig} from '../types';
import {readJSON, removeKey, writeJSON} from './storage';

const KEY = 'source.v1';

/** Configuracao salva no aparelho, se estiver completa. */
export async function loadSource(): Promise<SourceConfig | null> {
  const value = await readJSON<SourceConfig | null>(KEY, null);
  if (!value || !value.mode) {
    return null;
  }
  if (value.mode === 'XTREAM' && (!value.baseUrl || !value.username || !value.password)) {
    return null;
  }
  if (value.mode === 'M3U' && !value.m3uUrl) {
    return null;
  }
  return value;
}

export async function saveSource(source: SourceConfig): Promise<void> {
  await writeJSON(KEY, source);
}

export async function clearSource(): Promise<void> {
  await removeKey(KEY);
}
