import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Button,
  Empty,
  Focusable,
  Header,
  Loading,
  Tile,
} from '../components/ui';
import {normalizeText} from '../core/format';
import {
  addRecent,
  loadFavorites,
  loadRecent,
  toggleFavorite,
} from '../core/favorites';
import {
  loadAll,
  loadCategories,
  loadFolder,
} from '../core/library';
import {readJSON, writeJSON} from '../core/storage';
import {seriesEpisodes} from '../core/xtream';
import type {Category, Entry, Kind, PlayHandler, SourceConfig} from '../types';
import {colors, radius, space} from '../theme';

const TITLES: Record<Kind, string> = {
  LIVE: 'Canais',
  VOD: 'Filmes',
  SERIES: 'Series',
};

const FAV = '__fav__';
const RECENT = '__recent__';

type Props = {
  source: SourceConfig;
  kind: Kind;
  onExit: () => void;
  onPlay: PlayHandler;
  backRef: React.MutableRefObject<(() => boolean) | null>;
};

type SidebarItem = Category & {count?: number};
type SortMode = 'default' | 'name-asc' | 'name-desc' | 'rating';
const SORTS: SortMode[] = ['default', 'name-asc', 'name-desc', 'rating'];
const SORT_LABELS: Record<SortMode, string> = {
  default: 'Ordem',
  'name-asc': 'Nome A-Z',
  'name-desc': 'Nome Z-A',
  rating: 'Avaliacao',
};

const folderKey = (source: SourceConfig, kind: Kind) =>
  'folder.' +
  source.mode +
  '.' +
  (source.baseUrl || source.m3uUrl || source.label || '') +
  '.' +
  kind;

function sortItems(list: Entry[], kind: Kind, mode: SortMode): Entry[] {
  if (kind !== 'VOD' || mode === 'default') {
    return list;
  }
  const copy = [...list];
  if (mode === 'name-asc') {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (mode === 'name-desc') {
    copy.sort((a, b) => b.name.localeCompare(a.name));
  } else if (mode === 'rating') {
    copy.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }
  return copy;
}

export function SectionScreen({source, kind, onExit, onPlay, backRef}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Entry[]>([]);
  const [allCache, setAllCache] = useState<Entry[]>([]);
  const [favorites, setFavorites] = useState<Entry[]>([]);
  const [recent, setRecent] = useState<Entry[]>([]);
  const [activeCat, setActiveCat] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortMode>('default');
  const [series, setSeries] = useState<Entry | null>(null);
  const [selectedLive, setSelectedLive] = useState<Entry | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);

  const gridRef = useRef<FlatList<Entry>>(null);
  const [preferred, setPreferred] = useState(true);

  const key = folderKey(source, kind);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const cats = await loadCategories(source, kind);
        const saved = await readJSON<string>(key, '');
        const initial =
          kind === 'LIVE'
            ? saved || ''
            : cats.find(cat => cat.id === saved)?.id ||
              cats[0]?.id ||
              '';
        if (alive) {
          setCategories(cats);
          setActiveCat(initial);
        }
      } catch {
        if (alive) {
          setError('Nao foi possivel carregar agora. Confira a conexao.');
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [key, kind, source]);

  useEffect(() => {
    if (activeCat === FAV || activeCat === RECENT) {
      setLoading(false);
      return;
    }
    if (kind !== 'LIVE' && !categories.length) {
      return;
    }
    let alive = true;
    setLoading(true);
    setError('');
    const cat = categories.find(item => item.id === activeCat);
    loadFolder(source, kind, activeCat, cat?.name)
      .then(list => {
        if (alive) {
          setItems(list);
          void writeJSON(key, activeCat);
        }
      })
      .catch(() => {
        if (alive) {
          setError('Nao foi possivel carregar esta pasta.');
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [activeCat, categories, key, kind, source]);

  useEffect(() => {
    let alive = true;
    Promise.all([loadFavorites(kind), loadRecent(kind)])
      .then(([fav, rec]) => {
        if (alive) {
          setFavorites(fav);
          setRecent(rec);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [kind]);

  // O indice completo e pesado: só é buscado quando o usuario digita 2 letras.
  useEffect(() => {
    if (normalizeText(query).length < 2) {
      return;
    }
    let alive = true;
    loadAll(source, kind)
      .then(list => {
        if (alive) {
          setAllCache(list);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [kind, query, source]);

  useEffect(() => {
    const timer = setTimeout(() => setPreferred(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    backRef.current = () => {
      if (series) {
        setSeries(null);
        return true;
      }
      return false;
    };
    return () => {
      backRef.current = null;
    };
  }, [backRef, series]);

  useEffect(() => {
    if (kind === 'LIVE' && items.length && !selectedLive) {
      setSelectedLive(items[0]);
    }
  }, [items, kind, selectedLive]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of allCache) {
      const id = item.categoryId || 'outros';
      map[id] = (map[id] || 0) + 1;
    }
    return map;
  }, [allCache]);

  const sidebar = useMemo<SidebarItem[]>(() => {
    const list: SidebarItem[] = [
      {id: FAV, name: 'Favoritos', count: favorites.length},
      {id: RECENT, name: 'Visto recentemente', count: recent.length},
    ];
    if (kind === 'LIVE') {
      list.push({id: '', name: 'Todos os itens', count: allCache.length || items.length});
    }
    for (const cat of categories) {
      list.push({
        id: cat.id,
        name: cat.name,
        count: allCache.length ? counts[cat.id] || 0 : undefined,
      });
    }
    return list;
  }, [allCache.length, categories, counts, favorites.length, items.length, kind, recent.length]);

  const visible = useMemo(() => {
    const text = normalizeText(query);
    if (text.length >= 2) {
      const sourceList = allCache.length ? allCache : items;
      return sortItems(
        sourceList.filter(item => normalizeText(item.name).includes(text)),
        kind,
        sort,
      );
    }
    if (activeCat === FAV) {
      return sortItems(favorites, kind, sort);
    }
    if (activeCat === RECENT) {
      return recent;
    }
    return sortItems(items, kind, sort);
  }, [activeCat, allCache, favorites, items, kind, query, recent, sort]);

  const remember = useCallback(
    (entry: Entry) => {
      void addRecent(entry);
      setRecent(previous => [
        entry,
        ...previous.filter(
          item => !(item.id === entry.id && item.kind === entry.kind),
        ),
      ]);
    },
    [],
  );

  const fav = useCallback((entry: Entry) => {
    void toggleFavorite(entry).then(setFavorites);
  }, []);

  const select = useCallback(
    (entry: Entry, index: number) => {
      remember(entry);
      setSelected(entry);
      if (kind === 'SERIES' && source.mode !== 'XTREAM') {
        onPlay(entry, [entry], {
          list: [entry],
          index: 0,
          autoAdvance: true,
          allowSeek: true,
        });
        return;
      }
      if (kind === 'SERIES') {
        setSeries(entry);
        return;
      }
      if (kind === 'LIVE') {
        onPlay(entry, visible, {
          list: visible,
          index,
          autoAdvance: false,
          allowSeek: false,
        });
        return;
      }
      onPlay(entry, [], {
        list: [],
        index: 0,
        autoAdvance: false,
        allowSeek: true,
      });
    },
    [kind, onPlay, remember, source.mode, visible],
  );

  const title = TITLES[kind];

  if (series) {
    return (
      <View style={styles.root}>
        <Header
          title={series.name}
          subtitle="Escolha um episodio"
          onBack={() => setSeries(null)}
          right={<Button label="Voltar" onPress={() => setSeries(null)} />}
        />
        <EpisodeList
          source={source}
          series={series}
          onPlay={(entry, episodes, index) => {
            remember(entry);
            onPlay(entry, episodes, {
              list: episodes,
              index,
              autoAdvance: true,
              allowSeek: true,
            });
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header
        title={title}
        subtitle={source.label || 'Conta ativa'}
        onBack={onExit}
        right={
          <View style={styles.headerRight}>
            {selected ? (
              <Button
                label={
                  favorites.some(
                    item =>
                      item.id === selected.id && item.kind === selected.kind,
                  )
                    ? '★ Remover'
                    : '☆ Favorito'
                }
                onPress={() => fav(selected)}
              />
            ) : null}
            <Text style={styles.countText}>{visible.length} itens</Text>
          </View>
        }
      />

      <View style={styles.body}>
        <View style={styles.sidebar}>
          <Text style={styles.sidebarTitle}>CATEGORIAS</Text>
          <FlatList
            data={sidebar}
            keyExtractor={item => 'cat-' + item.id}
            style={styles.fill}
            contentContainerStyle={styles.sidebarContent}
            renderItem={({item, index}) => {
              const active = item.id === activeCat;
              return (
                <Focusable
                  accessibilityLabel={item.name}
                  hasTVPreferredFocus={preferred && index === 0}
                  onPress={() => {
                    setQuery('');
                    setActiveCat(item.id);
                  }}
                  style={[styles.catItem, active ? styles.catActive : null]}
                  focusedStyle={styles.catFocused}>
                  <Text
                    numberOfLines={2}
                    style={[styles.catText, active ? styles.catTextActive : null]}>
                    {item.name}
                  </Text>
                  <Text style={styles.catCount}>{item.count}</Text>
                </Focusable>
              );
            }}
          />
        </View>

        {kind === 'LIVE' ? (
          <View style={styles.liveList}>
            <FlatList
              data={visible}
              keyExtractor={(item, index) => 'live-' + item.id + '-' + index}
              style={styles.fill}
              contentContainerStyle={styles.liveContent}
              renderItem={({item, index}) => (
                <Focusable
                  accessibilityLabel={item.name}
                  hasTVPreferredFocus={preferred && index === 0}
                  onPress={() => select(item, index)}
                  onFocus={() => setSelectedLive(item)}
                  style={[
                    styles.liveItem,
                    selectedLive?.id === item.id ? styles.liveItemActive : null,
                  ]}
                  focusedStyle={styles.liveItemFocused}>
                  {item.logo ? (
                    <Image
                      source={{uri: item.logo}}
                      style={styles.liveLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.liveLogo} />
                  )}
                  <Text style={styles.liveName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </Focusable>
              )}
            />
          </View>
        ) : null}

        <View style={styles.content}>
          {kind !== 'LIVE' ? (
            <View style={styles.toolbar}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar em todas as pastas desta aba"
                placeholderTextColor={colors.textDim}
                autoCorrect={false}
                style={styles.search}
              />
              {kind === 'VOD' ? (
                <Button
                  label={SORT_LABELS[sort]}
                  onPress={() =>
                    setSort(current => SORTS[(SORTS.indexOf(current) + 1) % SORTS.length])
                  }
                />
              ) : null}
              {query ? (
                <Button label="Limpar busca" onPress={() => setQuery('')} />
              ) : null}
            </View>
          ) : null}

          {kind === 'LIVE' ? (
            <View style={styles.detail}>
              {error ? (
                <Empty title="Falha ao carregar" detail={error} />
              ) : selectedLive ? (
                <>
                  <Text style={styles.detailCategory} numberOfLines={1}>
                    {selectedLive.category || 'Canal ao vivo'}
                  </Text>
                  <Text style={styles.detailTitle} numberOfLines={2}>
                    {selectedLive.name}
                  </Text>
                  <Text style={styles.liveBadge}>AO VIVO</Text>
                  {selectedLive.plot ? (
                    <Text style={styles.detailPlot} numberOfLines={4}>
                      {selectedLive.plot}
                    </Text>
                  ) : null}
                  <Button
                    kind="primary"
                    label="▶ Assistir"
                    hasTVPreferredFocus
                    onPress={() => {
                      const at = visible.findIndex(
                        item => item.id === selectedLive.id,
                      );
                      select(selectedLive, at >= 0 ? at : 0);
                    }}
                  />
                  <Button
                    label="★ Favorito"
                    onPress={() => fav(selectedLive)}
                  />
                </>
              ) : (
                <Empty title="Selecione um canal" detail="" />
              )}
            </View>
          ) : loading ? (
            <Loading label={'Carregando ' + title.toLowerCase() + '...'} />
          ) : error ? (
            <View style={styles.errorBox}>
              <Empty title="Falha ao carregar" detail={error} />
              <Button
                kind="primary"
                label="Escolher outra pasta"
                onPress={() => setActiveCat(categories[0]?.id || '')}
              />
            </View>
          ) : (
            <FlatList
              ref={gridRef}
              data={visible}
              style={styles.fill}
              keyExtractor={(item, index) => item.kind + ':' + item.id + ':' + index}
              numColumns={4}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContent}
              initialNumToRender={16}
              windowSize={7}
              removeClippedSubviews
              ListEmptyComponent={
                <Empty
                  title="Nada por aqui"
                  detail={
                    query
                      ? 'Nenhum item encontrado para esta busca.'
                      : 'Esta pasta esta vazia.'
                  }
                />
              }
              renderItem={({item, index}) => (
                <Tile
                  entry={item}
                  onPress={() => select(item, index)}
                  onFocus={() => {
                    setSelected(item);
                    try {
                      gridRef.current?.scrollToIndex({
                        index,
                        viewPosition: 0.5,
                        animated: false,
                      });
                    } catch {
                      // Fora da janela renderizada: o foco rola sozinho.
                    }
                  }}
                />
              )}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function EpisodeList({
  source,
  series,
  onPlay,
}: {
  source: SourceConfig;
  series: Entry;
  onPlay: (entry: Entry, episodes: Entry[], index: number) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [episodes, setEpisodes] = useState<Entry[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    const task =
      source.mode === 'XTREAM'
        ? seriesEpisodes(source, series)
        : Promise.resolve([series]);
    task
      .then(list => {
        if (!alive) {
          return;
        }
        setEpisodes(list);
        if (!list.length) {
          setError('Nenhum episodio encontrado para esta serie.');
        }
      })
      .catch(() => {
        if (alive) {
          setError('Nao foi possivel carregar os episodios.');
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [series, source]);

  if (loading) {
    return <Loading label="Carregando episodios..." />;
  }
  if (error) {
    return <Empty title="Sem episodios" detail={error} />;
  }
  return (
    <FlatList
      data={episodes}
      keyExtractor={(item, index) => 'ep-' + item.id + '-' + index}
      style={styles.fill}
      contentContainerStyle={styles.epContent}
      renderItem={({item, index}) => (
        <Focusable
          accessibilityLabel={item.name}
          hasTVPreferredFocus={index === 0}
          onPress={() => onPlay(item, episodes, index)}
          style={styles.epRow}
          focusedStyle={styles.epRowFocused}>
          <Text style={styles.epNum}>{String(index + 1).padStart(2, '0')}</Text>
          <View style={styles.epInfo}>
            <Text style={styles.epName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.plot ? (
              <Text style={styles.epPlot} numberOfLines={2}>
                {item.plot}
              </Text>
            ) : null}
          </View>
          <Text style={styles.epSeason}>{item.category || ''}</Text>
        </Focusable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countText: {
    color: colors.textDim,
    fontSize: 12,
    marginLeft: space.md,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 196,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    backgroundColor: colors.bgSoft,
    paddingTop: space.md,
  },
  sidebarTitle: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  sidebarContent: {
    paddingHorizontal: space.sm,
    paddingBottom: space.lg,
  },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    marginBottom: 2,
  },
  catActive: {
    backgroundColor: colors.panel,
  },
  catFocused: {
    backgroundColor: colors.panelSoft,
  },
  catText: {
    color: colors.textSoft,
    fontSize: 13,
    flex: 1,
    paddingRight: space.xs,
  },
  catTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  catCount: {
    color: colors.textDim,
    fontSize: 11,
  },
  liveList: {
    width: 300,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    backgroundColor: colors.bgSoft,
  },
  liveContent: {
    padding: space.sm,
  },
  liveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    marginBottom: 4,
  },
  liveItemActive: {
    backgroundColor: colors.panel,
  },
  liveItemFocused: {
    backgroundColor: colors.panelSoft,
  },
  liveLogo: {
    width: 44,
    height: 32,
    marginRight: space.sm,
  },
  liveName: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
  },
  detail: {
    flex: 1,
    padding: space.xl,
    justifyContent: 'center',
  },
  detailCategory: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: space.sm,
  },
  detailTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
  },
  liveBadge: {
    alignSelf: 'flex-start',
    color: colors.bg,
    backgroundColor: colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    marginTop: space.md,
  },
  detailPlot: {
    color: colors.textDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: space.md,
    marginBottom: space.lg,
    maxWidth: 640,
  },
  content: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: space.md,
  },
  search: {
    flex: 1,
    maxWidth: 460,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: space.md,
    fontSize: 14,
    marginRight: space.md,
  },
  gridRow: {
    justifyContent: 'flex-start',
  },
  gridContent: {
    paddingBottom: space.xl,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  epContent: {
    padding: space.lg,
    paddingBottom: space.xl,
  },
  epRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    marginBottom: space.sm,
  },
  epRowFocused: {
    backgroundColor: colors.panelSoft,
  },
  epNum: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
    width: 46,
  },
  epInfo: {
    flex: 1,
    paddingRight: space.md,
  },
  epName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  epPlot: {
    color: colors.textDim,
    fontSize: 12,
    marginTop: 3,
    lineHeight: 17,
  },
  epSeason: {
    color: colors.textDim,
    fontSize: 11,
  },
});
