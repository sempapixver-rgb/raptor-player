package com.reptor.player.data

enum class LoginMode { XTREAM, M3U }

enum class MediaKind(val label: String) {
    LIVE("Canais"),
    VOD("Filmes"),
    SERIES("Séries")
}

data class Session(
    val mode: LoginMode,
    val baseUrl: String = "",
    val username: String = "",
    val password: String = "",
    val m3uUrl: String = "",
    val label: String = ""
) {
    fun normalizedBase(): String {
        var b = baseUrl.trim()
        if (b.isEmpty()) return b
        if (!b.startsWith("http://", true) && !b.startsWith("https://", true)) {
            b = "http://$b"
        }
        // Aceita também um link completo colado no campo "Servidor".
        b = b.substringBefore('?').substringBefore('#').trimEnd('/')
        for (suffix in listOf("/player_api.php", "/get.php", "/panel_api.php", "/xmltv.php")) {
            if (b.endsWith(suffix, ignoreCase = true)) {
                b = b.dropLast(suffix.length).trimEnd('/')
                break
            }
        }
        return b
    }
}

/** Garante um esquema em links digitados sem "http://". */
fun normalizeRemoteUrl(raw: String): String {
    val text = raw.trim()
    return when {
        text.startsWith("http://", true) ||
            text.startsWith("https://", true) ||
            text.startsWith("file:", true) -> text

        else -> "http://$text"
    }
}

/**
 * Versão http:// de um link https://, ou null quando já é http.
 * Muitos painéis entregam o link em https, mas só respondem em http.
 */
fun httpFallback(url: String): String? =
    if (url.startsWith("https://", true)) {
        "http://" + url.substring("https://".length)
    } else {
        null
    }

/** Identidade usada para não duplicar listas salvas. */
fun Session.key(): String =
    listOf(mode.name, normalizedBase(), username.trim(), m3uUrl.trim()).joinToString("|")

/** Nome amigável para exibir na tela de listas. */
fun Session.displayName(): String {
    if (label.isNotBlank()) return label
    return when (mode) {
        LoginMode.XTREAM -> normalizedBase()
            .removePrefix("http://")
            .removePrefix("https://")
            .ifBlank { "Xtream Codes" }

        LoginMode.M3U -> {
            if (m3uUrl.startsWith("http://", true) || m3uUrl.startsWith("https://", true)) {
                m3uUrl.substringAfterLast('/').substringBefore('?').ifBlank { "Lista M3U" }
            } else {
                java.io.File(m3uUrl.removePrefix("file://")).name.substringBeforeLast('.').ifBlank { "Lista M3U" }
            }
        }
    }
}

data class Category(val id: String, val name: String)

/**
 * Item simples de catálogo (canal ao vivo ou filme).
 * Séries não são representadas por este tipo: elas têm hierarquia própria
 * (série -> temporada -> episódio) em [SeriesDetail].
 */
data class MediaEntry(
    val id: String,
    val name: String,
    val logo: String?,
    val categoryId: String?,
    val kind: MediaKind,
    val containerExtension: String? = null,
    val directUrl: String? = null,
    val rating: Double? = null,
    val plot: String? = null,
    val year: String? = null,
    /**
     * Pastas extras em que o item também aparece. Uma série pode estar em
     * "Series | Netflix" e em "Series | HBO Max" ao mesmo tempo; a pasta
     * principal continua em [categoryId].
     */
    val categoryIds: List<String> = emptyList()
) {
    fun allCategoryIds(): List<String> =
        (listOfNotNull(categoryId) + categoryIds).distinct()
}

/** Um episódio de série, já com a URL pronta para o player. */
data class Episode(
    val id: String,
    val title: String,
    val season: Int,
    val number: Int,
    val url: String,
    val plot: String? = null,
    val duration: String? = null,
    val logo: String? = null
)

data class Season(val number: Int, val episodes: List<Episode>)

/** Série completa: sempre com temporadas e episódios organizados. */
data class SeriesDetail(
    val id: String,
    val name: String,
    val cover: String? = null,
    val plot: String? = null,
    val cast: String? = null,
    val genre: String? = null,
    /**
     * Gênero "de verdade" (ex.: "Comédia, Drama"), vindo do painel Xtream.
     * [genre] continua guardando a pasta principal da lista, que é o que
     * alimenta as categorias; este campo é só para exibição.
     */
    val displayGenre: String? = null,
    val releaseDate: String? = null,
    val rating: Double? = null,
    val seasons: List<Season> = emptyList(),
    /** Todas as pastas (categorias) em que a série aparece. */
    val genres: List<String> = emptyList()
) {
    fun allGenres(): List<String> =
        (listOfNotNull(genre) + genres).distinct()
}

// ------------------------------------------------------------------ EPG

/** Programa da grade (meuguia.tv). */
data class EpgProgram(
    val startMinutes: Int,
    val start: String,
    val title: String,
    val genre: String? = null
)

data class ChannelEpg(
    val channelName: String,
    val programs: List<EpgProgram>
) {
    fun current(nowMinutes: Int): EpgProgram? =
        programs.lastOrNull { it.startMinutes <= nowMinutes } ?: programs.firstOrNull()

    fun upcoming(nowMinutes: Int, count: Int = 4): List<EpgProgram> {
        val now = current(nowMinutes) ?: return emptyList()
        val index = programs.indexOf(now)
        if (index < 0) return emptyList()
        return programs.drop(index + 1).take(count)
    }
}
