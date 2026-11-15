package com.reptor.player.ui

import kotlinx.coroutines.TimeoutCancellationException

/**
 * Tempo máximo para a primeira carga de uma aba.
 *
 * Sem esse limite, uma lista gigante (ou um servidor que responde devagar)
 * deixava a tela em "Carregando…" para sempre, sem mensagem e sem saída.
 * Com o limite, o app para de esperar e mostra o erro com o botão de tentar
 * de novo.
 */
const val LOAD_TIMEOUT_MS = 75_000L

/** Mensagem curta e útil para o que deu errado ao carregar a lista. */
fun loadErrorMessage(error: Throwable, what: String): String = when (error) {
    is TimeoutCancellationException ->
        "O servidor demorou demais para responder. Verifique a internet e tente de novo."

    is OutOfMemoryError ->
        "Esta lista é grande demais para este aparelho. Abra uma pasta menor."

    is java.net.UnknownHostException ->
        "Servidor não encontrado. Confira o endereço da lista."

    is java.net.SocketTimeoutException ->
        "A conexão com o servidor expirou. Tente de novo."

    else -> error.message?.takeIf { it.isNotBlank() } ?: "Falha ao carregar $what"
}
