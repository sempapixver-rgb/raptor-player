package com.raptor.player.ui

/**
 * Vídeos públicos de exemplo da edição de loja. São clipes abertos (CC-BY,
 * Blender Foundation), em MP4/H.264, hospedados nos Releases do projeto.
 * Nenhum outro conteúdo é embutido no pacote.
 */
object StoreDemo {

    private const val BASE =
        "https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/"

    val items: List<DemoPlayItem> = listOf(
        DemoPlayItem(BASE + "demo-1.mp4", "Exemplo 1 · Sintel (720p)"),
        DemoPlayItem(BASE + "demo-2.mp4", "Exemplo 2 · Big Buck Bunny (trailer)"),
        DemoPlayItem(BASE + "demo-3.mp4", "Exemplo 3 · Sintel (trailer)"),
        DemoPlayItem(BASE + "demo-4.mp4", "Exemplo 4 · Águas-vivas (720p)")
    )
}
