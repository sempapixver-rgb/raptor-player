package com.reptor.player.data

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Categorias + itens de uma aba já carregados. */
data class ContentBundle(
    val categories: List<Category>,
    val items: List<MediaEntry>
)

/**
 * Ponto único de carga da lista.
 *
 * O app carrega a lista uma vez (canais, filmes e séries) logo que entra e
 * guarda tudo em [ContentCache]. As abas só voltam a pedir quando o usuário
 * toca em "Atualizar" — abrir Canais, depois Filmes e voltar não baixa nada
 * outra vez.
 *
 * O [Mutex] por aba evita carregar a mesma lista duas vezes ao mesmo tempo
 * (por exemplo: a carga inicial ainda está rodando e o usuário já abriu a
 * aba). A segunda chamada espera a primeira terminar e reaproveita o
 * resultado.
 */
object ContentStore {

    private val mutexes = HashMap<String, Mutex>()

    private fun mutexFor(key: String): Mutex = synchronized(mutexes) {
        mutexes.getOrPut(key) { Mutex() }
    }

    /** Chave usada pela aba. Ex.: "usuario|LIVE". */
    fun cacheId(base: String, kind: MediaKind): String = "$base|${suffix(kind)}"

    private fun suffix(kind: MediaKind): String = when (kind) {
        MediaKind.LIVE -> "LIVE"
        MediaKind.VOD -> "VOD"
        MediaKind.SERIES -> "SERIES"
    }

    /** Conteúdo já carregado, sem tocar na rede. */
    fun cached(cacheId: String): ContentBundle? {
        val categories = ContentCache.categories(cacheId) ?: return null
        val items = ContentCache.items(cacheId) ?: return null
        return ContentBundle(categories, items)
    }

    /**
     * Carrega uma vez por chave. Com [force] = true (botão "Atualizar" ou
     * "Tentar de novo") descarta o que estava guardado e baixa de novo.
     */
    suspend fun load(
        source: PlaylistSource,
        cacheId: String,
        kind: MediaKind,
        force: Boolean = false
    ): ContentBundle = mutexFor(cacheId).withLock {
        if (!force) {
            cached(cacheId)?.let { return@withLock it }
        } else {
            ContentCache.clear(cacheId)
        }

        val categories = source.categories(kind)
        val items = source.items(kind, null)
        ContentCache.putCategories(cacheId, categories)
        ContentCache.putItems(cacheId, items)
        ContentBundle(categories, items)
    }
}
