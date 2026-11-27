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

/** Como o Fire OS monta a fila: cada aba define quem pode buscar e avançar. */
export type PlayOptions = {
  /** Fila usada em Anterior/Proximo. Vazio = toca só o item escolhido. */
  list?: Entry[];
  /** Indice real do item na fila, para nao depender de findIndex. */
  index?: number;
  /** Somente episodios de serie avancam sozinhos. */
  autoAdvance?: boolean;
  /** Canais nunca recebem seek. */
  allowSeek?: boolean;
};

export type PlayHandler = (
  entry: Entry,
  list: Entry[],
  options?: PlayOptions,
) => void;

export type Playable = {
  entry: Entry;
  /** Lista usada para anterior/proximo no player. */
  list: Entry[];
};
