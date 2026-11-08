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
    suspend fun items(kind: MediaKind, categoryId: String?): List<MediaEntry>
    suspend fun playUrl(entry: MediaEntry): String?
}

fun createSource(session: Session): PlaylistSource =
    if (session.mode == LoginMode.M3U) M3uSource(session.m3uUrl) else XtreamSource(session)

class XtreamSource(session: Session) : PlaylistSource {

    private val client = XtreamClient(session)

    override suspend fun check(): String = client.check()

    override suspend fun categories(kind: MediaKind): List<Category> = client.categories(kind)

    override suspend fun items(kind: MediaKind, categoryId: String?): List<MediaEntry> =
        client.items(kind, categoryId)

    override suspend fun playUrl(entry: MediaEntry): String? = when (entry.kind) {
        MediaKind.LIVE -> client.liveUrl(entry.id)
        MediaKind.VOD -> client.vodUrl(entry)
        MediaKind.SERIES -> client.seriesUrl(entry.id)
    }
}

class M3uSource(private val url: String) : PlaylistSource {

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    @Volatile
    private var cache: List<MediaEntry>? = null

    private suspend fun readPlaylist(): String = withContext(Dispatchers.IO) {
        when {
            url.startsWith("http://", true) || url.startsWith("https://", true) -> {
                val request = Request.Builder()
                    .url(url)
                    .header("User-Agent", "Reptor/1.0 (Android)")
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

    override suspend fun check(): String = try {
        if (all().isEmpty()) "Playlist vazia ou inválida" else ""
    } catch (e: Exception) {
        "Não foi possível carregar a playlist: ${e.message ?: "erro de rede"}"
    }

    override suspend fun categories(kind: MediaKind): List<Category> =
        all().asSequence()
            .filter { it.kind == kind }
            .mapNotNull { it.categoryId }
            .distinct()
            .map { Category(it, it) }
            .toList()

    override suspend fun items(kind: MediaKind, categoryId: String?): List<MediaEntry> =
        all().filter { it.kind == kind && (categoryId == null || it.categoryId == categoryId) }

    override suspend fun playUrl(entry: MediaEntry): String? = entry.directUrl
}
