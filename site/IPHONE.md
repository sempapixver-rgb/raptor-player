# Raptor no iPhone — instalar sem Mac

Esta é a versão **instalável direto no iPhone**, sem Mac, sem Apple Developer e sem computador:
uma web app com `apple-mobile-web-app-capable`. Ela abre em tela cheia, ganha ícone na tela
inicial e usa o player de vídeo nativo do iOS (HLS/MP4). Os dados ficam no `localStorage` do aparelho.

Arquivos: `site/public/iphone/` (publicados em `https://raptor-player.netlify.app/iphone/`).

## Como a pessoa instala (30 segundos, só no iPhone)

1. No **Safari**, abra: `https://raptor-player.netlify.app/iphone/`
2. Toque no botão **Compartilhar** (quadrado com seta para cima).
3. Toque em **Adicionar à Tela Inicial** → **Adicionar**.
4. Volte para a tela inicial: aparece o ícone **Raptor**. Abrindo por ele, a app abre em tela cheia,
   sem a barra do Safari — igual a um app baixado.

> No iOS, **Tem que ser Safari**. Chrome/Firefox no iPhone não têm “Adicionar à Tela Inicial”.

## O que funciona

- Termo de uso v2, ativação pelo site com QR e código do aparelho (polling 5 s).
- Login Xtream Codes e M3U (URL ou arquivo importado da Files), listas salvas, colagem inteligente.
- Canais com categorias, busca, favoritos e EPG do meuguia.tv (AGORA / A SEGUIR).
- Filmes e séries com pôsteres, temporadas e episódios (o primeiro episódio inicia sozinho, como no Android).
- Player com retomada, fila, anterior/próximo, velocidade, saltos de tempo, slider e “AO VIVO”.
- Modo demonstração com os clipes públicos (útil para testar sem lista).
- Abertura offline do casco do app (service worker). Listas e vídeos exigem internet.

## Limitação importante: HTTP

O iPhone bloqueia conteúdo **HTTP** dentro de uma página **HTTPS** (“mixed content”).
Como o site é HTTPS, **o provedor precisa oferecer HTTPS** para que a lista e os vídeos carreguem.

- Se a pessoa tentar um servidor `http://`, o app mostra um aviso explicando isso.
- Quando o provedor só tem HTTP, o caminho é o **app nativo via TestFlight** (projeto em `ios/`),
  que não sofre essa restrição — mas exige conta Apple Developer paga e build na nuvem.

## Publicar / atualizar

O conteúdo é estático. Basta commitar/pushar `site/public/iphone/` (o Netlify já publica `site/public`).
O service worker tem versão em `sw.js` (`CACHE = 'raptor-iphone-v1'`): incremente a versão quando
quiser forçar a atualização do casco do app nos iPhones que já instalaram.

## Estrutura

```
site/public/iphone/
├── index.html            telas (termos, login, home, série, player)
├── manifest.webmanifest  metadados de instalação
├── sw.js                 cache do casco do app
├── css/app.css           tema escuro/verde, layout de iPhone
├── js/app.js             interface e player
├── js/ios.js             código do aparelho + detecção de link + aviso HTTP
├── js/{net,util,store,source,epg,sha256}.js   copiados de tv-webos (camada de dados)
├── vendor/               hls.js e gerador de QR
└── icons/                ícones 152/167/180/192/512
```
