import {fetchWithFallback} from './media';
import type {Category, Entry, Kind} from '../types';

export type Playlist = {
  categories: Record<Kind, Category[]>;
  items: Record<Kind, Entry[]>;
};

const EMPTY: Playlist = {
  categories: {LIVE: [], VOD: [], SERIES: []},
  items: {LIVE: [], VOD: [], SERIES: []},
};

const cache = new Map<string, {at: number; data: Playlist}>();

function slug(text: string): string {
  const value = String(text || '').toLowerCase();
  let plain = value;
  try {
    plain = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    plain = value;
  }
  return plain
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function attr(line: string, name: string): string {
  const match = new RegExp(name + '="([^"]*)"', 'i').exec(line);
  return match ? match[1] : '';
}

function kindOf(url: string): Kind {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.indexOf('/movie/') >= 0) {
    return 'VOD';
  }
  if (clean.indexOf('/series/') >= 0) {
    return 'SERIES';
  }
  const ext = clean.split('.').pop() || '';
  if (['mp4', 'mkv', 'avi', 'mov', 'm4v', 'webm'].indexOf(ext) >= 0) {
    return 'VOD';
  }
  return 'LIVE';
}

function extOf(url: string): string {
  const clean = url.split('?')[0];
  const ext = (clean.split('.').pop() || '').toLowerCase();
  return ext.length > 1 && ext.length < 6 ? ext : 'mp4';
}

export function parsePlaylist(text: string): Playlist {
  const result: Playlist = {
    categories: {LIVE: [], VOD: [], SERIES: []},
    items: {LIVE: [], VOD: [], SERIES: []},
  };
  const seenCategories: Record<Kind, Record<string, boolean>> = {
    LIVE: {},
    VOD: {},
    SERIES: {},
  };
  const lines = String(text || '').split(/\r?\n/);
  let pending: {
    name: string;
    logo: string;
    group: string;
    tvgId: string;
    kindHint?: Kind;
  } | null = null;
  let counter = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith('#EXTGRP:')) {
      if (pending) {
        pending.group = line.slice('#EXTGRP:'.length).trim();
      }
      continue;
    }
    if (line.startsWith('#EXTINF:')) {
      const comma = line.lastIndexOf(',');
      const name = comma >= 0 ? line.slice(comma + 1).trim() : 'Sem nome';
      const group = attr(line, 'group-title') || 'Outros';
      pending = {
        name,
        logo: attr(line, 'tvg-logo'),
        group,
        tvgId: attr(line, 'tvg-id'),
      };
      continue;
    }
    if (line.startsWith('#')) {
      continue;
    }
    if (!pending) {
      continue;
    }
    const url = line;
    if (!/^https?:\/\//i.test(url)) {
      pending = null;
      continue;
    }
    const kind = pending.kindHint || kindOf(url);
    const categoryId = slug(pending.group) || 'outros';
    if (!seenCategories[kind][categoryId]) {
      seenCategories[kind][categoryId] = true;
      result.categories[kind].push({
        id: categoryId,
        name: pending.group,
      });
    }
    counter += 1;
    result.items[kind].push({
      id: pending.tvgId || 'm3u-' + counter,
      name: pending.name,
      kind,
      logo: pending.logo,
      categoryId,
      category: pending.group,
      ext: extOf(url),
      url,
    });
    pending = null;
  }

  for (const kind of ['LIVE', 'VOD', 'SERIES'] as Kind[]) {
    result.categories[kind].sort((a, b) => a.name.localeCompare(b.name));
  }
  return result;
}

export async function loadPlaylist(url: string): Promise<Playlist> {
  const key = String(url || '').trim();
  if (!key) {
    return EMPTY;
  }
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) {
    return hit.data;
  }
  const response = await fetchWithFallback(key);
  if (!response || !response.ok) {
    throw new Error(response ? 'HTTP ' + response.status : 'Sem resposta');
  }
  const data = parsePlaylist(await response.text());
  cache.set(key, {at: Date.now(), data});
  return data;
}

export function clearPlaylistCache(): void {
  cache.clear();
}
