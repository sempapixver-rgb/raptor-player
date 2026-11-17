package com.raptor.player.data

import android.content.Context

/** Aparelho de tela encontrado na rede local. */
data class StoreDlnaDevice(
    val name: String,
    val controlUrl: String,
    val location: String
)

/**
 * Na edição de loja o botão de enviar para outra tela fica desligado.
 * Estes métodos existem apenas para manter a mesma interface do player.
 */
object StoreDlna {
    suspend fun discover(context: Context, timeoutMs: Int = 3200): List<StoreDlnaDevice> = emptyList()

    suspend fun cast(device: StoreDlnaDevice, url: String, title: String): Result<Unit> =
        Result.failure(IllegalStateException("indisponível"))

    suspend fun stop(device: StoreDlnaDevice): Result<Unit> = Result.success(Unit)
}
