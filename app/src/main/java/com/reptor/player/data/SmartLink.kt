package com.reptor.player.data

import android.net.Uri

/**
 * Detecta o que o usuário colou:
 *  - link get.php/player_api.php com usuário e senha -> Xtream
 *  - qualquer URL terminando em .m3u/.m3u8        -> lista M3U
 *  - host, host:porta ou URL sem caminho          -> servidor Xtream
 */
object SmartLink {

    data class Detected(
        val mode: LoginMode,
        val host: String = "",
        val user: String = "",
        val pass: String = "",
        val m3u: String = ""
    )

    private val hostOnly = Regex("^[^\\s/]+\\.[^\\s/]+(:\\d{1,5})?/?$")
    private val bareUrl = Regex("^[a-zA-Z][a-zA-Z0-9+.-]*://[^/\\s]+/?$")

    /** Evita disparar a detecção enquanto o usuário ainda está digitando. */
    fun looksComplete(raw: String): Boolean {
        val text = raw.trim()
        if (text.length < 6) return false
        return text.contains("/get.php", true) ||
            text.contains("/player_api.php", true) ||
            text.endsWith(".m3u", true) ||
            text.endsWith(".m3u8", true) ||
            text.startsWith("file:", true) ||
            bareUrl.matches(text) ||
            hostOnly.matches(text)
    }

    fun detect(raw: String): Detected? {
        val text = raw.trim()
        if (text.isEmpty()) return null

        val hasScheme = text.startsWith("http://", true) ||
            text.startsWith("https://", true) ||
            text.startsWith("file:", true)
        val parseable = if (hasScheme) text else "http://$text"

        val uri = runCatching { Uri.parse(parseable) }.getOrNull() ?: return null

        if (text.contains("/get.php", true) || text.contains("/player_api.php", true)) {
            val user = runCatching { uri.getQueryParameter("username") }.getOrNull().orEmpty()
            val pass = runCatching { uri.getQueryParameter("password") }.getOrNull().orEmpty()
            val base = baseOf(uri)
            return if (base != null && user.isNotBlank() && pass.isNotBlank()) {
                Detected(LoginMode.XTREAM, host = base, user = user, pass = pass)
            } else {
                Detected(LoginMode.M3U, m3u = text)
            }
        }

        if (text.endsWith(".m3u", true) ||
            text.endsWith(".m3u8", true) ||
            text.startsWith("file:", true)
        ) {
            return Detected(LoginMode.M3U, m3u = text)
        }

        val base = baseOf(uri) ?: return null
        if (uri.host.isNullOrBlank()) return null
        return Detected(LoginMode.XTREAM, host = base)
    }

    private fun baseOf(uri: Uri): String? {
        val scheme = uri.scheme ?: return null
        val host = uri.host
        if (host.isNullOrBlank()) return null
        val port = if (uri.port > 0) ":${uri.port}" else ""
        return "$scheme://$host$port"
    }
}
