import type {Category, Entry, Kind, SourceConfig} from '../types';
import {demoItems, demoLive} from './demo';
import {loadPlaylist} from './m3u';
import {allItems, categories as fetchCategories} from './xtream';

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
  return list;
}

/** Carrega categorias e todos os itens de uma aba. */
export async function loadSection(
  source: SourceConfig,
  kind: Kind,
): Promise<SectionData> {
  if (source.mode === 'DEMO') {
    const items = kind === 'LIVE' ? demoLive : kind === 'VOD' ? demoItems : [];
    return {categories: categoriesOf(items), items};
  }

  if (source.mode === 'M3U') {
    const playlist = await loadPlaylist(source.m3uUrl || '');
    return {
      categories: playlist.categories[kind],
      items: playlist.items[kind],
    };
  }

  const [cats, list] = await Promise.all([
    fetchCategories(source, kind).catch(() => [] as Category[]),
    allItems(source, kind).catch(() => [] as Entry[]),
  ]);

  const nameById: Record<string, string> = {};
  for (const cat of cats) {
    nameById[cat.id] = cat.name;
  }
  const items = list.map(item => ({
    ...item,
    category:
      (item.categoryId && nameById[item.categoryId]) || item.category || 'Outros',
  }));

  return {
    categories: cats.length ? cats : categoriesOf(items),
    items,
  };
}
