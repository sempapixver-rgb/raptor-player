package com.reptor.player.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import java.io.File
import java.io.IOException
import java.net.URLDecoder
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/** Fonte de conteúdo: Xtream Codes ou lista M3U (URL ou arquivo local). */
interface PlaylistSource {
    /** Retorna "" quando o acesso está ok, ou uma mensagem de erro. */
    suspend fun check(): String

    suspend fun categories(kind: MediaKind): List<Category>

    /** Canais ao vivo (LIVE) e filmes (VOD). Para séries use [seriesDetail]. */
    suspend fun items(kind: MediaKind, categoryId: String?): List<MediaEntry>

    /** Série completa com temporadas e episódios. */
    suspend fun seriesDetail(seriesId: String): SeriesDetail?

    suspend fun playUrl(entry: MediaEntry): String?

    suspend fun account(): AccountInfo?
}

fun createSource(session: Session): PlaylistSource =
    if (session.mode == LoginMode.M3U) M3uSource(session.m3uUrl) else XtreamSource(session)

class XtreamSource(session: Session) : PlaylistSource {

    private val client = XtreamClient(session)

    override suspend fun check(): String = client.check()

    override suspend fun categories(kind: MediaKind): List<Category> = client.categories(kind)

    override suspend fun items(kind: MediaKind, categoryId: String?): List<MediaEntry> =
        if (kind == MediaKind.SERIES) client.seriesList(categoryId)
        else client.items(kind, categoryId)

    override suspend fun seriesDetail(seriesId: String): SeriesDetail? = client.seriesInfo(seriesId)

    override suspend fun playUrl(entry: MediaEntry): String? = when (entry.kind) {
        MediaKind.LIVE -> client.liveUrl(entry.id)
        MediaKind.VOD -> client.vodUrl(entry)
        // Série só é reproduzida pelo episódio escolhido na tela de temporadas.
        MediaKind.SERIES -> null
    }

    override suspend fun account(): AccountInfo? = client.account()
}

class M3uSource(private val url: String) : PlaylistSource {

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    @Volatile
    private var cache: List<MediaEntry>? = null

    @Volatile
    private var seriesCache: Map<String, SeriesDetail>? = null

    @Volatile
    private var seriesMetaCache: Map<String, SeriesMeta>? = null

    /** URL que realmente funcionou (pode ter caído de https para http). */
    @Volatile
    private var workingUrl: String? = null

    private fun resolvedUrl(): String = normalizeRemoteUrl(workingUrl ?: url)

    private fun isRemote(target: String): Boolean =
        target.startsWith("http://", true) || target.startsWith("https://", true)

    /** Dados extras de uma série no painel Xtream (mesmo login do get.php). */
    private class SeriesMeta(
        val cover: String?,
        val rating: Double?,
        val genre: String?,
        val releaseDate: String?,
        val plot: String?,
        val cast: String?
    )

    private class Endpoint(val base: String, val user: String, val pass: String)

    /**
     * Extrai o endpoint Xtream a partir de um link get.php.
     * Ex.: http://servidor:8080/get.php?username=U&password=P&type=m3u_plus
     *      -> base http://servidor:8080, user U, pass P.
     * Retorna null quando a lista não é um link Xtream (arquivo local etc.).
     */
    private fun endpoint(): Endpoint? {
        val current = resolvedUrl()
        if (!isRemote(current)) return null
        if (!current.contains("get.php", ignoreCase = true)) return null

        val schemeEnd = current.indexOf("://")
        if (schemeEnd < 0) return null
        // Base = tudo antes do "get.php" (funciona também com subpasta).
        val base = current.substringBefore('?').substringBeforeLast('/', "")
        if (!base.contains("://") || base.length <= schemeEnd + 3) return null

        val query = current.substringAfter('?', "")
        if (query.isBlank()) return null

        var user: String? = null
        var pass: String? = null
        for (part in query.split('&')) {
            val key = part.substringBefore('=').lowercase()
            val raw = part.substringAfter('=', "")
            val value = runCatching { URLDecoder.decode(raw, "UTF-8") }.getOrDefault(raw)
            when (key) {
                "username" -> user = value
                "password" -> pass = value
            }
        }

        val u = user?.takeIf { it.isNotBlank() } ?: return null
        val p = pass?.takeIf { it.isNotBlank() } ?: return null
        return Endpoint(base, u, p)
    }

    /**
     * Busca a lista completa de séries no painel (action=get_series) e indexa
     * por nome normalizado. É um download único (~8 MB) por sessão; qualquer
     * falha é silenciosa e o app segue só com os dados da lista M3U.
     */
    private suspend fun seriesMeta(): Map<String, SeriesMeta> {
        seriesMetaCache?.let { return it }

        val ep = endpoint() ?: run {
            seriesMetaCache = emptyMap()
            return emptyMap()
        }

        val map = withContext(Dispatchers.IO) {
            runCatching { fetchSeriesMeta(ep) }.getOrElse { emptyMap() }
        }

        seriesMetaCache = map
        return map
    }

    private fun fetchSeriesMeta(ep: Endpoint): Map<String, SeriesMeta> {
        val apiUrl = StringBuilder(ep.base)
            .append("/player_api.php?username=")
            .append(URLEncoder.encode(ep.user, "UTF-8"))
            .append("&password=")
            .append(URLEncoder.encode(ep.pass, "UTF-8"))
            .append("&action=get_series")
            .toString()

        val text = try {
            fetchText(apiUrl)
        } catch (first: Exception) {
            val fallback = httpFallback(apiUrl) ?: throw first
            fetchText(fallback)
        }

        val arr = JSONArray(text)
        val out = LinkedHashMap<String, SeriesMeta>(arr.length())
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            val name = obj.optString("name")
            if (name.isBlank()) continue
            val key = metaKey(name)
            if (key.isBlank() || out.containsKey(key)) continue
            out[key] = SeriesMeta(
                cover = obj.optString("cover").takeIf { it.isNotBlank() },
                rating = obj.optString("rating").toDoubleOrNull(),
                genre = obj.optString("genre").takeIf { it.isNotBlank() },
                releaseDate = obj.optString("releaseDate").takeIf { it.isNotBlank() },
                plot = obj.optString("plot").takeIf { it.isNotBlank() },
                cast = obj.optString("cast").takeIf { it.isNotBlank() }
            )
        }
        return out
    }

    /** Tira marcadores de idioma do fim do nome ("[L", "(D)", "Legendado"). */
    private fun cleanName(value: String): String = value
        .replace(Regex("\\s*\\[[A-Za-z]{1,10}\\]?\\s*$"), "")
        .replace(
            Regex("\\s*\\((?:L|D|Legendado|Dublado)\\)\\s*$", RegexOption.IGNORE_CASE),
            ""
        )
        .trim()

    private fun metaKey(value: String): String =
        M3uSeries.normalize(cleanName(value))

    private suspend fun readPlaylist(): String = withContext(Dispatchers.IO) {
        val target = resolvedUrl()

        if (!isRemote(target)) {
            val file = File(target.removePrefix("file://"))
            if (!file.exists()) throw IOException("Arquivo da lista não encontrado")
            return@withContext file.readText()
        }

        val first = runCatching { fetchText(target) }
        first.getOrNull()?.let {
            workingUrl = target
            return@withContext it
        }

        // Alguns provedores entregam o link em https, mas o servidor só
        // responde em http. Nesse caso tentamos o mesmo endereço em http.
        val fallback = httpFallback(target)
        if (fallback != null) {
            val second = runCatching { fetchText(fallback) }
            second.getOrNull()?.let {
                workingUrl = fallback
                return@withContext it
            }
            throw second.exceptionOrNull() ?: IOException("Falha ao carregar a lista")
        }

        throw first.exceptionOrNull() ?: IOException("Falha ao carregar a lista")
    }

    private fun fetchText(target: String): String {
        val request = Request.Builder()
            .url(target)
            .header("User-Agent", "Reptor/1.2 (Android)")
            .build()
        return http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("Playlist respondeu HTTP ${response.code}")
            }
            response.body?.string().orEmpty()
        }
    }

    private suspend fun all(): List<MediaEntry> {
        cache?.let { return it }
        val list = M3uParser.parse(readPlaylist())
        cache = list
        return list
    }

    private suspend fun seriesMap(): Map<String, SeriesDetail> {
        seriesCache?.let { return it }

        val base = M3uSeries.build(all())
        val meta = seriesMeta()

        val map = if (meta.isEmpty()) {
            base
        } else {
            base.mapValues { (_, detail) ->
                val info = meta[metaKey(detail.name)]
                    ?: meta[M3uSeries.normalize(detail.name)]
                    ?: return@mapValues detail
                detail.copy(
                    cover = info.cover ?: detail.cover,
                    rating = info.rating,
                    displayGenre = info.genre,
                    releaseDate = info.releaseDate ?: detail.releaseDate,
                    plot = info.plot ?: detail.plot,
                    cast = info.cast ?: detail.cast
                )
            }
        }

        seriesCache = map
        return map
    }

    override suspend fun check(): String = try {
        if (all().isEmpty()) "Playlist vazia ou inválida" else ""
    } catch (e: Exception) {
        "Não foi possível carregar a playlist: ${e.message ?: "erro de rede"}"
    }

    override suspend fun categories(kind: MediaKind): List<Category> {
        if (kind == MediaKind.SERIES) {
            return seriesMap().values.asSequence()
                .flatMap { it.allGenres().asSequence() }
                .distinct()
                .map { Category(it, it) }
                .sortedBy { it.name.lowercase() }
                .toList()
        }
        return all().asSequence()
            .filter { it.kind == kind }
            .mapNotNull { it.categoryId }
            .distinct()
            .map { Category(it, it) }
            .toList()
    }

    override suspend fun items(kind: MediaKind, categoryId: String?): List<MediaEntry> {
        if (kind == MediaKind.SERIES) {
            return seriesMap().values.asSequence()
                .filter { categoryId == null || categoryId in it.allGenres() }
                .map {
                    val genres = it.allGenres()
                    MediaEntry(
                        id = it.id,
                        name = it.name,
                        logo = it.cover,
                        categoryId = categoryId ?: genres.firstOrNull(),
                        categoryIds = genres,
                        kind = MediaKind.SERIES,
                        rating = it.rating,
                        plot = it.plot
                    )
                }
                .sortedBy { it.name.lowercase() }
                .toList()
        }
        return all().filter { it.kind == kind && (categoryId == null || it.categoryId == categoryId) }
    }

    override suspend fun seriesDetail(seriesId: String): SeriesDetail? = seriesMap()[seriesId]

    override suspend fun playUrl(entry: MediaEntry): String? = entry.directUrl

    override suspend fun account(): AccountInfo? = null
}
