package com.reptor.player.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.text.Normalizer
import java.util.concurrent.TimeUnit

/**
 * Grade de programação do meuguia.tv (site público e gratuito).
 *
 * A página de cada categoria lista os canais já com os próximos programas:
 *   <h2>Globo</h2>
 *   <h3 class="dark"><strong>09:30</strong> ... Encontro com Patrícia Poeta</h3>
 *   <h3><strong>10:35</strong> ... Mais Você</h3>
 *
 * Também é possível abrir a página do canal para pegar o dia inteiro.
 */
object EpgClient {

    private const val BASE = "https://meuguia.tv"

    private val CATEGORIES = listOf(
        "Filmes", "Series", "Esportes", "Infantil",
        "Variedades", "Documentarios", "Noticias", "Aberta"
    )

    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    data class Entry(
        val code: String,
        val name: String,
        val programs: List<EpgProgram>
    )

    @Volatile
    private var boardCache: List<Entry> = emptyList()

    @Volatile
    private var boardAt: Long = 0L

    private val scheduleCache = HashMap<String, Pair<Long, List<EpgProgram>>>()

    private const val TTL = 10 * 60 * 1000L

    // --------------------------------------------------------------- rede

    private suspend fun get(path: String): String = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url(if (path.startsWith("http")) path else BASE + path)
            .header("User-Agent", "Mozilla/5.0 (Android) Reptor/1.2")
            .build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@withContext ""
            response.body?.string().orEmpty()
        }
    }

    // -------------------------------------------------------------- grade

    suspend fun board(force: Boolean = false): List<Entry> {
        val now = System.currentTimeMillis()
        if (!force && boardCache.isNotEmpty() && now - boardAt < TTL) return boardCache

        val result = withContext(Dispatchers.Default) {
            val out = ArrayList<Entry>()
            for (category in CATEGORIES) {
                val html = runCatching { get("/programacao/categoria/$category") }.getOrNull().orEmpty()
                if (html.isBlank()) continue
                out.addAll(parseCategory(html))
            }
            out
        }

        if (result.isNotEmpty()) {
            boardCache = result
            boardAt = now
        }
        return if (result.isNotEmpty()) result else boardCache
    }

    private val channelBlock = Regex(
        """href="/programacao/canal/([A-Za-z0-9]+)"[^>]*>(.*?)</a>""",
        setOf(RegexOption.DOT_MATCHES_ALL, RegexOption.IGNORE_CASE)
    )
    private val h2Regex = Regex("""<h2>(.*?)</h2>""", RegexOption.DOT_MATCHES_ALL)
    private val h3Regex = Regex("""<h3[^>]*>(.*?)</h3>""", RegexOption.DOT_MATCHES_ALL)
    private val timeRegex = Regex("""<strong>\s*(\d{1,2}:\d{2})\s*</strong>""")
    private val progressRegex = Regex("""<div class="progressbar">.*?</div>""", RegexOption.DOT_MATCHES_ALL)

    private fun parseCategory(html: String): List<Entry> {
        val out = ArrayList<Entry>()
        channelBlock.findAll(html).forEach { match ->
            val code = match.groupValues[1]
            val block = match.groupValues[2]
            val name = h2Regex.find(block)?.groupValues?.get(1)?.let { clean(it) } ?: return@forEach
            if (name.isBlank()) return@forEach

            val programs = ArrayList<EpgProgram>()
            h3Regex.findAll(block).forEach { h3 ->
                val inner = h3.groupValues[1]
                val time = timeRegex.find(inner)?.groupValues?.get(1) ?: return@forEach
                var rest = inner.substringAfter("</strong>")
                rest = progressRegex.replace(rest, " ")
                val title = clean(rest)
                if (title.isBlank()) return@forEach
                programs.add(
                    EpgProgram(
                        startMinutes = toMinutes(time),
                        start = time,
                        title = title
                    )
                )
            }
            if (programs.isNotEmpty()) {
                out.add(Entry(code = code, name = name, programs = programs))
            }
        }
        return out
    }

    /** Programação do dia inteiro de um canal. */
    suspend fun schedule(code: String): List<EpgProgram> {
        val now = System.currentTimeMillis()
        scheduleCache[code]?.let { (at, value) ->
            if (now - at < TTL) return value
        }
        val html = runCatching { get("/programacao/canal/$code") }.getOrNull().orEmpty()
        if (html.isBlank()) return emptyList()

        // A página traz vários dias. O HTML também repete o cabeçalho de dia
        // dentro de comentários de template (<% ... %>), então só contamos os
        // cabeçalhos reais e ficamos com o primeiro dia (hoje).
        return withContext(Dispatchers.Default) {
            val headers = dayHeader.findAll(html).map { it.range.first }.toList()
            val start = if (headers.isEmpty()) 0 else html.indexOf('>', headers.first()) + 1
            val end = if (headers.size > 1) headers[1] else html.length
            val today = if (start in 0..end) html.substring(start, end) else html

            val out = ArrayList<EpgProgram>()
            timeBlock.findAll(today).forEach { match ->
                val time = match.groupValues[1]
                val title = clean(match.groupValues[2])
                val genre = clean(match.groupValues[3]).takeIf { it.isNotBlank() }
                if (title.isNotBlank()) {
                    out.add(EpgProgram(toMinutes(time), time, title, genre))
                }
            }
            if (out.isNotEmpty()) scheduleCache[code] = now to out
            out
        }
    }

    private val dayHeader = Regex("""<li class="subheader devicepadding">(?!<%)""")

    private val timeBlock = Regex(
        """<div class='lileft time'>\s*(\d{1,2}:\d{2})\s*</div>\s*<div class="licontent">\s*<h2>(.*?)</h2>\s*<h3>(.*?)</h3>""",
        setOf(RegexOption.DOT_MATCHES_ALL, RegexOption.IGNORE_CASE)
    )

    // ------------------------------------------------------------ busca

    fun find(entries: List<Entry>, channelName: String): Entry? {
        if (entries.isEmpty()) return null
        val target = normalize(channelName)
        if (target.isBlank()) return null

        entries.firstOrNull { normalize(it.name) == target }?.let { return it }

        val targetShort = stripQuality(target)
        entries.firstOrNull { stripQuality(normalize(it.name)) == targetShort }?.let { return it }

        // "BandSports" x "BAND SPORTS"
        val targetPacked = targetShort.replace(" ", "")
        entries.firstOrNull { stripQuality(normalize(it.name)).replace(" ", "") == targetPacked }
            ?.let { return it }

        // "GLOBO BA TV BAHIA FHD" x "Globo" — compara o começo das palavras.
        entries.firstOrNull {
            val other = stripQuality(normalize(it.name))
            other.isNotBlank() && (targetShort.startsWith(other) || other.startsWith(targetShort))
        }?.let { return it }

        // Último recurso: o nome do guia aparece como palavra no nome do canal.
        entries.firstOrNull {
            val other = stripQuality(normalize(it.name))
            other.isNotBlank() && targetShort.contains(" $other")
        }?.let { return it }

        return null
    }

    fun normalize(value: String): String {
        val lower = value.lowercase()
        val stripped = Normalizer.normalize(lower, Normalizer.Form.NFD)
            .replace(Regex("\\p{Mn}+"), "")
        return stripped.replace(Regex("[^a-z0-9]+"), " ").trim()
    }

    private fun stripQuality(value: String): String =
        value.replace(
            Regex("\\b(fhd|uhd|hd|sd|4k|8k|h265|hevc|h264|alt|backup|raw|full)\\b"),
            " "
        ).replace(Regex("\\s+"), " ").trim()

    private fun toMinutes(time: String): Int {
        val parts = time.split(":")
        val hour = parts.getOrNull(0)?.toIntOrNull() ?: 0
        val minute = parts.getOrNull(1)?.toIntOrNull() ?: 0
        return hour * 60 + minute
    }

    private fun clean(raw: String): String {
        var text = raw
        text = text.replace(Regex("<[^>]*>"), " ")
        text = text.replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&apos;", "'")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
        text = text.replace(Regex("&#(\\d+);")) { m ->
            m.groupValues[1].toIntOrNull()?.toChar()?.toString() ?: " "
        }
        return text.replace('\u00A0', ' ').replace(Regex("\\s+"), " ").trim()
    }
}
