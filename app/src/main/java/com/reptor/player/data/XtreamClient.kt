package com.reptor.player.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

/**
 * Cliente mínimo do Xtream Codes (player_api.php).
 * Implementação própria, escrita a partir do contrato público da API.
 */
class XtreamClient(private val session: Session) {

    private val base = session.normalizedBase()
    private val user = session.username
    private val pass = session.password

    private val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    private fun enc(value: String): String = URLEncoder.encode(value, "UTF-8")

    private fun apiUrl(action: String?, extra: Map<String, String> = emptyMap()): String {
        val sb = StringBuilder(base)
        sb.append("/player_api.php?username=").append(enc(user))
        sb.append("&password=").append(enc(pass))
        if (!action.isNullOrBlank()) sb.append("&action=").append(action)
        for ((key, value) in extra) {
            sb.append('&').append(key).append('=').append(enc(value))
        }
        return sb.toString()
    }

    private suspend fun fetch(url: String): String = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url(url)
            .header("User-Agent", "Reptor/1.0 (Android)")
            .build()
        http.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IOException("Servidor respondeu HTTP ${response.code}")
            }
            response.body?.string().orEmpty()
        }
    }

    /** Retorna null quando o login é válido, ou uma mensagem de erro. */
    suspend fun check(): String {
        val text = try {
            fetch(apiUrl(null))
        } catch (e: Exception) {
            return "Não foi possível conectar: ${e.message ?: "erro de rede"}"
        }
        if (text.isBlank()) return "Resposta vazia do servidor"
        val obj = runCatching { JSONObject(text) }.getOrNull()
            ?: return "Resposta inválida (não é JSON)"
        val info = obj.optJSONObject("user_info")
            ?: return "Usuário ou senha inválidos"
        val status = info.optString("status").lowercase()
        if (status == "disabled" || status == "banned" || status == "expired") {
            return info.optString("message").ifBlank { "Conta $status" }
        }
        return ""
    }

    suspend fun categories(kind: MediaKind): List<Category> {
        val action = when (kind) {
            MediaKind.LIVE -> "get_live_categories"
            MediaKind.VOD -> "get_vod_categories"
            MediaKind.SERIES -> "get_series_categories"
        }
        val arr = parseArray(fetch(apiUrl(action))) ?: return emptyList()
        val out = ArrayList<Category>(arr.length())
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            val id = obj.optString("category_id")
            if (id.isBlank()) continue
            out.add(Category(id, obj.optString("category_name").ifBlank { "Sem nome" }))
        }
        return out
    }

    suspend fun items(kind: MediaKind, categoryId: String?): List<MediaEntry> {
        val action = when (kind) {
            MediaKind.LIVE -> "get_live_streams"
            MediaKind.VOD -> "get_vod_streams"
            MediaKind.SERIES -> "get_series"
        }
        val idKey = if (kind == MediaKind.SERIES) "series_id" else "stream_id"
        val logoKey = if (kind == MediaKind.SERIES) "cover" else "stream_icon"

        val extra = if (!categoryId.isNullOrBlank()) mapOf("category_id" to categoryId) else emptyMap()
        val arr = parseArray(fetch(apiUrl(action, extra))) ?: return emptyList()
        val out = ArrayList<MediaEntry>(arr.length())
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            val id = obj.optString(idKey)
            if (id.isBlank()) continue
            out.add(
                MediaEntry(
                    id = id,
                    name = obj.optString("name").ifBlank { "Sem título" },
                    logo = obj.optString(logoKey).takeIf { it.isNotBlank() },
                    categoryId = obj.optString("category_id").takeIf { it.isNotBlank() },
                    kind = kind,
                    containerExtension = obj.optString("container_extension").takeIf { it.isNotBlank() }
                )
            )
        }
        return out
    }

    fun liveUrl(streamId: String): String =
        "$base/live/${enc(user)}/${enc(pass)}/$streamId.m3u8"

    fun vodUrl(entry: MediaEntry): String {
        val ext = entry.containerExtension?.takeIf { it.isNotBlank() } ?: "mp4"
        return "$base/movie/${enc(user)}/${enc(pass)}/${entry.id}.$ext"
    }

    suspend fun seriesUrl(seriesId: String): String? {
        val text = fetch(apiUrl("get_series_info", mapOf("series_id" to seriesId)))
        val obj = runCatching { JSONObject(text) }.getOrNull() ?: return null
        val episodes = obj.optJSONObject("episodes") ?: return null
        val keys = episodes.keys()
        var firstSeason: String? = null
        while (keys.hasNext()) {
            val key = keys.next()
            val arr = episodes.optJSONArray(key)
            if (arr != null && arr.length() > 0) {
                firstSeason = key
                break
            }
        }
        val season = firstSeason ?: return null
        val episode = episodes.optJSONArray(season)?.optJSONObject(0) ?: return null
        val episodeId = episode.optString("id")
        if (episodeId.isBlank()) return null
        val ext = episode.optString("container_extension").ifBlank { "mp4" }
        return "$base/series/${enc(user)}/${enc(pass)}/$episodeId.$ext"
    }

    private fun parseArray(text: String): JSONArray? {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return null
        return runCatching { JSONArray(trimmed) }.getOrNull()
            ?: runCatching { JSONObject(trimmed).optJSONArray("categories") }.getOrNull()
    }
}
