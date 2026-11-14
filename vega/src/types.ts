export type Kind = 'LIVE' | 'VOD' | 'SERIES';

export type Category = {
  id: string;
  name: string;
};

export type Entry = {
  id: string;
  name: string;
  kind: Kind;
  logo?: string;
  categoryId?: string;
  category?: string;
  rating?: number;
  year?: number;
  plot?: string;
  ext?: string;
  /** URL pronta (modo demonstracao ou playlist M3U). */
  url?: string;
  /** Serie a que o episodio pertence. */
  seriesId?: string;
};

export type SourceMode = 'XTREAM' | 'M3U' | 'DEMO';

export type SourceConfig = {
  mode: SourceMode;
  baseUrl?: string;
  username?: string;
  password?: string;
  m3uUrl?: string;
  label?: string;
};

/** Resposta de /api/device no site. */
export type Activation = {
  mode?: string;
  host?: string;
  user?: string;
  pass?: string;
  m3u?: string;
  label?: string;
  status?: string;
  expiresAt?: string;
};

export type Playable = {
  entry: Entry;
  /** Lista usada para anterior/proximo no player. */
  list: Entry[];
};
