package com.reptor.player.data

object M3uParser {

    private val attrRegex = Regex("([a-zA-Z0-9_-]+)=\"([^\"]*)\"")

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
                    val title = name
                    out.add(
                        MediaEntry(
                            id = "m3u-${out.size}",
                            name = title,
                            logo = logo,
                            categoryId = group,
                            kind = guessKind(line, group),
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

    private fun guessKind(url: String, group: String?): MediaKind {
        val haystack = "$url ${group.orEmpty()}".lowercase()
        return when {
            haystack.contains("/series/") || haystack.contains("serie") || haystack.contains("série") -> MediaKind.SERIES
            haystack.contains("/movie/") || haystack.contains("filme") || haystack.contains("movie") -> MediaKind.VOD
            else -> MediaKind.LIVE
        }
    }
}
