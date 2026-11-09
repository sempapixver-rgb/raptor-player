package com.reptor.player.data

import java.text.Normalizer

/**
 * Monta a hierarquia série -> temporada -> episódio a partir de uma lista M3U.
 *
 * Muitas listas trazem os episódios soltos ("Nome S01E02", "Nome 1x02",
 * "Nome Temporada 1 Episódio 2"). Aqui eles são agrupados pelo nome da série.
 */
object M3uSeries {

    fun build(entries: List<MediaEntry>): Map<String, SeriesDetail> {
        val grouped = LinkedHashMap<String, MutableList<Pair<MediaEntry, Triple<String, Int, Int>>>>()

        var looseCounter = 0
        for (entry in entries) {
            if (entry.kind != MediaKind.SERIES) continue
            val parts = M3uParser.splitEpisode(entry.name)
            val info = parts ?: run {
                looseCounter++
                Triple(entry.name.trim(), 1, looseCounter)
            }
            val key = normalize(info.first)
            if (key.isBlank()) continue
            grouped.getOrPut(key) { ArrayList() }.add(entry to info)
        }

        val out = LinkedHashMap<String, SeriesDetail>()
        for ((key, list) in grouped) {
            val first = list.first().first
            val title = list.first().second.first

            val bySeason = LinkedHashMap<Int, MutableList<Episode>>()
            list.forEachIndexed { index, (entry, info) ->
                val (_, season, number) = info
                val ep = Episode(
                    id = entry.id,
                    title = episodeTitle(entry.name, title, season, number),
                    season = season,
                    number = if (number > 0) number else index + 1,
                    url = entry.directUrl.orEmpty(),
                    logo = entry.logo
                )
                bySeason.getOrPut(season) { ArrayList() }.add(ep)
            }

            val seasons = bySeason.entries
                .sortedBy { it.key }
                .map { entry ->
                    Season(
                        number = entry.key,
                        episodes = entry.value.sortedWith(
                            compareBy({ it.number }, { it.title.lowercase() })
                        )
                    )
                }

            val id = "s-" + key.hashCode().toString(16)
            out[id] = SeriesDetail(
                id = id,
                name = title,
                cover = first.logo,
                genre = first.categoryId,
                seasons = seasons
            )
        }
        return out
    }

    private fun episodeTitle(full: String, series: String, season: Int, number: Int): String {
        val trimmed = full.removePrefix(series).trim().trim('-', '.', '_', ' ')
        return if (trimmed.isBlank()) "T$season E$number" else trimmed
    }

    fun normalize(value: String): String {
        val lower = value.lowercase()
        val stripped = Normalizer.normalize(lower, Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
        return stripped.replace(Regex("[^a-z0-9]+"), " ").trim()
    }
}
