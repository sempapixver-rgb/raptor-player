import {fetchWithFallback} from './media';
import type {Category, Entry, Kind, SourceConfig} from '../types';

/** Aceita host puro, URL com barra no fim ou com /player_api.php. */
export function normalizeBase(raw: string): string {
  let base = String(raw || '').trim();
  if (!base) {
    return '';
  }
  if (!/^https?:\/\//i.test(base)) {
    base = 'http://' + base;
  }
  base = base.split('?')[0].split('#')[0].replace(/\/+$/, '');
  const suffixes = ['/player_api.php', '/get.php', '/panel_api.php', '/xmltv.php'];
  const lower = base.toLowerCase();
  for (const suffix of suffixes) {
    if (lower.endsWith(suffix)) {
      base = base.slice(0, base.length - suffix.length);
      break;
    }
  }
  return base.replace(/\/+$/, '');
}

function apiUrl(source: SourceConfig, params: Record<string, string>): string {
  const base = normalizeBase(source.baseUrl || '');
  const query = [
    'username=' + encodeURIComponent(source.username || ''),
    'password=' + encodeURIComponent(source.password || ''),
  ];
  for (const key of Object.keys(params)) {
    query.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
  }
  return base + '/player_api.php?' + query.join('&');
}

async function getJSON<T>(url: string): Promise<T> {
  const response = await fetchWithFallback(url);
  if (!response || !response.ok) {
    throw new Error(response ? 'HTTP ' + response.status : 'Sem resposta');
  }
  return (await response.json()) as T;
}

type RawCategory = {
  category_id?: string | number;
  category_name?: string;
};

type RawStream = {
  stream_id?: string | number;
  series_id?: string | number;
  name?: string;
  title?: string;
  stream_icon?: string;
  cover?: string;
  category_id?: string | number;
  rating?: string | number;
  container_extension?: string;
  num?: string | number;
};

const ACTIONS: Record<Kind, {categories: string; items: string; idField: string}> = {
  LIVE: {
    categories: 'get_live_categories',
    items: 'get_live_streams',
    idField: 'stream_id',
  },
  VOD: {
    categories: 'get_vod_categories',
    items: 'get_vod_streams',
    idField: 'stream_id',
  },
  SERIES: {
    categories: 'get_series_categories',
    items: 'get_series',
    idField: 'series_id',
  },
};

function toEntry(raw: RawStream, kind: Kind, categoryName?: string): Entry {
  const id = String(
    kind === 'SERIES' ? raw.series_id ?? raw.stream_id : raw.stream_id ?? raw.series_id,
  );
  const ratingValue = Number(raw.rating);
  return {
    id,
    name: String(raw.name || raw.title || 'Sem nome'),
    kind,
    logo: String(raw.stream_icon || raw.cover || ''),
    categoryId: raw.category_id != null ? String(raw.category_id) : undefined,
    category: categoryName,
    rating: Number.isFinite(ratingValue) ? ratingValue : undefined,
    ext: raw.container_extension ? String(raw.container_extension) : undefined,
  };
}

export async function categories(
  source: SourceConfig,
  kind: Kind,
): Promise<Category[]> {
  const data = await getJSON<RawCategory[]>(
    apiUrl(source, {action: ACTIONS[kind].categories}),
  );
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map(item => ({
    id: String(item.category_id ?? ''),
    name: String(item.category_name || 'Sem nome'),
  }));
}

export async function items(
  source: SourceConfig,
  kind: Kind,
  categoryId: string,
): Promise<Entry[]> {
  const params: Record<string, string> = {action: ACTIONS[kind].items};
  if (categoryId) {
    params.category_id = categoryId;
  }
  const data = await getJSON<RawStream[]>(apiUrl(source, params));
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map(raw => toEntry(raw, kind));
}

/** Todos os itens da aba, usado pela busca global e por Favoritos. */
export async function allItems(
  source: SourceConfig,
  kind: Kind,
): Promise<Entry[]> {
  return items(source, kind, '');
}

export function playUrl(source: SourceConfig, entry: Entry): string {
  if (entry.url) {
    return entry.url;
  }
  const base = normalizeBase(source.baseUrl || '');
  const user = encodeURIComponent(source.username || '');
  const pass = encodeURIComponent(source.password || '');
  if (!base || !user || !pass) {
    return '';
  }
  const id = encodeURIComponent(entry.id);
  if (entry.kind === 'LIVE') {
    // HLS e o formato que o player da Vega reproduz com mais estabilidade.
    return base + '/live/' + user + '/' + pass + '/' + id + '.m3u8';
  }
  const ext = entry.ext || 'mp4';
  if (entry.kind === 'SERIES') {
    // Uma serie inteira nao tem URL direta: só o episodio (seriesId) tem.
    if (!entry.seriesId) {
      return '';
    }
    return base + '/series/' + user + '/' + pass + '/' + id + '.' + ext;
  }
  return base + '/movie/' + user + '/' + pass + '/' + id + '.' + ext;
}

type RawEpisode = {
  id?: string | number;
  episode_num?: string | number;
  title?: string;
  container_extension?: string;
  season?: string | number;
  info?: {plot?: string; movie_image?: string; duration_secs?: string | number};
};

type RawSeriesInfo = {
  episodes?: Record<string, RawEpisode[]>;
  info?: {plot?: string; cover?: string};
};

/** Episodios de uma serie, achatados em uma lista unica. */
export async function seriesEpisodes(
  source: SourceConfig,
  series: Entry,
): Promise<Entry[]> {
  const data = await getJSON<RawSeriesInfo>(
    apiUrl(source, {action: 'get_series_info', series_id: series.id}),
  );
  const seasons = data?.episodes || {};
  const list: Entry[] = [];
  for (const seasonKey of Object.keys(seasons)) {
    const episodes = seasons[seasonKey] || [];
    for (const episode of episodes) {
      list.push({
        id: String(episode.id ?? ''),
        name:
          String(episode.episode_num ?? '?') +
          '. ' +
          String(episode.title || 'Episodio'),
        kind: 'SERIES',
        logo: episode.info?.movie_image || series.logo,
        plot: episode.info?.plot || '',
        ext: episode.container_extension || 'mp4',
        categoryId: series.id,
        category: 'Temporada ' + String(episode.season ?? seasonKey),
        seriesId: series.id,
      });
    }
  }
  return list;
}
