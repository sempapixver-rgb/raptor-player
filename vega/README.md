# Raptor Player — VegaOS (Fire TV Stick 4K Select)

Aplicativo de TV feito em React Native para **VegaOS**, o sistema do
Fire TV Stick 4K Select. É a mesma identidade do app Android/webOS:
um **tocador de vídeo** com ativação por código, sem conteúdo embutido.

- Pacote: `com.raptor.player.store`
- Componente: `com.raptor.player.store.main`
- Versão: `1.0.1` (build `2026112701`)
- Vega OS: mínimo e alvo `1.2`
- Arquitetura: `armv7` (Fire TV Stick 4K Select)

## Estrutura

```
vega/
├── manifest.toml          manifesto Vega (serviços de mídia, rede, teclado)
├── app.json               nome do componente para o runtime Kepler
├── index.js               registro do app
├── assets/                ícone 512, ícone 114 e feature graphic 1024x500
├── scripts/
│   └── build-submission.sh  gera o .vpkg com build_number válido
└── src/
    ├── App.tsx            rotas; player por cima da aba (como no Fire OS)
    ├── theme.ts           cores, espaçamentos e raios
    ├── types.ts           tipos de catálogo, fonte, ativação e fila
    ├── components/
    │   ├── ui.tsx         focáveis, botões, cabeçalho, tile, estados
    │   └── DlnaSheet.tsx  envio para TV na rede (📺 TV)
    ├── screens/
    │   ├── TermsScreen.tsx       termos de uso no primeiro início
    │   ├── ActivationScreen.tsx  código do aparelho + consulta ao site
    │   ├── HomeScreen.tsx        menu Canais / Filmes / Séries / Ajustes
    │   ├── SectionScreen.tsx     layout por aba, pastas, favoritos e recentes
    │   ├── PlayerScreen.tsx      retomada, escala, fila, seek e DLNA
    │   └── SettingsScreen.tsx    conta, demonstração e sobre
    └── core/
        ├── activation.ts  consulta /api/device no site
        ├── device.ts      código estável do aparelho (formato MAC)
        ├── xtream.ts      cliente Xtream (categorias, pasta, episódios)
        ├── m3u.ts         parser de playlist M3U com cache
        ├── demo.ts        catálogo público de demonstração
        ├── library.ts     carrega categorias e uma pasta por vez
        ├── favorites.ts   favoritos e vistos recentemente
        ├── dlna.ts        AVTransport (SetAVTransportURI / Play / Stop)
        ├── sourceStore.ts salva/limpa a configuração da conta
        ├── storage.ts     AsyncStorage com prefixo
        └── format.ts      tempo e normalização de texto
```

## Requisitos

- Node 18+ (o SDK da Vega pede a versão indicada na documentação)
- Vega SDK e `vega` CLI no PATH
- Conta de desenvolvedor Amazon (para instalar no aparelho e publicar)

## Desenvolvimento

```bash
npm install
npm start                 # Metro
npm run build:debug       # pacote de depuração
```

Para instalar no Fire TV Stick 4K Select é preciso o modo de
desenvolvedor do Vega e o endereço do aparelho na rede.

## Pacote para a Amazon

```bash
npm run build:submission
```

O script:

1. Lê `APP_VERSION` e `BUILD_NUMBER` de `src/config/app.ts`.
2. Converte `20261114.01` em `2026111401` (a Amazon recusa `0`).
3. Gera `build/armv7-release/raptor_armv7.vpkg`.
4. Confere o `build_number` e recusa bibliotecas de outra arquitetura.

Envie o `.vpkg` no Amazon Developer Console em **Vega OS → seu app →
Upload de binário**. A ficha da loja e o checklist estão em
[`docs/AMAZON-SUBMISSAO.md`](docs/AMAZON-SUBMISSAO.md).

## Navegação

- Menu principal ao abrir: Canais, Filmes, Séries e Ajustes.
- **Canais**: três colunas (pastas, lista e detalhe) com prévia do item
  selecionado. Canal nunca recebe seek.
- **Filmes e Séries**: a pasta é obrigatória; a aba lembra a última pasta e
  oferece Favoritos, Visto recentemente e ordenação em Filmes.
- A busca só consulta o índice completo depois de 2 letras.
- O player abre por cima da aba: ao voltar, pasta, busca e posição da lista
  continuam onde estavam.
- Séries abrem a lista de episódios; só episódios avançam sozinhos no fim.
- Filmes e séries retomam de onde pararam; ao terminar, a posição é limpa.
- **Ajustar** alterna o enquadramento (Ajustar/Preencher/Esticar).
- **Velocidade** (0,5x a 2x), **Áudio** (faixas) e **Legendas** no rodapé,
  como no Fire OS; velocidade fica salva no aparelho.
- Seek manual (−10s, +10s e “Pular abertura”) apenas em filmes e séries.
- Botão **📺 TV** envia o vídeo para uma TV DLNA na mesma rede (endereço
  salvo no aparelho). HLS de canal é convertido para `.ts`.
- Rodapé do player: Anterior/Próximo; retry e watchdog reiniciam o vídeo com
  URL nova se a reprodução travar. As teclas de mídia também funcionam.

## Privacidade e conteúdo

O app não inclui, hospeda ou distribui conteúdo. Ele guarda no aparelho
apenas o código de ativação e a configuração da conta. A única chamada
externa é a consulta de ativação em `https://raptor-player.netlify.app`.
Não usa anúncios, Google Play Services, Firebase ou rastreamento.

O modo de demonstração reproduz vídeos públicos, sem conta e sem lista,
para testes e para a análise da loja.
