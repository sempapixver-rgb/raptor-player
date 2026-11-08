package com.reptor.player.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Guarda as listas do usuário (Xtream ou M3U), favoritos, histórico e posições.
 * Nada sai do dispositivo.
 */
class Prefs(context: Context) {

    private val sp = context.applicationContext
        .getSharedPreferences("reptor_session", Context.MODE_PRIVATE)

    // ---------------------------------------------------------------- listas

    fun savedLists(): List<Session> {
        val raw = sp.getString("lists", null) ?: return emptyList()
        val arr = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        val out = ArrayList<Session>(arr.length())
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            out.add(
                Session(
                    mode = runCatching { LoginMode.valueOf(obj.optString("mode")) }
                        .getOrDefault(LoginMode.XTREAM),
                    baseUrl = obj.optString("base"),
                    username = obj.optString("user"),
                    password = obj.optString("pass"),
                    m3uUrl = obj.optString("m3u"),
                    label = obj.optString("label")
                )
            )
        }
        return out
    }

    private fun persist(list: List<Session>) {
        val arr = JSONArray()
        list.forEach { session ->
            arr.put(
                JSONObject().apply {
                    put("mode", session.mode.name)
                    put("base", session.baseUrl)
                    put("user", session.username)
                    put("pass", session.password)
                    put("m3u", session.m3uUrl)
                    put("label", session.label)
                }
            )
        }
        sp.edit().putString("lists", arr.toString()).apply()
    }

    /** Adiciona ou atualiza uma lista e a coloca no topo. */
    fun saveList(session: Session) {
        val list = savedLists().toMutableList()
        val key = session.key()
        val index = list.indexOfFirst { it.key() == key }
        val stored = if (session.label.isBlank()) {
            session.copy(label = session.displayName())
        } else {
            session
        }
        if (index >= 0) list[index] = stored else list.add(0, stored)
        persist(list.take(20))
    }

    fun removeList(session: Session) {
        persist(savedLists().filterNot { it.key() == session.key() })
        if (sp.getString("last", null) == session.key()) {
            sp.edit().remove("last").apply()
        }
    }

    fun setCurrent(session: Session?) {
        sp.edit().putString("last", session?.key()).apply()
    }

    fun current(): Session? {
        val key = sp.getString("last", null) ?: return null
        return savedLists().firstOrNull { it.key() == key }
    }

    // ------------------------------------------------------------ favoritos

    fun favorites(): List<MediaEntry> = readEntries("favorites")

    fun isFavorite(entry: MediaEntry): Boolean =
        favorites().any { it.kind == entry.kind && it.id == entry.id }

    /** Adiciona ou remove dos favoritos. Retorna true se ficou favorito. */
    fun toggleFavorite(entry: MediaEntry): Boolean {
        val list = favorites().toMutableList()
        val index = list.indexOfFirst { it.kind == entry.kind && it.id == entry.id }
        val added = index < 0
        if (added) list.add(0, entry) else list.removeAt(index)
        writeEntries("favorites", list.take(500))
        return added
    }

    fun clearFavorites() = writeEntries("favorites", emptyList())

    // -------------------------------------------------------------- recentes

    fun recents(): List<MediaEntry> = readEntries("recents")

    fun addRecent(entry: MediaEntry) {
        val list = recents().toMutableList()
        list.removeAll { it.kind == entry.kind && it.id == entry.id }
        list.add(0, entry)
        writeEntries("recents", list.take(60))
    }

    fun clearRecents() = writeEntries("recents", emptyList())

    // ------------------------------------------------------------ posições

    fun resumeFor(url: String): Long = sp.getLong("pos:${url.hashCode()}", 0L)

    fun saveResume(url: String, position: Long) {
        if (position <= 0) return
        sp.edit().putLong("pos:${url.hashCode()}", position).apply()
    }

    fun clearResume(url: String) {
        sp.edit().remove("pos:${url.hashCode()}").apply()
    }

    // ------------------------------------------------------------- interno

    private fun readEntries(key: String): List<MediaEntry> {
        val raw = sp.getString(key, null) ?: return emptyList()
        val arr = runCatching { JSONArray(raw) }.getOrNull() ?: return emptyList()
        val out = ArrayList<MediaEntry>(arr.length())
        for (i in 0 until arr.length()) {
            val obj = arr.optJSONObject(i) ?: continue
            val id = obj.optString("id")
            if (id.isBlank()) continue
            out.add(
                MediaEntry(
                    id = id,
                    name = obj.optString("name"),
                    logo = obj.optString("logo").takeIf { it.isNotBlank() },
                    categoryId = obj.optString("cat").takeIf { it.isNotBlank() },
                    kind = runCatching { MediaKind.valueOf(obj.optString("kind")) }
                        .getOrDefault(MediaKind.LIVE),
                    containerExtension = obj.optString("ext").takeIf { it.isNotBlank() },
                    directUrl = obj.optString("url").takeIf { it.isNotBlank() }
                )
            )
        }
        return out
    }

    private fun writeEntries(key: String, list: List<MediaEntry>) {
        val arr = JSONArray()
        list.forEach { entry ->
            arr.put(
                JSONObject().apply {
                    put("id", entry.id)
                    put("name", entry.name)
                    put("logo", entry.logo.orEmpty())
                    put("cat", entry.categoryId.orEmpty())
                    put("kind", entry.kind.name)
                    put("ext", entry.containerExtension.orEmpty())
                    put("url", entry.directUrl.orEmpty())
                }
            )
        }
        sp.edit().putString(key, arr.toString()).apply()
    }
}
