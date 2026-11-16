package com.raptor.player.ui

/**
 * Modo demonstração.
 *
 * Serve para quem está avaliando o app (Amazon, LG, Samsung) testar o player
 * sem precisar de lista, login ou credencial: são vídeos públicos de teste,
 * em MP4/H.264, servidos por HTTPS e com suporte a seek.
 *
 * Nada de conteúdo de terceiros, nada de IPTV e nada do usuário fica embutido
 * no APK — só estes arquivos de exemplo, que qualquer pessoa pode tocar.
 */
object Demo {

    val items: List<PlayItem> = listOf(
        PlayItem(
            "https://storage.googleapis.com/exoplayer-test-media-0/BigBuckBunny_320x180.mp4",
            "Exemplo 1 · Big Buck Bunny"
        ),
        PlayItem(
            "https://media.w3.org/2010/05/sintel/trailer.mp4",
            "Exemplo 2 · Sintel (trailer)"
        ),
        PlayItem(
            "https://media.w3.org/2010/05/bunny/trailer.mp4",
            "Exemplo 3 · Big Buck Bunny (trailer)"
        ),
        PlayItem(
            "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_5MB.mp4",
            "Exemplo 4 · Big Buck Bunny 720p"
        )
    )

    val first: PlayItem get() = items.first()
}
