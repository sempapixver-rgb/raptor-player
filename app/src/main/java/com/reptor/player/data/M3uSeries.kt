package com.reptor.player.data

import java.text.Normalizer

/**
 * Monta a hierarquia série -> temporada -> episódio a partir de uma lista M3U.
 *
 * Muitas listas trazem os episódios soltos ("Nome S01E02", "Nome 1x02",
 * "Nome Temporada 1 Episódio 2"). Aqui eles são agrupados pelo nome da série.
 *
 * Uma mesma série pode estar em mais de uma pasta do provedor (por exemplo
 * "Series | Netflix" e "Series | HBO Max"). Nesse caso a série aparece nas
 * duas pastas, igual à referência: as contagens de cada pasta continuam certas
 * e nenhuma série "desaparece".
 */
object M3uSeries {

    private class Bucket(
        val title: String,
        var cover: String? = null,
        val genres: LinkedHashSet<String> = LinkedHashSet(),
        val episodes: LinkedHashMap<String, Episode> = LinkedHashMap()
    )

    fun build(entries: List<MediaEntry>): Map<String, SeriesDetail> {
        val grouped = LinkedHashMap<String, Bucket>()

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

            val bucket = grouped.getOrPut(key) { Bucket(info.first) }
            if (bucket.cover.isNullOrBlank()) bucket.cover = entry.logo
            entry.categoryId?.takeIf { it.isNotBlank() }?.let { bucket.genres.add(it) }

            val (_, season, number) = info
            val episodeNumber = if (number > 0) number else bucket.episodes.size + 1
            val title = episodeTitle(entry.name, info.first, season, episodeNumber)
            val episode = Episode(
                id = entry.id,
                title = title,
                season = season,
                number = episodeNumber,
                url = entry.directUrl.orEmpty(),
                logo = entry.logo
            )
            // A mesma série repetida em duas pastas costuma repetir os mesmos
            // episódios (mesma URL). Guardamos só uma vez.
            val dedupeKey = entry.directUrl?.takeIf { it.isNotBlank() }
                ?: "s${season}e${episodeNumber}-${title.lowercase()}"
            if (!bucket.episodes.containsKey(dedupeKey)) {
                bucket.episodes[dedupeKey] = episode
            }
        }

        val out = LinkedHashMap<String, SeriesDetail>()
        for ((key, bucket) in grouped) {
            val bySeason = LinkedHashMap<Int, MutableList<Episode>>()
            bucket.episodes.values.forEach { episode ->
                bySeason.getOrPut(episode.season) { ArrayList() }.add(episode)
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
            val genres = bucket.genres.toList()
            out[id] = SeriesDetail(
                id = id,
                name = bucket.title,
                cover = bucket.cover,
                genre = genres.firstOrNull(),
                genres = genres,
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
