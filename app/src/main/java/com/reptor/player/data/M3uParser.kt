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
        val g = fold(group.orEmpty())

        // 1) Grupos que são claramente de canais ao vivo vêm primeiro.
        //    É o caso de "FILMES SÉRIES", "FUTEBOL", "CANAIS | ...", "ESPORTES".
        //    Antes eles caíam em Séries só porque o nome tinha "série".
        if (isLiveCategory(g)) return MediaKind.LIVE

        // 2) A URL do painel é a prova mais forte.
        if (u.contains("/series/")) return MediaKind.SERIES
        if (u.contains("/movie/")) return MediaKind.VOD
        if (u.contains("/live/")) return MediaKind.LIVE

        // 3) Nome com padrão S01E02 / 1x02 é episódio de série.
        if (splitEpisode(title) != null) return MediaKind.SERIES

        // 4) Pelo grupo.
        if (g.hasAny(
                "serie", "temporada", "novela", "anime", "dorama", "shows", "show "
            )
        ) {
            return MediaKind.SERIES
        }
        if (g.hasAny("filme", "movie", "vod", "cinema", "lancamento", "trailer")) {
            return MediaKind.VOD
        }
        if (g.hasAny("ao vivo", "live", "noticia", "infantil", "documentario")) {
            return MediaKind.LIVE
        }

        // 5) Pela extensão do arquivo.
        val clean = u.substringBefore('?')
        return when {
            clean.endsWith(".mp4") || clean.endsWith(".mkv") || clean.endsWith(".avi") ||
                clean.endsWith(".mov") || clean.endsWith(".webm") -> MediaKind.VOD

            clean.endsWith(".m3u8") || clean.endsWith(".ts") -> MediaKind.LIVE
            else -> MediaKind.LIVE
        }
    }

    /** Minúsculas, sem acentos e sem pontuação, para comparar grupos com segurança. */
    private fun fold(value: String): String {
        val lower = value.lowercase()
        val stripped = java.text.Normalizer.normalize(lower, java.text.Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
        return stripped.replace(Regex("[^a-z0-9]+"), " ").trim()
    }

    private fun String.hasAny(vararg needles: String): Boolean =
        needles.any { contains(it) }

    /**
     * Categorias de canais lineares. Não entram aqui as pastas de séries
     * ("Series | Netflix", "Series | HBO Max" etc.) nem as de filmes
     * ("Filmes | Documentarios", "Filmes | Adultos"...).
     */
    private fun isLiveCategory(g: String): Boolean {
        if (g.isEmpty()) return false

        // "FILMES • SÉRIES" é uma pasta de canais; já "Filmes | Drama" é VOD.
        val movieAndSeries = g.hasAny(
            "filmes e series", "filmes series", "filmes serie",
            "series e filmes", "series filmes",
            "filmes & series", "series & filmes"
        )
        if (movieAndSeries) return true

        val looksMovie = g == "filme" || g == "filmes" ||
            g.startsWith("filme ") || g.startsWith("filmes ")
        if (looksMovie) return false

        return g.hasAny(
            "canais", "canal ", "ao vivo", "futebol", "esporte", "noticia", "infantil",
            "documentario", "variedade", "aberta", "assinatura", "ppv", "adulto",
            "jogos brasileirao", "brasileirao", "campeonato", "copa", "nba", "nfl", "ufc",
            "luta", "combate", "premiere", "radio",
            "24h", "24 horas", "live"
        )
    }
}
