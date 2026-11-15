package com.reptor.player.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * Cache da lista no mesmo modelo da TV (LG 1.0.21):
 *
 *  - ao entrar no app baixa só as PASTAS (categorias) das três abas — resposta
 *    pequena e rápida, então Canais/Filmes/Séries abrem sem "Carregando…";
 *  - cada aba baixa só a pasta escolhida. Nunca pede todos os filmes/séries de
 *    uma vez (são vários MB e derrubavam o Fire TV Stick antigo);
 *  - a pasta fica guardada e volta na hora ao trocar de aba;
 *  - no máximo 8 pastas em memória, porque o Fire TV Stick antigo tem pouca RAM.
 */
object ContentStore {

    private const val MAX_FOLDERS = 4

    private val lock = Any()
    private val mutexes = HashMap<String, Mutex>()

    private val categoryCache = HashMap<String, List<Category>>()
    private val itemCache = HashMap<String, List<MediaEntry>>()
    private val itemOrder = ArrayList<String>()
    private val lastFolder = HashMap<String, String>()

    // Índice de busca: só a aba atual fica na memória, como na LG.
    private var searchBase: String? = null
    private var searchKind: MediaKind? = null
    private var searchList: List<MediaEntry>? = null

    private fun mutexFor(key: String): Mutex = synchronized(lock) {
        mutexes.getOrPut(key) { Mutex() }
    }

    private fun catKey(base: String, kind: MediaKind): String = "$base|CAT|${kind.name}"

    private fun itemKey(base: String, kind: MediaKind, categoryId: String?): String =
        "$base|ITEMS|${kind.name}|${categoryId.orEmpty()}"

    private fun folderKey(base: String, kind: MediaKind): String = "$base|LAST|${kind.name}"

    // ------------------------------------------------------------ leitura local

    /** Pastas já baixadas, sem tocar na rede. */
    fun cachedCategories(base: String, kind: MediaKind): List<Category>? =
        synchronized(lock) { categoryCache[catKey(base, kind)] }

    /** Itens de uma pasta já baixados, sem tocar na rede. */
    fun cachedItems(base: String, kind: MediaKind, categoryId: String?): List<MediaEntry>? =
        synchronized(lock) { itemCache[itemKey(base, kind, categoryId)] }

    /** Última pasta aberta nesta aba (para voltar nela). */
    fun lastFolder(base: String, kind: MediaKind): String? =
        synchronized(lock) { lastFolder[folderKey(base, kind)] }

    fun rememberFolder(base: String, kind: MediaKind, categoryId: String?) {
        synchronized(lock) {
            val key = folderKey(base, kind)
            if (categoryId.isNullOrBlank()) lastFolder.remove(key)
            else lastFolder[key] = categoryId
        }
    }

    // ------------------------------------------------------------------- carga

    /**
     * Pastas da aba. Uma chamada por aba: se outra tela já estiver baixando a
     * mesma lista, esta espera e reaproveita o resultado.
     */
    suspend fun categories(
        source: PlaylistSource,
        base: String,
        kind: MediaKind,
        force: Boolean = false
    ): List<Category> = mutexFor(catKey(base, kind)).withLock {
        val key = catKey(base, kind)
        if (!force) {
            synchronized(lock) { categoryCache[key] }?.let { return@withLock it }
        }
        val list = source.categories(kind)
        synchronized(lock) { categoryCache[key] = list }
        list
    }

    /**
     * Itens de UMA pasta (null = "Tudo", usado só em Canais).
     * Guarda no máximo [MAX_FOLDERS] pastas, como a versão da LG.
     */
    suspend fun items(
        source: PlaylistSource,
        base: String,
        kind: MediaKind,
        categoryId: String?,
        force: Boolean = false
    ): List<MediaEntry> = mutexFor(itemKey(base, kind, categoryId)).withLock {
        val key = itemKey(base, kind, categoryId)
        if (!force) {
            synchronized(lock) { itemCache[key] }?.let { return@withLock it }
        }
        val list = source.items(kind, categoryId)
        synchronized(lock) {
            itemCache[key] = list
            itemOrder.remove(key)
            itemOrder.add(key)
            trimLocked(key)
        }
        list
    }

    /** Mantém no máximo 8 pastas em memória (TV tem pouca RAM). */
    private fun trimLocked(current: String) {
        while (itemOrder.size > MAX_FOLDERS) {
            val old = itemOrder.removeAt(0)
            if (old != current) itemCache.remove(old)
        }
    }

    // ------------------------------------------------------------------- busca

    /**
     * Índice de busca da aba já baixado (se for a mesma aba do índice atual).
     * Só a aba mais recente fica guardada, como na versão da LG.
     */
    fun cachedSearch(base: String, kind: MediaKind): List<MediaEntry>? = synchronized(lock) {
        if (searchBase == base && searchKind == kind) searchList else null
    }

    /**
     * Busca em TODAS as pastas da aba (igual à LG 1.0.21).
     *
     * Só é chamada quando o usuário digita 2+ letras — nunca na entrada do app.
     * Guarda uma cópia enxuta (sem sinopse) para não pesar na memória do Fire TV
     * Stick antigo. Fica na memória até o botão "Atualizar".
     */
    suspend fun searchIndex(
        source: PlaylistSource,
        base: String,
        kind: MediaKind
    ): List<MediaEntry> = mutexFor("$base|SEARCH|${kind.name}").withLock {
        synchronized(lock) {
            if (searchBase == base && searchKind == kind) {
                searchList?.let { return@withLock it }
            }
        }

        val all = source.items(kind, null)
        val lean = withContext(Dispatchers.Default) {
            all.map { entry ->
                MediaEntry(
                    id = entry.id,
                    name = entry.name,
                    logo = entry.logo,
                    categoryId = entry.categoryId,
                    kind = entry.kind,
                    containerExtension = entry.containerExtension,
                    directUrl = entry.directUrl,
                    rating = entry.rating,
                    plot = null,
                    year = entry.year
                )
            }
        }
        synchronized(lock) {
            searchBase = base
            searchKind = kind
            searchList = lean
        }
        lean
    }

    /**
     * Adianta só as pastas das três abas. É o que a LG faz ao entrar: pequeno,
     * rápido e sem baixar filmes/séries inteiros.
     */
    suspend fun preloadCategories(source: PlaylistSource, base: String) {
        for (kind in listOf(MediaKind.LIVE, MediaKind.VOD, MediaKind.SERIES)) {
            runCatching { categories(source, base, kind) }
        }
    }

    // ------------------------------------------------------------------ limpeza

    /** Botão "Atualizar": esquece pastas e itens guardados. */
    fun clearAll() {
        synchronized(lock) {
            categoryCache.clear()
            itemCache.clear()
            itemOrder.clear()
            searchBase = null
            searchKind = null
            searchList = null
        }
    }
}
