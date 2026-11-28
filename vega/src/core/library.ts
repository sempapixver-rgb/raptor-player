import type {Category, Entry, Kind, SourceConfig} from '../types';
import {demoItems, demoLive} from './demo';
import {loadPlaylist} from './m3u';
import {allItems, categories as fetchCategories, items as fetchItems} from './xtream';

export type SectionData = {
  categories: Category[];
  items: Entry[];
};

function categoriesOf(items: Entry[]): Category[] {
  const seen: Record<string, boolean> = {};
  const list: Category[] = [];
  for (const item of items) {
    const id = item.categoryId || 'outros';
    if (!seen[id]) {
      seen[id] = true;
      list.push({id, name: item.category || 'Outros'});
    }
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function inFolder(items: Entry[], categoryId: string): Entry[] {
  if (!categoryId) {
    return items;
  }
  return items.filter(item => (item.categoryId || 'outros') === categoryId);
}

async function allOf(source: SourceConfig, kind: Kind): Promise<Entry[]> {
  if (source.mode === 'DEMO') {
    return kind === 'LIVE' ? demoLive : kind === 'VOD' ? demoItems : [];
  }
  if (source.mode === 'M3U') {
    return (await loadPlaylist(source.m3uUrl || '')).items[kind];
  }
  return allItems(source, kind).catch(() => [] as Entry[]);
}

export async function loadCategories(
  source: SourceConfig,
  kind: Kind,
): Promise<Category[]> {
  if (source.mode === 'DEMO') {
    return categoriesOf(await allOf(source, kind));
  }
  if (source.mode === 'M3U') {
    return (await loadPlaylist(source.m3uUrl || '')).categories[kind];
  }
  const cats = await fetchCategories(source, kind).catch(() => [] as Category[]);
  if (cats.length) {
    return cats;
  }
  return categoriesOf(await allOf(source, kind));
}

/**
 * Carrega somente a pasta escolhida, como no Fire OS. Filmes e series nunca
 * entram em "Todos": a lista inteira e pesada demais.
 */
export async function loadFolder(
  source: SourceConfig,
  kind: Kind,
  categoryId: string,
  categoryName?: string,
): Promise<Entry[]> {
  if (source.mode === 'DEMO' || source.mode === 'M3U') {
    return inFolder(await allOf(source, kind), categoryId);
  }
  // Erro precisa chegar à tela: engoli-lo aqui fazia a pasta parecer vazia.
  const list = await fetchItems(source, kind, categoryId);
  return list.map(item => ({
    ...item,
    category: item.category || categoryName || 'Outros',
  }));
}

/** Indice completo, usado só na busca (2+ letras) e em Favoritos/Recentes. */
export async function loadAll(
  source: SourceConfig,
  kind: Kind,
): Promise<Entry[]> {
  const items = await allOf(source, kind);
  if (source.mode !== 'XTREAM') {
    return items;
  }
  const cats = await fetchCategories(source, kind).catch(() => [] as Category[]);
  const nameById: Record<string, string> = {};
  for (const cat of cats) {
    nameById[cat.id] = cat.name;
  }
  return items.map(item => ({
    ...item,
    category:
      (item.categoryId && nameById[item.categoryId]) || item.category || 'Outros',
  }));
}

/** Compatibilidade com o carregador antigo. */
export async function loadSection(
  source: SourceConfig,
  kind: Kind,
): Promise<SectionData> {
  const [categories, items] = await Promise.all([
    loadCategories(source, kind),
    loadAll(source, kind),
  ]);
  return {categories, items};
}
