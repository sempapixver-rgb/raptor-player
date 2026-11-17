package com.raptor.player.data

import android.content.Context

/** Preferências locais da edição de loja. Nada é enviado para fora. */
class Prefs(context: Context) {

    private val sp = context.applicationContext
        .getSharedPreferences("raptor_session", Context.MODE_PRIVATE)

    fun acceptedTermsVersion(): Int = sp.getInt("terms_version", 0)

    fun acceptTerms(version: Int) {
        sp.edit().putInt("terms_version", version).apply()
    }

    fun resumeFor(url: String): Long = sp.getLong("pos:${url.hashCode()}", 0L)

    fun saveResume(url: String, position: Long) {
        sp.edit().putLong("pos:${url.hashCode()}", position).apply()
    }
}
