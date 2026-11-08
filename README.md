# Reptor — IPTV Player

Aplicativo **original** para Android (celular e TV) escrito em Kotlin + Jetpack Compose + Media3.
Conecta-se a um servidor **Xtream Codes** ou a uma **lista M3U** fornecidos pelo usuário.

> Este projeto não contém código, recursos, layout ou backend de terceiros.
> Não há ativação, MAC, PIN, assinatura ou cobrança embutida.

---

## Requisitos

| Item | Versão |
|---|---|
| JDK | 17 ou 21 |
| Android SDK | Platform 35 + Build-Tools 35.0.0 |
| Gradle | 8.11.1 (via wrapper) |
| AGP | 8.7.3 |
| Kotlin | 1.9.24 |

## Como compilar

```bash
# Variáveis de ambiente
export JAVA_HOME=/caminho/para/jdk-21
export ANDROID_HOME=/caminho/para/android-sdk

# Debug (instalável imediatamente)
./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk

# Release (minificado, requer assinatura)
./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release-unsigned.apk
```

O arquivo `local.properties` deve apontar para o SDK:

```properties
sdk.dir=C\:\\caminho\\para\\android-sdk
```

## Assinatura (release)

```powershell
$sdk = "$env:ANDROID_HOME\build-tools\35.0.0"
& "$sdk\zipalign.exe" -f -p 4 app-release-unsigned.apk app-release-aligned.apk
& "$sdk\apksigner.bat" sign `
    --ks reptor-release.keystore --ks-key-alias reptor `
    --ks-pass pass:reptor123456 --key-pass pass:reptor123456 `
    --out Reptor-1.0.0.apk app-release-aligned.apk
& "$sdk\apksigner.bat" verify --print-certs Reptor-1.0.0.apk
```

⚠️ O keystore `reptor-release.keystore` deste repositório é de **desenvolvimento**.
Guarde-o se quiser atualizar o app depois (o Android exige a mesma chave), e troque a senha
para uma distribuição real.

## Estrutura

```
app/src/main/java/com/reptor/player/
├── MainActivity.kt          # navegação raiz (login ↔ home)
├── ReptorApp.kt
├── data/
│   ├── Models.kt            # Session, Category, MediaEntry, MediaKind
│   ├── Prefs.kt             # listas salvas + sessão atual
│   ├── SmartLink.kt         # detecção de link Xtream/M3U
│   ├── XtreamClient.kt      # cliente player_api.php
│   ├── M3uParser.kt         # parser de listas M3U/M3U8
│   └── PlaylistSource.kt    # abstração Xtream / M3U
└── ui/
    ├── theme/Theme.kt       # tema verde Reptor (dark-first)
    ├── LoginScreen.kt       # abas Xtream e M3U
    ├── HomeScreen.kt        # Ao vivo / Filmes / Séries
    └── PlayerScreen.kt      # Media3 ExoPlayer
```

## Funcionalidades

- Login em dois modos: **Xtream Codes** (servidor + usuário + senha) e **M3U** (URL ou arquivo).
- **Colar inteligente**: cole `get.php?...`, `host:porta` ou qualquer link e o app decide sozinho se é Xtream ou M3U, preenchendo os campos.
- **Importar arquivo `.m3u`** direto do aparelho (copia para o armazenamento privado do app).
- **Múltiplas listas salvas**: o cliente troca de provedor sem redigitar nada.
- Validação de login direto no servidor do usuário.
- Navegação por categorias em três seções: **Ao vivo**, **Filmes**, **Séries**.
- Player HLS/DASH com Media3 ExoPlayer, controle em tela cheia e `FLAG_KEEP_SCREEN_ON`.
- Suporte a TV: `LEANBACK_LAUNCHER`, banner, foco por D-pad com destaque verde.
- Sessão lembrada entre aberturas; botão **Listas** volta à tela de seleção.
- HTTP e HTTPS (servidores Xtream legados costumam ser HTTP).

## Limitações conhecidas (v1.0.0)

- Séries abrem o **primeiro episódio** da primeira temporada; ainda não há seletor de episódios.
- Sem EPG/guia de programação.
- Sem busca ou favoritos.
- Credenciais ficam em `SharedPreferences` privadas do app (sem criptografia adicional).
- Player não implementa PiP nem legendas manuais.

## Próximos passos sugeridos

1. Tela de detalhe de série com temporadas/episódios.
2. EPG via XMLTV (`get_simple_data_table`).
3. Busca local e favoritos.
4. Migrar credenciais para `EncryptedSharedPreferences`.
5. Suporte a múltiplos perfis/playlists.

## Aviso

Use apenas com servidores e playlists que você tem direito de acessar.
O app é um cliente: não fornece, hospeda nem distribui conteúdo.
