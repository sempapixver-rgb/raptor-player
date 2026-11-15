# Raptor Player — VegaOS (Fire TV Stick 4K Select)

Aplicativo de TV feito em React Native para **VegaOS**, o sistema do
Fire TV Stick 4K Select. É a mesma identidade do app Android/webOS:
um **tocador de vídeo** com ativação por código, sem conteúdo embutido.

- Pacote: `com.raptor.player.vega`
- Componente: `com.raptor.player.vega.main`
- Versão: `1.0.0` (build `2026111401`)
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
    ├── App.tsx            rotas e fluxo (termos → ativação → menu → aba → player)
    ├── theme.ts           cores, espaçamentos e raios
    ├── types.ts           tipos de catálogo, fonte e ativação
    ├── components/ui.tsx  focáveis, botões, cabeçalho, tile, estados
    ├── screens/
    │   ├── TermsScreen.tsx       termos de uso no primeiro início
    │   ├── ActivationScreen.tsx  código do aparelho + consulta ao site
    │   ├── HomeScreen.tsx        menu Canais / Filmes / Séries / Ajustes
    │   ├── SectionScreen.tsx     categorias, busca e episódios
    │   ├── PlayerScreen.tsx      player W3C + controles de TV
    │   └── SettingsScreen.tsx    conta, demonstração e sobre
    └── core/
        ├── activation.ts  consulta /api/device no site
        ├── device.ts      código estável do aparelho (formato MAC)
        ├── xtream.ts      cliente Xtream (categorias, itens, episódios)
        ├── m3u.ts         parser de playlist M3U com cache
        ├── demo.ts        catálogo público de demonstração
        ├── library.ts     carrega uma aba inteira
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
- D-pad navega; **OK** abre; **Voltar** retorna ao menu (e fecha o player).
- Na aba, a busca procura em todas as pastas daquela aba.
- Séries abrem a lista de episódios; ao terminar um episódio, o próximo
  da lista começa automaticamente.
- Player: OK/Pausar, −10s, +10s, Anterior, Próximo e barra de progresso.
  As teclas de mídia do controle também funcionam.

## Privacidade e conteúdo

O app não inclui, hospeda ou distribui conteúdo. Ele guarda no aparelho
apenas o código de ativação e a configuração da conta. A única chamada
externa é a consulta de ativação em `https://reptor-player.netlify.app`.
Não usa anúncios, Google Play Services, Firebase ou rastreamento.

O modo de demonstração reproduz vídeos públicos, sem conta e sem lista,
para testes e para a análise da loja.
