package com.raptor.player.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import com.raptor.player.RaptorApp
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

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

    // ------------------------------------------------------- cache em disco
    //
    // As pastas são pequenas. Guardar em disco faz o app abrir na hora, mesmo
    // na primeira vez do dia, sem esperar a rede. O "Atualizar" apaga tudo.

    private const val CATEGORY_TTL_MS = 12L * 60L * 60L * 1000L

    private fun categoryFile(key: String): File? = runCatching {
        File(RaptorApp.instance.cacheDir, "cats_${Integer.toHexString(key.hashCode())}.json")
    }.getOrNull()

    private fun readCategoriesFromDisk(key: String): List<Category>? = runCatching {
        val file = categoryFile(key) ?: return@runCatching null
        if (!file.exists()) return@runCatching null
        if (System.currentTimeMillis() - file.lastModified() > CATEGORY_TTL_MS) {
            return@runCatching null
        }
        val arr = JSONArray(file.readText())
        val out = ArrayList<Category>(arr.length())
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            val id = obj.optString("id")
            if (id.isBlank()) continue
            out.add(Category(id, obj.optString("name")))
        }
        out.takeIf { it.isNotEmpty() }
    }.getOrNull()

    private fun writeCategoriesToDisk(key: String, list: List<Category>) {
        runCatching {
            val file = categoryFile(key) ?: return@runCatching
            val arr = JSONArray()
            list.forEach { category ->
                arr.put(
                    JSONObject().apply {
                        put("id", category.id)
                        put("name", category.name)
                    }
                )
            }
            file.writeText(arr.toString())
        }
    }

    // Itens de uma pasta: em Filmes/Séries a resposta pode passar de 1 MB.
    // Depois da primeira abertura, o disco devolve a pasta na hora.

    private const val ITEM_TTL_MS = 24L * 60L * 60L * 1000L
    private const val MAX_ITEM_FILES = 8

    private fun itemFile(key: String): File? = runCatching {
        File(RaptorApp.instance.cacheDir, "items_${Integer.toHexString(key.hashCode())}.json")
    }.getOrNull()

    private fun readItemsFromDisk(key: String): List<MediaEntry>? = runCatching {
        val file = itemFile(key) ?: return@runCatching null
        if (!file.exists()) return@runCatching null
        if (System.currentTimeMillis() - file.lastModified() > ITEM_TTL_MS) {
            return@runCatching null
        }
        val arr = JSONArray(file.readText())
        val out = ArrayList<MediaEntry>(arr.length())
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            val id = obj.optString("id")
            if (id.isBlank()) continue
            val kind = runCatching { MediaKind.valueOf(obj.optString("kind")) }
                .getOrDefault(MediaKind.LIVE)
            val extras = ArrayList<String>()
            obj.optJSONArray("categoryIds")?.let { ids ->
                for (j in 0 until ids.length()) {
                    val value = ids.optString(j)
                    if (value.isNotBlank()) extras.add(value)
                }
            }
            out.add(
                MediaEntry(
                    id = id,
                    name = obj.optString("name"),
                    logo = obj.optString("logo").takeIf { it.isNotBlank() },
                    categoryId = obj.optString("categoryId").takeIf { it.isNotBlank() },
                    kind = kind,
                    containerExtension = obj.optString("ext").takeIf { it.isNotBlank() },
                    directUrl = obj.optString("directUrl").takeIf { it.isNotBlank() },
                    rating = obj.optDouble("rating").takeIf { !it.isNaN() && it > 0 },
                    plot = null,
                    year = obj.optString("year").takeIf { it.isNotBlank() },
                    categoryIds = extras
                )
            )
        }
        out.takeIf { it.isNotEmpty() }
    }.getOrNull()

    private fun writeItemsToDisk(key: String, list: List<MediaEntry>) {
        runCatching {
            val file = itemFile(key) ?: return@runCatching
            val arr = JSONArray()
            list.forEach { entry ->
                arr.put(
                    JSONObject().apply {
                        put("id", entry.id)
                        put("name", entry.name)
                        put("logo", entry.logo ?: "")
                        put("categoryId", entry.categoryId ?: "")
                        put("kind", entry.kind.name)
                        put("ext", entry.containerExtension ?: "")
                        put("directUrl", entry.directUrl ?: "")
                        put("rating", entry.rating ?: 0.0)
                        put("year", entry.year ?: "")
                        if (entry.categoryIds.isNotEmpty()) {
                            put("categoryIds", JSONArray(entry.categoryIds))
                        }
                    }
                )
            }
            file.writeText(arr.toString())
            trimItemFiles(file)
        }
    }

    /** Mantém só os últimos [MAX_ITEM_FILES] arquivos de pasta no disco. */
    private fun trimItemFiles(keep: File) {
        runCatching {
            val others = RaptorApp.instance.cacheDir
                .listFiles { file -> file.name.startsWith("items_") && file != keep }
                ?.sortedBy { it.lastModified() }
                ?: return@runCatching
            var excess = others.size - (MAX_ITEM_FILES - 1)
            for (file in others) {
                if (excess <= 0) break
                file.delete()
                excess--
            }
        }
    }

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
            // Disco: abertura instantânea, sem esperar a rede.
            withContext(Dispatchers.IO) { readCategoriesFromDisk(key) }?.let {
                synchronized(lock) { categoryCache[key] = it }
                return@withLock it
            }
        }
        val list = source.categories(kind)
        synchronized(lock) { categoryCache[key] = list }
        if (list.isNotEmpty()) {
            withContext(Dispatchers.IO) { writeCategoriesToDisk(key, list) }
        }
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
            // Só pastas vão para o disco. "Tudo" (null) é grande demais e o
            // usuário só abre quando quer.
            if (categoryId != null) {
                withContext(Dispatchers.IO) { readItemsFromDisk(key) }?.let { disk ->
                    synchronized(lock) {
                        itemCache[key] = disk
                        itemOrder.remove(key)
                        itemOrder.add(key)
                        trimLocked(key)
                    }
                    return@withLock disk
                }
            }
        }
        val list = source.items(kind, categoryId)
        synchronized(lock) {
            itemCache[key] = list
            itemOrder.remove(key)
            itemOrder.add(key)
            trimLocked(key)
        }
        if (categoryId != null && list.isNotEmpty()) {
            withContext(Dispatchers.IO) { writeItemsToDisk(key, list) }
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
     * Primeira pasta com conteúdo. Alguns provedores devolvem categorias erradas
     * (ex.: 34 pastas de "Séries" dentro de Filmes, todas vazias). Testa as
     * primeiras pastas e devolve a primeira com itens — é o mesmo fallback da
     * versão da LG/Tizen. O resultado já fica no cache de itens.
     */
    suspend fun firstNonEmptyCategory(
        source: PlaylistSource,
        base: String,
        kind: MediaKind,
        cats: List<Category>,
        maxTries: Int = 6
    ): String? {
        if (cats.isEmpty()) return null
        // Já existe pasta cacheada com conteúdo? Reaproveita, sem rede.
        synchronized(lock) {
            val prefix = "$base|ITEMS|${kind.name}|"
            for (entry in itemOrder) {
                if (!entry.startsWith(prefix)) continue
                val id = entry.substring(prefix.length)
                if (id.isNotEmpty() && !itemCache[entry].isNullOrEmpty()) return id
            }
        }
        val start = cats.indexOfFirst { it.id == lastFolder(base, kind) }.let { if (it < 0) 0 else it }
        for (i in 0 until minOf(maxTries, cats.size)) {
            val cat = cats[(start + i) % cats.size]
            if (!cachedItems(base, kind, cat.id).isNullOrEmpty()) return cat.id
            val list = runCatching { items(source, base, kind, cat.id) }.getOrDefault(emptyList())
            if (list.isNotEmpty()) return cat.id
        }
        return null
    }

    /**
     * Adianta só as pastas das três abas. É o que a LG faz ao entrar: pequeno,
     * rápido e sem baixar filmes/séries inteiros.
     */
    suspend fun preloadCategories(source: PlaylistSource, base: String) {
        // As três abas em paralelo: antes era uma atrás da outra e a última
        // só aparecia depois de esperar as duas primeiras.
        coroutineScope {
            for (kind in listOf(MediaKind.LIVE, MediaKind.VOD, MediaKind.SERIES)) {
                launch { runCatching { categories(source, base, kind) } }
            }
        }
    }

    /**
     * Modelo do base.apk: uma única leitura de canais, filmes e séries e tudo
     * fica em memória. Chamado só no flavor mobile; o Fire TV Stick antigo
     * continua com o modelo de uma pasta por vez. Não grava em disco porque
     * a lista inteira é grande.
     */
    suspend fun preloadCatalog(source: PlaylistSource, base: String) {
        coroutineScope {
            for (kind in listOf(MediaKind.LIVE, MediaKind.VOD, MediaKind.SERIES)) {
                launch {
                    val all = runCatching { source.items(kind, null) }.getOrNull()
                        ?: return@launch
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
                        itemCache[itemKey(base, kind, null)] = all
                        all.groupBy { it.categoryId.orEmpty() }.forEach { (catId, list) ->
                            if (catId.isNotBlank()) {
                                itemCache[itemKey(base, kind, catId)] = list
                            }
                        }
                    }
                }
            }
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
        runCatching {
            RaptorApp.instance.cacheDir
                .listFiles { file ->
                    file.name.startsWith("cats_") || file.name.startsWith("items_")
                }
                ?.forEach { it.delete() }
        }
    }
}
