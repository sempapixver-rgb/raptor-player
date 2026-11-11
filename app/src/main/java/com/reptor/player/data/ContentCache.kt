package com.reptor.player.data

/**
 * Guarda as categorias e os itens já carregados de cada aba.
 *
 * Sem isso, trocar de Canais para Filmes e voltar baixava e reprocessava a
 * lista inteira outra vez — em contas grandes isso levava vários segundos e
 * dava a sensação de app travado. O botão "Atualizar" limpa o cache da aba.
 */
object ContentCache {

    private val categories = HashMap<String, List<Category>>()
    private val items = HashMap<String, List<MediaEntry>>()

    @Synchronized
    fun categories(key: String): List<Category>? = categories[key]

    @Synchronized
    fun putCategories(key: String, value: List<Category>) {
        categories[key] = value
    }

    @Synchronized
    fun items(key: String): List<MediaEntry>? = items[key]

    @Synchronized
    fun putItems(key: String, value: List<MediaEntry>) {
        items[key] = value
    }

    @Synchronized
    fun clear(key: String) {
        categories.remove(key)
        items.remove(key)
    }

    @Synchronized
    fun clearAll() {
        categories.clear()
        items.clear()
    }
}
