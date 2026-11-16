package com.raptor.player.ui

/**
 * Modo demonstração.
 *
 * Serve para quem está avaliando o app (Amazon, LG, Samsung) testar o player
 * sem precisar de lista, login ou credencial: são vídeos públicos de teste,
 * em MP4/H.264, servidos por HTTPS.
 *
 * Nada de conteúdo de terceiros, nada de IPTV e nada do usuário fica embutido
 * no APK — só estes quatro arquivos de exemplo, que qualquer pessoa pode tocar.
 */
object Demo {

    private const val BUCKET = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample"

    val items: List<PlayItem> = listOf(
        PlayItem("$BUCKET/BigBuckBunny.mp4", "Exemplo 1 · Big Buck Bunny"),
        PlayItem("$BUCKET/ElephantsDream.mp4", "Exemplo 2 · Elephants Dream"),
        PlayItem("$BUCKET/Sintel.mp4", "Exemplo 3 · Sintel"),
        PlayItem("$BUCKET/TearsOfSteel.mp4", "Exemplo 4 · Tears of Steel")
    )

    val first: PlayItem get() = items.first()
}
