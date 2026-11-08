package com.reptor.player.data

enum class LoginMode { XTREAM, M3U }

enum class MediaKind(val label: String) {
    LIVE("Ao vivo"),
    VOD("Filmes"),
    SERIES("Séries")
}

data class Session(
    val mode: LoginMode,
    val baseUrl: String = "",
    val username: String = "",
    val password: String = "",
    val m3uUrl: String = "",
    val label: String = ""
) {
    fun normalizedBase(): String {
        var b = baseUrl.trim()
        if (b.isEmpty()) return b
        if (!b.startsWith("http://", true) && !b.startsWith("https://", true)) {
            b = "http://$b"
        }
        b = b.trimEnd('/')
        if (b.endsWith("/player_api.php", true)) {
            b = b.dropLast("/player_api.php".length)
        }
        return b
    }
}

/** Identidade usada para não duplicar listas salvas. */
fun Session.key(): String =
    listOf(mode.name, normalizedBase(), username.trim(), m3uUrl.trim()).joinToString("|")

/** Nome amigável para exibir na tela de listas. */
fun Session.displayName(): String {
    if (label.isNotBlank()) return label
    return when (mode) {
        LoginMode.XTREAM -> normalizedBase()
            .removePrefix("http://")
            .removePrefix("https://")
            .ifBlank { "Xtream Codes" }

        LoginMode.M3U -> {
            if (m3uUrl.startsWith("http://", true) || m3uUrl.startsWith("https://", true)) {
                m3uUrl.substringAfterLast('/').substringBefore('?').ifBlank { "Lista M3U" }
            } else {
                java.io.File(m3uUrl.removePrefix("file://")).name.substringBeforeLast('.').ifBlank { "Lista M3U" }
            }
        }
    }
}

data class Category(val id: String, val name: String)

data class MediaEntry(
    val id: String,
    val name: String,
    val logo: String?,
    val categoryId: String?,
    val kind: MediaKind,
    val containerExtension: String? = null,
    val directUrl: String? = null
)
