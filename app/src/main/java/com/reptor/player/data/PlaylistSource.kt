package com.reptor.player.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
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

    private suspend fun readPlaylist(): String = withContext(Dispatchers.IO) {
        when {
            url.startsWith("http://", true) || url.startsWith("https://", true) -> {
                val request = Request.Builder()
                    .url(url)
                    .header("User-Agent", "Reptor/1.2 (Android)")
                    .build()
                http.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) {
                        throw IOException("Playlist respondeu HTTP ${response.code}")
                    }
                    response.body?.string().orEmpty()
                }
            }

            else -> {
                val file = File(url.removePrefix("file://"))
                if (!file.exists()) throw IOException("Arquivo da lista não encontrado")
                file.readText()
            }
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
        val map = M3uSeries.build(all())
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
