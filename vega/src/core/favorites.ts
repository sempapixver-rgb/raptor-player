import type {Entry, Kind} from '../types';
import {readJSON, writeJSON} from './storage';

const MAX_RECENT = 30;

const same = (a: Entry, b: Entry) => a.id === b.id && a.kind === b.kind;

/** Guarda o item inteiro para Favoritos/Recentes abrirem sem carregar a aba. */
export async function loadFavorites(kind: Kind): Promise<Entry[]> {
  const list = await readJSON<Entry[]>('favorites.' + kind, []);
  return Array.isArray(list) ? list : [];
}

export async function isFavorite(entry: Entry): Promise<boolean> {
  const list = await loadFavorites(entry.kind);
  return list.some(item => same(item, entry));
}

export async function toggleFavorite(entry: Entry): Promise<Entry[]> {
  const list = await loadFavorites(entry.kind);
  const next = list.some(item => same(item, entry))
    ? list.filter(item => !same(item, entry))
    : [entry, ...list];
  await writeJSON('favorites.' + entry.kind, next);
  return next;
}

export async function loadRecent(kind: Kind): Promise<Entry[]> {
  const list = await readJSON<Entry[]>('recent.' + kind, []);
  return Array.isArray(list) ? list : [];
}

export async function addRecent(entry: Entry): Promise<void> {
  const list = await loadRecent(entry.kind);
  const next = [entry, ...list.filter(item => !same(item, entry))].slice(
    0,
    MAX_RECENT,
  );
  await writeJSON('recent.' + entry.kind, next);
}
