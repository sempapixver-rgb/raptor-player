package com.raptor.player.data

import android.content.Context

/** Screen device found on the local network. */
data class StoreDlnaDevice(
    val name: String,
    val controlUrl: String,
    val location: String
)

/**
 * In the store edition, the cast-to-screen button is disabled.
 * These methods exist only to keep the player interface consistent.
 */
object StoreDlna {
    suspend fun discover(context: Context, timeoutMs: Int = 3200): List<StoreDlnaDevice> = emptyList()

    suspend fun cast(device: StoreDlnaDevice, url: String, title: String): Result<Unit> =
        Result.failure(IllegalStateException("unavailable"))

    suspend fun stop(device: StoreDlnaDevice): Result<Unit> = Result.success(Unit)
}
