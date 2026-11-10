package com.reptor.player.ui

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.reptor.player.data.LoginMode
import com.reptor.player.data.Prefs
import com.reptor.player.data.Session
import com.reptor.player.data.SmartLink
import com.reptor.player.data.createSource
import com.reptor.player.data.displayName
import com.reptor.player.ui.theme.ReptorBackground
import com.reptor.player.ui.theme.ReptorGreen
import com.reptor.player.ui.theme.ReptorTextDim
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException

@Composable
fun LoginScreen(onLoggedIn: (Session) -> Unit) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val prefs = remember { Prefs(context) }

    var saved by remember { mutableStateOf(prefs.savedLists()) }
    var mode by rememberSaveable { mutableStateOf(LoginMode.XTREAM) }
    var host by rememberSaveable { mutableStateOf("") }
    var user by rememberSaveable { mutableStateOf("") }
    var pass by rememberSaveable { mutableStateOf("") }
    var m3u by rememberSaveable { mutableStateOf("") }
    var smart by rememberSaveable { mutableStateOf("") }
    var hint by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun login(session: Session) {
        if (loading) return
        loading = true
        error = null
        scope.launch {
            val result = try {
                createSource(session).check()
            } catch (e: Exception) {
                e.message ?: "Falha inesperada"
            }
            loading = false
            if (result.isEmpty()) onLoggedIn(session) else error = result
        }
    }

    fun submit() {
        if (loading) return
        val session = when (mode) {
            LoginMode.XTREAM -> {
                if (host.isBlank() || user.isBlank() || pass.isBlank()) {
                    error = "Preencha servidor, usuário e senha."
                    return
                }
                Session(LoginMode.XTREAM, host.trim(), user.trim(), pass.trim())
            }

            LoginMode.M3U -> {
                if (m3u.isBlank()) {
                    error = "Informe a URL da lista ou importe um arquivo .m3u."
                    return
                }
                Session(LoginMode.M3U, m3uUrl = m3u.trim())
            }
        }
        login(session)
    }

    fun applyDetection(detected: SmartLink.Detected) {
        when (detected.mode) {
            LoginMode.XTREAM -> {
                mode = LoginMode.XTREAM
                if (detected.host.isNotBlank()) host = detected.host
                if (detected.user.isNotBlank()) user = detected.user
                if (detected.pass.isNotBlank()) pass = detected.pass
                hint = if (detected.user.isNotBlank()) {
                    "Xtream detectado: servidor, usuário e senha preenchidos."
                } else {
                    "Servidor Xtream detectado."
                }
            }

            LoginMode.M3U -> {
                mode = LoginMode.M3U
                m3u = detected.m3u
                hint = "Lista M3U detectada."
            }
        }
    }

    fun importFile(uri: Uri) {
        if (loading) return
        loading = true
        error = null
        scope.launch {
            val session: Session? = try {
                withContext(Dispatchers.IO) {
                    val name = displayName(context, uri) ?: "lista.m3u"
                    val dir = File(context.filesDir, "playlists").apply { mkdirs() }
                    val safe = name.replace(Regex("[^A-Za-z0-9._-]"), "_")
                    val target = File(dir, "${System.currentTimeMillis()}_$safe")
                    context.contentResolver.openInputStream(uri)?.use { input ->
                        target.outputStream().use { output -> input.copyTo(output) }
                    } ?: throw IOException("não foi possível ler o arquivo")

                    val label = name.substringBeforeLast('.').ifBlank { "Lista importada" }
                    Session(LoginMode.M3U, m3uUrl = target.absolutePath, label = label)
                }
            } catch (e: Exception) {
                error = "Falha ao importar: ${e.message}"
                null
            }
            loading = false
            if (session != null) {
                mode = LoginMode.M3U
                m3u = session.m3uUrl
                login(session)
            }
        }
    }

    val importLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri -> if (uri != null) importFile(uri) }

    fun pick(session: Session) {
        mode = session.mode
        host = session.baseUrl
        user = session.username
        pass = session.password
        m3u = session.m3uUrl
        hint = null
        login(session)
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(ReptorBackground, Color(0xFF07260F), ReptorBackground)
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 28.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "REPTOR",
                color = ReptorGreen,
                fontSize = 44.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 10.sp
            )
            Text(
                text = "IPTV PLAYER",
                color = ReptorTextDim,
                fontSize = 12.sp,
                letterSpacing = 6.sp
            )
            Spacer(Modifier.height(24.dp))

            // Listas já salvas
            if (saved.isNotEmpty()) {
                Text(
                    text = "CONTINUAR COM",
                    color = ReptorTextDim,
                    fontSize = 11.sp,
                    letterSpacing = 2.sp,
                    modifier = Modifier.fillMaxWidth().widthIn(max = 520.dp)
                )
                Spacer(Modifier.height(8.dp))
                Column(
                    modifier = Modifier.fillMaxWidth().widthIn(max = 520.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    saved.take(6).forEach { item ->
                        SavedRow(
                            session = item,
                            onClick = { pick(item) },
                            onRemove = {
                                prefs.removeList(item)
                                saved = prefs.savedLists()
                            }
                        )
                    }
                }
                Spacer(Modifier.height(24.dp))
            }

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .widthIn(max = 520.dp),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.94f)
                )
            ) {
                Column(Modifier.padding(20.dp)) {
                    OutlinedTextField(
                        value = smart,
                        onValueChange = { value ->
                            smart = value
                            if (SmartLink.looksComplete(value)) {
                                SmartLink.detect(value)?.let { applyDetection(it) }
                            }
                        },
                        label = { Text("Cole seu link ou servidor") },
                        placeholder = { Text("http://servidor:8080/get.php?username=...") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                        trailingIcon = {
                            TextButton(onClick = {
                                val text = clipboard.getText()?.text.orEmpty().trim()
                                if (text.isNotEmpty()) {
                                    smart = text
                                    SmartLink.detect(text)?.let { applyDetection(it) }
                                }
                            }) {
                                Text("Colar", color = ReptorGreen, fontSize = 13.sp)
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    )

                    hint?.let {
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = it,
                            color = ReptorGreen,
                            fontSize = 12.sp,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }

                    Spacer(Modifier.height(16.dp))

                    TabRow(
                        selectedTabIndex = mode.ordinal,
                        containerColor = Color.Transparent,
                        contentColor = ReptorGreen
                    ) {
                        Tab(
                            selected = mode == LoginMode.XTREAM,
                            onClick = { mode = LoginMode.XTREAM; error = null },
                            text = { Text("Xtream Codes") }
                        )
                        Tab(
                            selected = mode == LoginMode.M3U,
                            onClick = { mode = LoginMode.M3U; error = null },
                            text = { Text("Lista M3U") }
                        )
                    }

                    Spacer(Modifier.height(20.dp))

                    if (mode == LoginMode.XTREAM) {
                        OutlinedTextField(
                            value = host,
                            onValueChange = { host = it },
                            label = { Text("Servidor (URL ou IP:porta)") },
                            placeholder = { Text("http://meuservidor.com:8080") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = user,
                            onValueChange = { user = it },
                            label = { Text("Usuário") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(12.dp))
                        OutlinedTextField(
                            value = pass,
                            onValueChange = { pass = it },
                            label = { Text("Senha") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        OutlinedTextField(
                            value = m3u,
                            onValueChange = { m3u = it },
                            label = { Text("URL da lista M3U") },
                            placeholder = { Text("http://servidor/get.php?username=...") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = "Também aceita um arquivo .m3u importado do aparelho.",
                            color = ReptorTextDim,
                            fontSize = 11.sp
                        )
                    }

                    Spacer(Modifier.height(20.dp))

                    Button(
                        onClick = { submit() },
                        enabled = !loading,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp),
                        shape = RoundedCornerShape(14.dp)
                    ) {
                        if (loading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(22.dp),
                                strokeWidth = 2.dp,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                        } else {
                            Text("Entrar", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Spacer(Modifier.height(8.dp))
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
                    Spacer(Modifier.height(8.dp))

                    TextButton(
                        onClick = { importLauncher.launch(arrayOf("*/*")) },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !loading
                    ) {
                        Text(
                            text = "Importar arquivo .m3u",
                            color = ReptorGreen,
                            fontSize = 13.sp
                        )
                    }

                    error?.let { message ->
                        Spacer(Modifier.height(10.dp))
                        Text(
                            text = message,
                            color = MaterialTheme.colorScheme.error,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            Spacer(Modifier.height(24.dp))
            Text(
                text = "Nenhuma ativação. Nenhum MAC. Apenas a sua lista.",
                color = ReptorTextDim,
                fontSize = 12.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "Player de vídeo: você é responsável pelo conteúdo da sua lista.",
                color = ReptorTextDim.copy(alpha = 0.75f),
                fontSize = 10.sp,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(20.dp))
        }
    }
}

@Composable
private fun SavedRow(
    session: Session,
    onClick: () -> Unit,
    onRemove: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.75f))
            .clickable(onClick = onClick)
            .padding(start = 14.dp, end = 6.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                text = session.displayName(),
                color = MaterialTheme.colorScheme.onSurface,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = if (session.mode == LoginMode.XTREAM) "Xtream Codes" else "Lista M3U",
                color = ReptorTextDim,
                fontSize = 11.sp
            )
        }
        TextButton(onClick = onRemove) {
            Text("Remover", color = ReptorTextDim, fontSize = 11.sp)
        }
    }
}

private fun displayName(context: Context, uri: Uri): String? {
    val cursor = context.contentResolver.query(
        uri,
        arrayOf(OpenableColumns.DISPLAY_NAME),
        null,
        null,
        null
    )
    cursor?.use {
        if (it.moveToFirst()) {
            val index = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (index >= 0) return it.getString(index)
        }
    }
    return null
}
