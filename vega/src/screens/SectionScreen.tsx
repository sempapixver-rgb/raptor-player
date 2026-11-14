import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  FlatList,
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
import {loadSection} from '../core/library';
import {seriesEpisodes} from '../core/xtream';
import type {Category, Entry, Kind, SourceConfig} from '../types';
import {colors, radius, space} from '../theme';

const TITLES: Record<Kind, string> = {
  LIVE: 'Canais',
  VOD: 'Filmes',
  SERIES: 'Series',
};

type Props = {
  source: SourceConfig;
  kind: Kind;
  onExit: () => void;
  onPlay: (entry: Entry, list: Entry[]) => void;
  backRef: React.MutableRefObject<(() => boolean) | null>;
};

type SidebarItem = Category & {count: number};

export function SectionScreen({source, kind, onExit, onPlay, backRef}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Entry[]>([]);
  const [activeCat, setActiveCat] = useState('');
  const [query, setQuery] = useState('');
  const [series, setSeries] = useState<Entry | null>(null);

  const gridRef = useRef<FlatList<Entry>>(null);
  const [preferred, setPreferred] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loadSection(source, kind);
      setCategories(data.categories);
      setItems(data.items);
    } catch {
      setError('Nao foi possivel carregar agora. Confira a conexao.');
    } finally {
      setLoading(false);
    }
  }, [source, kind]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPreferred(false);
    }, 1500);
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
    for (const item of items) {
      const id = item.categoryId || 'outros';
      map[id] = (map[id] || 0) + 1;
    }
    return map;
  }, [items]);

  const sidebar = useMemo<SidebarItem[]>(() => {
    const all: SidebarItem[] = [
      {id: '', name: 'Todos os itens', count: items.length},
    ];
    for (const cat of categories) {
      all.push({id: cat.id, name: cat.name, count: counts[cat.id] || 0});
    }
    return all;
  }, [categories, counts, items.length]);

  const visible = useMemo(() => {
    const text = normalizeText(query);
    if (text) {
      return items.filter(item => normalizeText(item.name).includes(text));
    }
    if (!activeCat) {
      return items;
    }
    return items.filter(item => item.categoryId === activeCat);
  }, [items, activeCat, query]);

  const openSeries = useCallback((entry: Entry) => {
    setSeries(entry);
  }, []);

  const select = useCallback(
    (entry: Entry) => {
      if (kind === 'SERIES' && source.mode === 'XTREAM') {
        openSeries(entry);
        return;
      }
      onPlay(entry, visible);
    },
    [kind, openSeries, onPlay, source.mode, visible],
  );

  const title = TITLES[kind];

  if (series) {
    return (
      <View style={styles.root}>
        <Header
          title={series.name}
          subtitle="Escolha um episodio"
          onBack={onExit}
          right={<Button label="Voltar" onPress={() => setSeries(null)} />}
        />
        <EpisodeList source={source} series={series} onPlay={onPlay} />
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
            <Text style={styles.countText}>{visible.length} itens</Text>
            <Button label="Atualizar" onPress={reload} />
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

        <View style={styles.content}>
          <View style={styles.toolbar}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar em todas as pastas desta aba"
              placeholderTextColor={colors.textDim}
              autoCorrect={false}
              style={styles.search}
            />
            {query ? (
              <Button label="Limpar busca" onPress={() => setQuery('')} />
            ) : null}
          </View>

          {loading ? (
            <Loading label={'Carregando ' + title.toLowerCase() + '...'} />
          ) : error ? (
            <View style={styles.errorBox}>
              <Empty title="Falha ao carregar" detail={error} />
              <Button kind="primary" label="Tentar de novo" onPress={reload} />
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
                  onPress={() => select(item)}
                  onFocus={() => {
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
  onPlay: (entry: Entry, list: Entry[]) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [episodes, setEpisodes] = useState<Entry[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    if (source.mode !== 'XTREAM') {
      setLoading(false);
      setError('Este item nao possui lista de episodios.');
      return;
    }
    seriesEpisodes(source, series)
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
  }, [source, series]);

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
          onPress={() => onPlay(item, episodes)}
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
    marginRight: space.md,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 268,
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
