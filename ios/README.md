# Raptor para iPhone (iOS / SwiftUI)

Portabilidade nativa do app Android (Kotlin + Compose) para **iPhone e iPad**.
O projeto é um app iOS real: gera `.ipa`, instala pelo TestFlight/App Store e aparece
na tela inicial como qualquer app nativo. **Não é** um atalho da web nem um APK convertido.

> Gerado a partir de `app/src/full` e `app/src/store` do mesmo repositório.
> O códigoAndroid continua intacto; esta pasta é independente.

## O que está incluído

- Termo de uso (versão 2, mesmo texto do Android) com aceite obrigatório.
- Ativação pelo site (`raptor-player.netlify.app`) com QR gerado pelo Core Image,
  polling de 5 s (20 tentativas) e depois 20 s, e atalho "URL dos vídeos".
- Login **Xtream Codes** e **M3U** (URL ou arquivo `.m3u` importado da Files),
  colagem inteligente de `get.php`, `host:porta` e links de lista.
- Múltiplas listas salvas (20), com troca e remoção.
- **Canais**: categorias, busca global após 2 caracteres, paginação de 60,
  favoritos, recentes e EPG do meuguia.tv (AGORA / A SEGUIR).
- **Filmes**: categorias, busca, ordenação (Padrão / A-Z / Z-A / nota), pôsteres.
- **Séries**: categoria → série → temporada → episódio, com início automático
  do primeiro episódio (como no Android).
- **Player**: AVPlayer nativo (HLS/MP4), retomada de posição, fila com
  anterior/próximo, auto-advance de episódios, velocidade 0,5×–2×,
  saltos de ±30 s e ±5 min, slider, "AO VIVO", tela cheia e orientação livre.
- **Ajustes**: conta/validade, trocar lista, atualizar catálogo, limpar
  favoritos/histórico, termos, privacidade e informações do aparelho.
- Modo demonstração com os mesmos clipes públicos do Android (para revisão da loja).

## Pré-requisitos (no Mac)

| Item | Versão |
|---|---|
| Xcode | 16.x |
| iOS SDK | 16.0+ (deploy target) |
| Apple Developer | **Gratuito** para instalar no seu iPhone; **pago** para TestFlight/App Store |
| Mac com Xcode | obrigatório (Windows não compila IPA) |

## Como abrir e rodar no iPhone

1. Copie esta pasta `ios/` para o Mac.
2. Abra `Raptor.xcodeproj` no Xcode.
3. Selecione o target **Raptor** → aba **Signing & Capabilities**.
   - Marque **Automatically manage signing**.
   - Em **Team**, selecione seu Apple ID (pessoal funciona para instalação direta).
   - Troque o **Bundle Identifier** se quiser um único nome (ex.: `com.seunome.raptor`).
4. Conecte o iPhone via USB e selecione-o como destino de execução.
5. No iPhone: **Ajustes › Geral › Gerenciamento de dispositivo/VPN** → confie no seu certificado
   (necessário apenas com conta gratuita).
6. Pressione **⌘R**. O app aparece na tela inicial como um app normal.

## Como publicar (TestFlight / App Store)

1. No target, mude **Bundle ID** para um registrado no App Store Connect
   (ex.: `com.raptor.player.iphone`).
2. Crie o app no [App Store Connect](https://appstoreconnect.apple.com) com o mesmo Bundle ID.
3. No Xcode: **Product › Archive**（arquivo) → **Distribute App** → **App Store Connect** → **Upload**.
4. No App Store Connect, preencha:
   - Categoria principal: **Entretenimento** (ou *Utilitários*);
   - Capturas de tela de iPhone (6,9" e 6,5"/6,7" conforme necessário);
   - Descrição: "Player de vídeo. Você informa sua própria lista Xtream Codes ou M3U. O app não fornece conteúdo.";
   - Política de privacidade: use a página `/privacidade` do site de ativação;
   - **App Review Information**: inclua um usuário de teste ou deixe o botão
     "Testar o player (vídeos de exemplo)" visível — os clipes públicos facilitam a aprovação.
5. Envie para **TestFlight** primeiro (build interno/externo) e depois para revisão da App Store.

## Ajustes antes de enviar

- **ATS / HTTP**: o app permite `NSAllowsArbitraryLoads` porque servidores Xtream
  legados usam `http://`. Na revisão, justifique: "necessary to connect to user-provided
  IPTV servers, many of which only support HTTP". Se o seu provedor usar apenas HTTPS,
  remova essa chave de `Raptor/Info.plist`.
- **Áudio em segundo plano**: `UIBackgroundModes = audio` está ativado para reproduzir
  com a tela bloqueada. Sem isso, o áudio para.
- **Ícone**: os PNGs foram gerados a partir do `ic_launcher.png` do Android. Troque
  `Raptor/Assets.xcassets/AppIcon.appiconset/Icon-1024.png` por uma arte 1024×1024
  definitivo antes de publicar.
- **Versão**: `MARKETING_VERSION` e `CURRENT_PROJECT_VERSION` estão em
  `project.pbxproj` (também alteráveis na aba General do Xcode).
- **Nome/Bundle**: `com.raptor.player.iphone` é um placeholder.

## Limitações conhecidas

- Não há DLNA/Chromecast (o Android usa UPnP próprio; no iOS exigiria outro protocolo).
- Não há PiP no iPhone nesta versão (evitamos entitlement limitado da Apple).
- Cache de categorias/itens é em memória; favoritos, listas, retomada e termos
  ficam em `UserDefaults` (equivalente ao `SharedPreferences` do Android).
- O EPG depende do HTML do meuguia.tv; se o site mudar, `EpgClient.swift` precisa
  de novas regexes (mesmo risco do Android).
- Esta pasta não foi compilada aqui (ambiente Windows sem Xcode); abra no Mac para
  resolver eventuais avisos do Swift 5/xcode.

## Estrutura

```
ios/
├── Raptor.xcodeproj/project.pbxproj   # gerado por generate_project.py
├── generate_project.py                # rode se adicionar arquivos .swift
└── Raptor/
    ├── RaptorApp.swift                # termos → login → home → player (overlay)
    ├── Info.plist
    ├── Raptor.entitlements
    ├── Assets.xcassets/
    ├── Data/
    │   ├── Models.swift               # Session, MediaEntry, SeriesDetail...
    │   ├── Prefs.swift                # lists, favorites, recents, resume (pos:hash)
    │   ├── SmartLink.swift
    │   ├── XtreamClient.swift         # player_api.php + fallback https→http
    │   ├── M3uParser.swift / M3uSeries.swift
    │   ├── EpgClient.swift            # meuguia.tv
    │   ├── PlaylistSource.swift       # Xtream / M3U
    │   ├── RaptorStore.swift          # estado global + cache
    │   ├── Activation.swift           # site + QR (Core Image)
    │   └── Demo.swift
    └── UI/
        ├── Theme.swift / Components.swift
        ├── TermsScreen.swift / LoginScreen.swift / HomeScreen.swift
        ├── ChannelsScreen.swift / MoviesScreen.swift / SeriesScreen.swift
        ├── SettingsScreen.swift / PlayerScreen.swift
```

Para regenerar o projeto Xcode depois de adicionar/remover arquivos Swift:

```bash
python3 ios/generate_project.py
```
