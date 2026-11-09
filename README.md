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
├── MainActivity.kt          # navegação raiz (login ↔ home), tela sempre em paisagem
├── ReptorApp.kt
├── data/
│   ├── Models.kt            # Session, Category, MediaEntry, Episode, Season, SeriesDetail, EPG
│   ├── Prefs.kt             # listas salvas, favoritos, histórico, retomada
│   ├── SmartLink.kt         # detecção de link Xtream/M3U
│   ├── XtreamClient.kt      # player_api.php (canais, filmes e séries hierárquicas)
│   ├── M3uParser.kt         # parser M3U + classificação canal/filme/série
│   ├── M3uSeries.kt         # agrupa episódios em série → temporada → episódio
│   ├── EpgClient.kt         # grade de programação do meuguia.tv
│   └── PlaylistSource.kt    # abstração Xtream / M3U
└── ui/
    ├── theme/Theme.kt       # tema verde Reptor (dark-first)
    ├── LoginScreen.kt       # abas Xtream e M3U
    ├── Components.kt        # topo, menu, categorias, pôsteres, estados
    ├── ChannelsScreen.kt    # categorias | canais | prévia ao vivo + EPG
    ├── MoviesScreen.kt      # categorias + busca + ordenação + grade
    ├── SeriesScreen.kt      # séries → temporadas → episódios
    ├── SettingsScreen.kt    # conta, listas, limpeza, privacidade
    ├── HomeScreen.kt        # casca com as 4 abas
    └── PlayerScreen.kt      # Media3 ExoPlayer em tela cheia
```

## Funcionalidades

- Login em dois modos: **Xtream Codes** (servidor + usuário + senha) e **M3U** (URL ou arquivo).
- **Colar inteligente**: cole `get.php?...`, `host:porta` ou qualquer link e o app decide sozinho se é Xtream ou M3U, preenchendo os campos.
- **Importar arquivo `.m3u`** direto do aparelho (copia para o armazenamento privado do app).
- **Múltiplas listas salvas**: o cliente troca de provedor sem redigitar nada.
- Layout **horizontal (paisagem)**, pensado para TV, box e tablet.
- Menu principal com **Canais · Filmes · Séries · Ajustes**.
- **Canais**: painel de categorias com contagem, busca, lista numerada, prévia ao vivo muda,
  e abaixo dela o **EPG integrado** (programa atual + próximos) da grade gratuita do
  [meuguia.tv](https://meuguia.tv).
- **Filmes**: categorias, busca, ordenação (A-Z, Z-A, nota) e grade de pôsteres com nota.
- **Séries em hierarquia real**: categoria → série → temporada → episódio. Nenhum episódio
  solto na grade.
- Favoritos e histórico por seção (ao vivo, filmes, séries).
- Player HLS/DASH com Media3 ExoPlayer, tela cheia imersiva, retomada de posição,
  pausa ao sair do app e PiP.
- Suporte a TV: `LEANBACK_LAUNCHER`, banner, foco por D-pad com destaque verde.
- HTTP e HTTPS (servidores Xtream legados costumam ser HTTP).

## Limitações conhecidas (v1.2.0)

- O EPG usa o meuguia.tv por aproximação de nome; canais regionais podem casar com a
  grade do canal nacional equivalente.
- Listas M3U sem marcação de episódio (`S01E02`) podem gerar séries com um único episódio.
- Credenciais ficam em `SharedPreferences` privadas do app (sem criptografia adicional).

## Próximos passos sugeridos

1. EPG por XMLTV (`get_simple_data_table`) quando o provedor oferecer.
2. Migrar credenciais para `EncryptedSharedPreferences`.
3. Múltiplos perfis/playlists com sincronização opcional.

## Aviso

Use apenas com servidores e playlists que você tem direito de acessar.
O app é um cliente: não fornece, hospeda nem distribui conteúdo.
