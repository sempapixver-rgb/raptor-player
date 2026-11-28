import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Button,
  Empty,
  Focusable,
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
import {clearPlaylistCache} from '../core/m3u';
import {readJSON, writeJSON} from '../core/storage';
import {seriesEpisodes} from '../core/xtream';
import type {Category, Entry, Kind, PlayHandler, SourceConfig} from '../types';
import {colors, f, radius, s, screenWidth} from '../theme';

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

const folderKey = (source: SourceConfig, kind: Kind) =>
  'folder.' +
  source.mode +
  '.' +
  (source.baseUrl || source.m3uUrl || source.label || '') +
  '.' +
  kind;

/** Tela de navegacao: topbar + painel de categorias + lista + previa,
 *  exatamente como na LG. */
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
  const [series, setSeries] = useState<Entry | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [clock, setClock] = useState('--:--');

  const gridRef = useRef<FlatList<Entry>>(null);
  const [preferred, setPreferred] = useState(true);
  const key = folderKey(source, kind);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        String(now.getHours()).padStart(2, '0') +
          ':' +
          String(now.getMinutes()).padStart(2, '0'),
      );
    };
    tick();
    const timer = setInterval(tick, 15000);
    return () => clearInterval(timer);
  }, []);

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
          if (!cats.length) {
            setLoading(false);
          }
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
  }, [key, kind, refresh, source]);

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
          // Trocar de pasta troca a previa; atualizar a mesma pasta mantem
          // o item que o usuario estava vendo.
          setSelected(atual =>
            atual && list.some(item => item.id === atual.id)
              ? atual
              : list.length
                ? list[0]
                : null,
          );
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
  }, [activeCat, categories, key, kind, refresh, source]);

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

  // Indice completo apenas quando o usuario digita (2+ letras).
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
      return sourceList.filter(item => normalizeText(item.name).includes(text));
    }
    if (activeCat === FAV) {
      return favorites;
    }
    if (activeCat === RECENT) {
      return recent;
    }
    return items;
  }, [activeCat, allCache, favorites, items, query, recent]);

  const remember = useCallback((entry: Entry) => {
    void addRecent(entry);
    setRecent(previous => [
      entry,
      ...previous.filter(
        item => !(item.id === entry.id && item.kind === entry.kind),
      ),
    ]);
  }, []);

  const fav = useCallback((entry: Entry) => {
    void toggleFavorite(entry).then(setFavorites);
  }, []);

  const select = useCallback(
    (entry: Entry, index: number) => {
      remember(entry);
      setSelected(entry);
      if (kind === 'SERIES' && source.mode !== 'DEMO') {
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
      onPlay(entry, visible.length ? visible : [entry], {
        list: visible.length ? visible : [entry],
        index: visible.length ? index : 0,
        autoAdvance: false,
        allowSeek: true,
      });
    },
    [kind, onPlay, remember, source.mode, visible],
  );

  if (series) {
    return (
      <View style={styles.root}>
        <View style={styles.detailHead}>
          <Button label="‹ Voltar" onPress={() => setSeries(null)} />
          <Text style={styles.detailTitle} numberOfLines={1}>
            {series.name}
          </Text>
        </View>
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
      {/* topbar */}
      <View style={styles.topbar}>
        <Focusable
          accessibilityLabel="Menu principal"
          onPress={onExit}
          style={styles.topMenu}>
          <Text style={styles.topMenuText}>‹</Text>
        </Focusable>
        <Text style={styles.brandLogo}>RAPTOR</Text>
        <View style={styles.titles}>
          <Text style={styles.tabTitle}>{TITLES[kind]}</Text>
          <Text style={styles.tabSub} numberOfLines={1}>
            {source.label || 'Conta ativa'}
          </Text>
        </View>
        <View style={styles.topbarRight}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar por nome"
            placeholderTextColor={colors.textDim}
            autoCorrect={false}
            style={styles.search}
          />
          <Text style={styles.clock}>{clock}</Text>
          <Button
            label="⟳ Atualizar"
            onPress={() => {
              clearPlaylistCache();
              setRefresh(value => value + 1);
            }}
          />
        </View>
      </View>

      <View style={styles.body}>
        {/* painel de categorias */}
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>CATEGORIAS</Text>
          <FlatList
            data={sidebar}
            keyExtractor={item => 'cat-' + item.id}
            style={styles.fill}
            contentContainerStyle={styles.panelContent}
            renderItem={({item, index}) => {
              const active = item.id === activeCat;
              return (
                <Focusable
                  accessibilityLabel={item.name}
                  hasTVPreferredFocus={preferred && index === 0}
                  onPress={() => {
                    setQuery('');
                    setSelected(null);
                    setActiveCat(item.id);
                  }}
                  style={[styles.panelItem, active ? styles.panelItemActive : null]}
                  focusedStyle={styles.panelItemFocused}>
                  <Text
                    numberOfLines={1}
                    style={[styles.panelItemLabel, active ? styles.panelItemLabelActive : null]}>
                    {item.name}
                  </Text>
                  {item.count != null ? (
                    <Text style={styles.panelItemCount}>{item.count}</Text>
                  ) : null}
                </Focusable>
              );
            }}
          />
        </View>

        {/* lista */}
        <View style={styles.listPane}>
          {loading ? (
            <Loading label={'Carregando ' + TITLES[kind].toLowerCase() + '...'} />
          ) : error ? (
            <Empty title="Falha ao carregar" detail={error} />
          ) : kind === 'LIVE' ? (
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
                  onFocus={() => setSelected(item)}
                  style={[
                    styles.itemRow,
                    selected?.id === item.id ? styles.itemRowSelected : null,
                  ]}
                  focusedStyle={styles.itemRowFocused}>
                  <Text style={styles.itemNum}>{String(index + 1).padStart(2, '0')}</Text>
                  {item.logo ? (
                    <Image
                      source={{uri: item.logo}}
                      style={styles.itemLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <View style={styles.itemLogo} />
                  )}
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </Focusable>
              )}
            />
          ) : (
            <FlatList
              ref={gridRef}
              data={visible}
              style={styles.fill}
              numColumns={4}
              keyExtractor={(item, index) => item.kind + ':' + item.id + ':' + index}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContent}
              initialNumToRender={16}
              windowSize={7}
              removeClippedSubviews
              ListEmptyComponent={
                <Empty
                  title="Nada por aqui"
                  detail={query ? 'Nenhum item encontrado.' : 'Esta pasta esta vazia.'}
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

        {/* previa */}
        {selected ? (
          <View style={styles.preview}>
            <ScrollView contentContainerStyle={styles.previewScroll}>
              <Text style={styles.previewBadge}>
                {kind === 'LIVE' ? 'AO VIVO' : kind === 'SERIES' ? 'SERIE' : 'FILME'}
              </Text>
              <Text style={styles.previewTitle} numberOfLines={2}>
                {selected.name}
              </Text>
              <Text style={styles.previewMeta} numberOfLines={1}>
                {selected.category || TITLES[kind]}
              </Text>
              {selected.plot ? (
                <Text style={styles.previewPlot} numberOfLines={5}>
                  {selected.plot}
                </Text>
              ) : null}
              <View style={styles.previewActions}>
                <Button
                  label={
                    favorites.some(
                      item =>
                        item.id === selected.id && item.kind === selected.kind,
                    )
                      ? '★'
                      : '☆'
                  }
                  onPress={() => fav(selected)}
                />
                <Button
                  kind="primary"
                  label="▶ Assistir"
                  onPress={() => {
                    const at = visible.findIndex(
                      item => item.id === selected.id,
                    );
                    select(selected, at >= 0 ? at : 0);
                  }}
                />
              </View>
            </ScrollView>
          </View>
        ) : null}
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
          style={styles.episode}
          focusedStyle={styles.episodeFocused}>
          <Text style={styles.episodeNum}>{String(index + 1).padStart(2, '0')}</Text>
          <Text style={styles.episodeName} numberOfLines={1}>
            {item.name}
          </Text>
        </Focusable>
      )}
    />
  );
}

const panelWidth = s(330);
const previewWidth = s(570);

const styles = StyleSheet.create({
  fill: {flex: 1},
  root: {flex: 1, backgroundColor: colors.bg},
  topbar: {
    height: s(100),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(38),
    backgroundColor: 'rgba(27,38,30,0.55)',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  topMenu: {
    width: s(62),
    height: s(62),
    borderRadius: s(12),
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: s(18),
  },
  topMenuText: {color: colors.textSoft, fontSize: f(34)},
  brandLogo: {
    color: colors.accent,
    fontSize: f(26),
    fontWeight: '900',
    letterSpacing: s(6),
  },
  titles: {marginLeft: s(26), flex: 1},
  tabTitle: {color: colors.text, fontSize: f(38), fontWeight: '700'},
  tabSub: {color: colors.textSoft, fontSize: f(20), marginTop: 2},
  topbarRight: {flexDirection: 'row', alignItems: 'center'},
  search: {
    width: s(400),
    height: s(52),
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: s(12),
    paddingHorizontal: s(12),
    color: colors.text,
    fontSize: f(20),
    marginRight: s(22),
    backgroundColor: '#0D1410',
  },
  clock: {color: colors.textSoft, fontSize: f(24), marginRight: s(24)},
  body: {flex: 1, flexDirection: 'row'},
  panel: {
    width: panelWidth,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    backgroundColor: 'rgba(27,38,30,0.35)',
    paddingTop: s(12),
  },
  panelLabel: {
    color: colors.textDim,
    fontSize: f(15),
    fontWeight: '700',
    letterSpacing: s(2),
    paddingHorizontal: s(12),
    paddingBottom: s(12),
  },
  panelContent: {paddingHorizontal: s(12), paddingBottom: s(24)},
  panelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(14),
    paddingVertical: s(13),
    borderRadius: s(10),
    marginBottom: s(3),
  },
  panelItemActive: {backgroundColor: 'rgba(0,230,118,0.18)'},
  panelItemFocused: {borderColor: colors.accent, backgroundColor: colors.panelSoft},
  panelItemLabel: {color: colors.textSoft, fontSize: f(26), flex: 1},
  panelItemLabelActive: {color: colors.accent, fontWeight: '700'},
  panelItemCount: {color: colors.textDim, fontSize: f(13), marginLeft: s(10)},
  listPane: {flex: 1, paddingTop: s(14), paddingLeft: s(24), paddingRight: s(32)},
  liveContent: {padding: s(6)},
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(12),
    paddingVertical: s(9),
    borderRadius: s(8),
    marginBottom: s(4),
  },
  itemRowSelected: {backgroundColor: 'rgba(0,230,118,0.14)'},
  itemRowFocused: {borderColor: colors.accent, backgroundColor: colors.panelSoft},
  itemNum: {color: colors.textDim, fontSize: f(19), width: s(60)},
  itemLogo: {width: s(72), height: s(56), marginRight: s(16), borderRadius: s(7)},
  itemName: {flex: 1, color: colors.text, fontSize: f(28)},
  gridRow: {flexDirection: 'row'},
  gridContent: {paddingBottom: s(30)},
  preview: {
    width: previewWidth,
    borderLeftWidth: 1,
    borderLeftColor: colors.line,
    marginLeft: s(24),
    minWidth: 0,
  },
  previewScroll: {padding: s(24), paddingBottom: s(40)},
  previewBadge: {
    color: colors.bg,
    backgroundColor: colors.accent,
    alignSelf: 'flex-start',
    fontSize: f(13),
    fontWeight: '800',
    letterSpacing: s(2),
    paddingHorizontal: s(12),
    paddingVertical: s(5),
    borderRadius: 999,
  },
  previewTitle: {color: colors.text, fontSize: f(32), fontWeight: '700', marginTop: s(16)},
  previewMeta: {color: colors.accent, fontSize: f(20), marginTop: s(6)},
  previewPlot: {color: colors.textSoft, fontSize: f(20), lineHeight: f(30), marginTop: s(10)},
  previewActions: {flexDirection: 'row', marginTop: s(18)},
  detailHead: {
    height: s(100),
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(60),
  },
  detailTitle: {color: colors.text, fontSize: f(46), fontWeight: '700', marginLeft: s(24)},
  epContent: {paddingHorizontal: s(60), paddingBottom: s(40)},
  episode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: s(20),
    paddingVertical: s(16),
    borderRadius: s(10),
    backgroundColor: colors.panel,
    marginBottom: s(9),
  },
  episodeFocused: {borderColor: colors.accent, backgroundColor: colors.panelSoft},
  episodeNum: {color: colors.accent, fontSize: f(18), fontWeight: '800', width: s(66)},
  episodeName: {flex: 1, color: colors.text, fontSize: f(22)},
  // Largura usada apenas como referência de composição (LG: 1920px).
  reference: {width: screenWidth},
});
