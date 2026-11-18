package com.raptor.player.ui

/**
 * Public sample videos for the store edition. Open clips (CC-BY, Blender
 * Foundation) in MP4/H.264, hosted in the project's Releases.
 * No other material is bundled in the package.
 */
object StoreDemo {

    private const val BASE =
        "https://github.com/sempapixver-rgb/raptor-player/releases/download/demo-media/"

    val items: List<DemoPlayItem> = listOf(
        DemoPlayItem(BASE + "demo-1.mp4", "Sample 1 · Sintel (720p)"),
        DemoPlayItem(BASE + "demo-2.mp4", "Sample 2 · Big Buck Bunny (trailer)"),
        DemoPlayItem(BASE + "demo-3.mp4", "Sample 3 · Sintel (trailer)"),
        DemoPlayItem(BASE + "demo-4.mp4", "Sample 4 · Jellyfish (720p)")
    )
}
