package com.raptor.player.data

import android.content.Context

/** Aparelho de tela encontrado na rede local. */
data class DlnaDevice(
    val name: String,
    val controlUrl: String,
    val location: String
)

/**
 * Na edição de loja o botão de enviar para outra tela fica desligado.
 * Estes métodos existem apenas para manter a mesma interface do player.
 */
object Dlna {
    suspend fun discover(context: Context, timeoutMs: Int = 3200): List<DlnaDevice> = emptyList()

    suspend fun cast(device: DlnaDevice, url: String, title: String): Result<Unit> =
        Result.failure(IllegalStateException("indisponível"))

    suspend fun stop(device: DlnaDevice): Result<Unit> = Result.success(Unit)
}
