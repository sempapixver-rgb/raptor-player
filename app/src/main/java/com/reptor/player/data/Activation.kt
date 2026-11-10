package com.reptor.player.data

import android.content.Context
import android.graphics.Bitmap
import android.provider.Settings
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.NetworkInterface
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

/**
 * Ativação pelo site: a TV mostra um código (MAC), o cliente preenche no site
 * e o app busca a configuração sozinho. Nada é digitado no controle.
 */
object Activation {

    /** Endereço do site de ativação (Netlify). */
    const val SITE_BASE = "https://reptor-player.netlify.app"

    private const val SP = "reptor_session"
    private const val KEY_CODE = "device_code"

    private val http = OkHttpClient.Builder()
        .connectTimeout(8, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build()

    /** Código estável da TV no formato AA:BB:CC:DD:EE:FF. */
    fun deviceCode(context: Context): String {
        val sp = context.getSharedPreferences(SP, Context.MODE_PRIVATE)
        sp.getString(KEY_CODE, null)?.let { return it }

        val code = realMac() ?: fallbackCode(context)
        sp.edit().putString(KEY_CODE, code).apply()
        return code
    }

    /** Link que vai dentro do QR Code. */
    fun siteLink(code: String): String =
        "$SITE_BASE/?code=" + URLEncoder.encode(normalize(code), "UTF-8")

    /** Só os caracteres que o site espera (A-Z 0-9). */
    fun normalize(code: String): String =
        code.uppercase().replace(Regex("[^A-Z0-9]"), "")

    fun qrBitmap(content: String, size: Int): Bitmap? = runCatching {
        val hints = mapOf(
            EncodeHintType.MARGIN to 1,
            EncodeHintType.CHARACTER_SET to "UTF-8",
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M
        )
        val matrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size, hints)
        val pixels = IntArray(size * size)
        for (y in 0 until size) {
            for (x in 0 until size) {
                pixels[y * size + x] = if (matrix[x, y]) {
                    android.graphics.Color.BLACK
                } else {
                    android.graphics.Color.WHITE
                }
            }
        }
        Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).apply {
            setPixels(pixels, 0, size, 0, 0, size, size)
        }
    }.getOrNull()

    /**
     * Consulta a ativação no site. Retorna null enquanto não houver nada
     * (ou se o servidor estiver fora do ar).
     */
    fun fetch(code: String): Session? {
        val url = "$SITE_BASE/api/device?code=" + URLEncoder.encode(normalize(code), "UTF-8")
        val request = Request.Builder().url(url).get().build()
        return runCatching {
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@use null
                val body = response.body?.string() ?: return@use null
                val root = JSONObject(body)
                if (!root.optBoolean("ok")) return@use null
                val a = root.optJSONObject("activation") ?: return@use null
                val label = a.optString("label").ifBlank { "Ativado pelo site" }
                if (a.optString("mode").equals("M3U", ignoreCase = true)) {
                    val link = a.optString("m3u")
                    if (link.isBlank()) return@use null
                    Session(LoginMode.M3U, m3uUrl = link, label = label)
                } else {
                    val host = a.optString("host")
                    val user = a.optString("user")
                    val pass = a.optString("pass")
                    if (host.isBlank() || user.isBlank() || pass.isBlank()) return@use null
                    Session(
                        mode = LoginMode.XTREAM,
                        baseUrl = host,
                        username = user,
                        password = pass,
                        label = label
                    )
                }
            }
        }.getOrNull()
    }

    // ---------------------------------------------------------------- interno

    private fun realMac(): String? {
        val names = listOf("eth0", "wlan0", "en0", "eth1")
        for (name in names) {
            val mac = runCatching {
                val nif = NetworkInterface.getByName(name) ?: return@runCatching null
                val bytes = nif.hardwareAddress ?: return@runCatching null
                if (bytes.size != 6) return@runCatching null
                bytes.joinToString(":") { "%02X".format(it) }
            }.getOrNull() ?: continue
            if (mac != "00:00:00:00:00:00" && mac != "02:00:00:00:00:00") return mac
        }
        return null
    }

    /**
     * TVs e boxes modernos escondem o MAC real. Nesse caso usamos um código
     * fixo derivado do aparelho (mesmo formato, para o cliente não perceber
     * diferença na hora de ativar).
     */
    private fun fallbackCode(context: Context): String {
        val androidId = runCatching {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        }.getOrNull().orEmpty()

        val seed = androidId + "|" + android.os.Build.MODEL + "|" + android.os.Build.BRAND
        val digest = MessageDigest.getInstance("SHA-256").digest(seed.toByteArray())
        return digest.take(6).joinToString(":") { "%02X".format(it) }
    }
}
