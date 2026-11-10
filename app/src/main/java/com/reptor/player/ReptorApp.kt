package com.reptor.player

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache

class ReptorApp : Application(), ImageLoaderFactory {

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    /**
     * Cache próprio para as capas: sem ele, cada rolagem baixa e decodifica
     * o mesmo pôster de novo, o que deixa a navegação pesada.
     */
    override fun newImageLoader(): ImageLoader =
        ImageLoader.Builder(this)
            .memoryCache {
                MemoryCache.Builder(this)
                    .maxSizePercent(0.20)
                    .build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizeBytes(160L * 1024 * 1024)
                    .build()
            }
            .crossfade(false)
            .build()

    companion object {
        lateinit var instance: ReptorApp
            private set
    }
}
