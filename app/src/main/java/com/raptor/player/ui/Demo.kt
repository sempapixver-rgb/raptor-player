package com.raptor.player.ui

/**
 * Modo demonstração.
 *
 * Serve para quem está avaliando o app (Amazon, LG, Samsung) testar o player
 * sem precisar de lista, login ou credencial: são clipes abertos (licença
 * CC-BY, Blender Foundation), em MP4/H.264, servidos por HTTPS, com suporte a
 * avançar/retroceder (HTTP Range).
 *
 * Os arquivos ficam publicados nos Releases do próprio projeto, então não
 * dependem de servidor de terceiros e não expiram.
 *
 * Nada de conteúdo de terceiros, nada de IPTV e nada do usuário fica embutido
 * no APK — só estes endereços, que qualquer pessoa pode tocar.
 */
object Demo {

    private const val BASE =
        "https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/"

    val items: List<PlayItem> = listOf(
        PlayItem(BASE + "demo-1.mp4", "Exemplo 1 · Sintel (720p)"),
        PlayItem(BASE + "demo-2.mp4", "Exemplo 2 · Big Buck Bunny (trailer)"),
        PlayItem(BASE + "demo-3.mp4", "Exemplo 3 · Sintel (trailer)"),
        PlayItem(BASE + "demo-4.mp4", "Exemplo 4 · Águas-vivas (720p)")
    )

    val first: PlayItem get() = items.first()
}
