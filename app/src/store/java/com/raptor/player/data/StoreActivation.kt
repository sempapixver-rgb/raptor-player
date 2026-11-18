package com.raptor.player.data

import android.content.Context
import android.graphics.Bitmap
import android.provider.Settings
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import java.net.NetworkInterface
import java.net.URLEncoder
import java.security.MessageDigest

/**
 * Device registration by MAC code. The store edition receives no
 * configuration from the website: it only shows the code and the QR code.
 */
object StoreActivation {

    /** Registration website address. */
    const val SITE_BASE = "https://raptor-player.netlify.app"

    private const val SP = "raptor_session"
    private const val KEY_CODE = "device_code"

    /** Stable TV code in AA:BB:CC:DD:EE:FF format. */
    fun deviceCode(context: Context): String {
        val sp = context.getSharedPreferences(SP, Context.MODE_PRIVATE)
        sp.getString(KEY_CODE, null)?.let { return it }

        val code = realMac() ?: fallbackCode(context)
        sp.edit().putString(KEY_CODE, code).apply()
        return code
    }

    /** Link encoded in the QR code. */
    fun siteLink(code: String): String =
        "$SITE_BASE/?code=" + URLEncoder.encode(normalize(code), "UTF-8")

    /** Only the characters expected by the website (A-Z 0-9). */
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

    // --------------------------------------------------------------- internal

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

    /** Code derived from the device when the real MAC is not exposed. */
    private fun fallbackCode(context: Context): String {
        val androidId = runCatching {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        }.getOrNull().orEmpty()

        val seed = androidId + "|" + android.os.Build.MODEL + "|" + android.os.Build.BRAND
        val digest = MessageDigest.getInstance("SHA-256").digest(seed.toByteArray())
        return digest.take(6).joinToString(":") { "%02X".format(it) }
    }
}
