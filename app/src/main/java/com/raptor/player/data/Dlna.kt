package com.raptor.player.data

import android.content.Context
import android.net.wifi.WifiManager
import android.util.Xml
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.xmlpull.v1.XmlPullParser
import java.io.IOException
import java.io.StringReader
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.SocketTimeoutException
import java.net.URI
import java.util.concurrent.TimeUnit

/** Uma TV/renderizador DLNA encontrado na rede local. */
data class DlnaDevice(
    val name: String,
    val controlUrl: String,
    val location: String
)

/**
 * Transmissão DLNA (UPnP AVTransport).
 *
 * O celular e a TV precisam estar na mesma rede Wi-Fi. O app procura os
 * aparelhos por SSDP, pede a descrição XML de cada um e manda o vídeo direto
 * para a TV — o vídeo não passa pela tela do celular.
 */
object Dlna {

    private val client = OkHttpClient.Builder()
        .connectTimeout(4, TimeUnit.SECONDS)
        .readTimeout(8, TimeUnit.SECONDS)
        .build()

    private const val SERVICE = "urn:schemas-upnp-org:service:AVTransport:1"
    private const val SEARCH_TARGET = "urn:schemas-upnp-org:device:MediaRenderer:1"
    private const val SSDP_HOST = "239.255.255.250"
    private const val SSDP_PORT = 1900

    private val M3U8 = Regex("\\.m3u8(\\?.*)?$", RegexOption.IGNORE_CASE)

    /**
     * Procura TVs na rede. Devolve a lista já sem repetidos.
     * Usa MulticastLock porque muitos celulares bloqueiam o pacote SSDP
     * quando a tela apaga ou o Wi-Fi entra em economia de energia.
     */
    suspend fun discover(context: Context, timeoutMs: Int = 3200): List<DlnaDevice> =
        withContext(Dispatchers.IO) {
            val wifi = context.applicationContext
                .getSystemService(Context.WIFI_SERVICE) as? WifiManager
            val lock = runCatching {
                wifi?.createMulticastLock("raptor-dlna")?.apply {
                    setReferenceCounted(false)
                    acquire()
                }
            }.getOrNull()

            try {
                val locations = LinkedHashSet<String>()
                val socket = DatagramSocket()
                try {
                    socket.soTimeout = 700
                    val message = (
                        "M-SEARCH * HTTP/1.1\r\n" +
                            "HOST: $SSDP_HOST:$SSDP_PORT\r\n" +
                            "MAN: \"ssdp:discover\"\r\n" +
                            "MX: 2\r\n" +
                            "ST: $SEARCH_TARGET\r\n" +
                            "\r\n"
                        ).toByteArray(Charsets.UTF_8)
                    val address = InetAddress.getByName(SSDP_HOST)
                    val packet = DatagramPacket(message, message.size, address, SSDP_PORT)

                    // Manda 3 vezes: um pacote UDP pode se perder.
                    repeat(3) { runCatching { socket.send(packet) } }

                    val deadline = System.currentTimeMillis() + timeoutMs
                    val buffer = ByteArray(4096)
                    while (System.currentTimeMillis() < deadline) {
                        val response = DatagramPacket(buffer, buffer.size)
                        try {
                            socket.receive(response)
                        } catch (timeout: SocketTimeoutException) {
                            continue
                        }
                        val text = String(response.data, 0, response.length, Charsets.UTF_8)
                        val location = text.lineSequence()
                            .firstOrNull { it.startsWith("LOCATION:", ignoreCase = true) }
                            ?.substringAfter(':')
                            ?.trim()
                        if (!location.isNullOrBlank()) locations.add(location)
                    }
                } finally {
                    runCatching { socket.close() }
                }

                locations.mapNotNull { resolveDevice(it) }
                    .distinctBy { it.controlUrl }
            } finally {
                runCatching { lock?.release() }
            }
        }

    /** Lê o XML de descrição do aparelho e pega o controle AVTransport. */
    private fun resolveDevice(location: String): DlnaDevice? = runCatching {
        val request = Request.Builder()
            .url(location)
            .header("User-Agent", "Raptor/1.2 (Android)")
            .build()
        val xml = client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return@runCatching null
            response.body?.string() ?: return@runCatching null
        }
        parseDescription(location, xml)
    }.getOrNull()

    private fun parseDescription(location: String, xml: String): DlnaDevice? {
        val parser = Xml.newPullParser()
        parser.setInput(StringReader(xml))

        var friendlyName: String? = null
        var inService = false
        var serviceType: String? = null
        var controlUrl: String? = null

        var event = parser.eventType
        while (event != XmlPullParser.END_DOCUMENT) {
            when (event) {
                XmlPullParser.START_TAG -> when (parser.name.lowercase()) {
                    "friendlyname" -> if (friendlyName.isNullOrBlank()) {
                        friendlyName = parser.nextText().trim()
                    }

                    "service" -> {
                        inService = true
                        serviceType = null
                        controlUrl = null
                    }

                    "servicetype" -> if (inService) {
                        serviceType = parser.nextText().trim()
                    }

                    "controlurl" -> if (inService) {
                        controlUrl = parser.nextText().trim()
                    }
                }

                XmlPullParser.END_TAG -> if (
                    inService && parser.name.equals("service", ignoreCase = true)
                ) {
                    if (
                        serviceType?.contains("AVTransport", ignoreCase = true) == true &&
                        !controlUrl.isNullOrBlank()
                    ) {
                        return DlnaDevice(
                            name = friendlyName?.takeIf { it.isNotBlank() } ?: "TV",
                            controlUrl = resolveUrl(location, controlUrl!!),
                            location = location
                        )
                    }
                    inService = false
                }
            }
            event = parser.next()
        }
        return null
    }

    private fun resolveUrl(base: String, reference: String): String =
        runCatching { URI(base).resolve(reference).toString() }.getOrDefault(reference)

    /**
     * Manda o vídeo para a TV e dá play.
     *
     * Canal ao vivo chega como `.m3u8`; a maioria das TVs LG não abre HLS por
     * DLNA, então usamos o mesmo stream em `.ts`, que é o formato nativo delas.
     */
    suspend fun cast(device: DlnaDevice, url: String, title: String): Result<Unit> =
        withContext(Dispatchers.IO) {
            runCatching {
                val target = castableUrl(url)
                val mime = mimeFor(target)

                // Primeiro com o tipo real; se a TV recusar, tenta o genérico.
                val sent = runCatching {
                    setUri(device.controlUrl, target, title, mime)
                }.isSuccess || runCatching {
                    setUri(device.controlUrl, target, title, "*")
                }.isSuccess

                if (!sent) throw IOException("A TV não aceitou este vídeo")

                soap(
                    device.controlUrl,
                    "Play",
                    "<InstanceID>0</InstanceID><Speed>1</Speed>"
                )
            }
        }

    /** Para o que estiver tocando na TV. */
    suspend fun stop(device: DlnaDevice): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            soap(device.controlUrl, "Stop", "<InstanceID>0</InstanceID>")
        }
    }

    private fun setUri(controlUrl: String, url: String, title: String, mime: String) {
        val metadata = didl(title, url, mime)
        soap(
            controlUrl,
            "SetAVTransportURI",
            "<InstanceID>0</InstanceID>" +
                "<CurrentURI>${xmlEscape(url)}</CurrentURI>" +
                "<CurrentURIMetaData>${xmlEscape(metadata)}</CurrentURIMetaData>"
        )
    }

    private fun soap(controlUrl: String, action: String, body: String) {
        val envelope = "<?xml version=\"1.0\" encoding=\"utf-8\"?>" +
            "<s:Envelope s:encodingStyle=\"http://schemas.xmlsoap.org/soap/encoding/\"" +
            " xmlns:s=\"http://schemas.xmlsoap.org/soap/envelope/\">" +
            "<s:Body><u:$action xmlns:u=\"$SERVICE\">$body</u:$action></s:Body>" +
            "</s:Envelope>"

        val request = Request.Builder()
            .url(controlUrl)
            .header("SOAPAction", "\"$SERVICE#$action\"")
            .header("Content-Type", "text/xml; charset=\"utf-8\"")
            .post(envelope.toRequestBody("text/xml; charset=utf-8".toMediaType()))
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                val detail = runCatching { response.body?.string() }.getOrNull().orEmpty()
                throw IOException("A TV respondeu ${response.code} ${detail.take(100)}".trim())
            }
        }
    }

    private fun didl(title: String, url: String, mime: String): String =
        "<DIDL-Lite" +
            " xmlns=\"urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/\"" +
            " xmlns:dc=\"http://purl.org/dc/elements/1.1/\"" +
            " xmlns:upnp=\"urn:schemas-upnp-org:metadata-1-0/upnp/\">" +
            "<item id=\"0\" parentID=\"-1\" restricted=\"1\">" +
            "<dc:title>${xmlEscape(title)}</dc:title>" +
            "<upnp:class>object.item.videoItem</upnp:class>" +
            "<res protocolInfo=\"http-get:*:$mime:*\">${xmlEscape(url)}</res>" +
            "</item></DIDL-Lite>"

    /** `.m3u8` -> `.ts` (canal ao vivo). Filmes/séries seguem como estão. */
    fun castableUrl(url: String): String = url.replace(M3U8, ".ts")

    private fun mimeFor(url: String): String {
        val path = url.substringBefore('?').lowercase()
        return when {
            path.endsWith(".ts") -> "video/mpeg"
            path.endsWith(".mkv") -> "video/x-matroska"
            path.endsWith(".mp4") || path.endsWith(".m4v") -> "video/mp4"
            path.endsWith(".avi") -> "video/avi"
            path.endsWith(".mov") -> "video/quicktime"
            path.endsWith(".m3u8") -> "application/vnd.apple.mpegurl"
            else -> "video/mp4"
        }
    }

    private fun xmlEscape(value: String): String = value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&apos;")
}
