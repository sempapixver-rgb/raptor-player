package com.reptor.player.data

/**
 * Leitor de listas M3U/M3U8.
 *
 * A classificação é o ponto crítico: provedores misturam canais, filmes e
 * episódios de séries na mesma lista. Aqui cada entrada vai para o lugar certo
 * olhando primeiro a URL (que é a informação mais confiável), depois o grupo e
 * por último a extensão do arquivo.
 */
object M3uParser {

    private val attrRegex = Regex("([a-zA-Z0-9_-]+)=\"([^\"]*)\"")

    private val episodePatterns = listOf(
        Regex("""^(.*?)[\s._\-\[\]]*[Ss](\d{1,2})[\s._\-]*[Ee](\d{1,3})(?:\D.*)?$"""),
        Regex("""^(.*?)[\s._\-\[\]]*(\d{1,2})\s*[xX]\s*(\d{1,3})(?:\D.*)?$"""),
        Regex("""^(.*?)[\s._\-]*[Tt]emporada\s*(\d{1,2})[\s._\-]*[Ee]p(?:is[oó]dio)?\s*(\d{1,3})(?:\D.*)?$""")
    )

    fun parse(text: String): List<MediaEntry> {
        val out = ArrayList<MediaEntry>()
        var name: String? = null
        var logo: String? = null
        var group: String? = null

        for (raw in text.lineSequence()) {
            val line = raw.trim()
            when {
                line.isEmpty() -> Unit

                line.startsWith("#EXTINF", ignoreCase = true) -> {
                    val attrs = attrRegex.findAll(line)
                        .associate { it.groupValues[1].lowercase() to it.groupValues[2] }
                    logo = attrs["tvg-logo"]?.takeIf { it.isNotBlank() }
                    group = (attrs["group-title"] ?: attrs["tvg-group"])?.takeIf { it.isNotBlank() }
                    name = line.substringAfterLast(',').trim().ifBlank { "Sem título" }
                }

                line.startsWith("#") -> Unit

                name != null -> {
                    val title = name ?: "Sem título"
                    out.add(
                        MediaEntry(
                            id = "m3u-${out.size}",
                            name = title,
                            logo = logo,
                            categoryId = group,
                            kind = classify(line, group, title),
                            directUrl = line
                        )
                    )
                    name = null
                    logo = null
                    group = null
                }
            }
        }
        return out
    }

    /** Extrai (nome da série, temporada, episódio) do título, quando possível. */
    fun splitEpisode(title: String): Triple<String, Int, Int>? {
        for (pattern in episodePatterns) {
            val match = pattern.find(title.trim()) ?: continue
            val serie = match.groupValues[1].trim().trimEnd('-', '.', '_', ' ')
            val season = match.groupValues[2].toIntOrNull() ?: continue
            val episode = match.groupValues[3].toIntOrNull() ?: continue
            if (serie.isBlank()) continue
            return Triple(serie, season, episode)
        }
        return null
    }

    fun classify(url: String, group: String?, title: String): MediaKind {
        val u = url.lowercase()
        val g = group.orEmpty().lowercase()

        // 1) A URL do painel é a prova mais forte.
        if (u.contains("/series/")) return MediaKind.SERIES
        if (u.contains("/movie/")) return MediaKind.VOD
        if (u.contains("/live/")) return MediaKind.LIVE

        // 2) Nome com padrão S01E02 / 1x02 é episódio de série.
        if (splitEpisode(title) != null) return MediaKind.SERIES

        // 3) Pelo grupo.
        if (g.contains("serie") || g.contains("série") || g.contains("temporada")) {
            return MediaKind.SERIES
        }
        if (g.contains("filme") || g.contains("movie") || g.contains("vod") ||
            g.contains("cinema") || g.contains("lançamento") || g.contains("lancamento")
        ) {
            return MediaKind.VOD
        }
        if (g.contains("canal") || g.contains("ao vivo") || g.contains("live") ||
            g.contains("tv ") || g.contains("esporte") || g.contains("noticia") ||
            g.contains("notícia") || g.contains("infantil") || g.contains("documentario") ||
            g.contains("documentário")
        ) {
            return MediaKind.LIVE
        }

        // 4) Pela extensão do arquivo.
        val clean = u.substringBefore('?')
        return when {
            clean.endsWith(".mp4") || clean.endsWith(".mkv") || clean.endsWith(".avi") ||
                clean.endsWith(".mov") || clean.endsWith(".webm") -> MediaKind.VOD

            clean.endsWith(".m3u8") || clean.endsWith(".ts") -> MediaKind.LIVE
            else -> MediaKind.LIVE
        }
    }
}
