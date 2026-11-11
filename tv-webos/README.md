# Reptor Player — webOS (LG)

App de TV para LG webOS. Mesma identidade, mesmo termo de uso e a mesma
ativação por QR Code do app Android.

## O que já funciona

- **Termo de uso v2** na primeira abertura.
- **Ativação pela TV**: mostra o código (MAC) e o QR Code; o cliente abre o
  site, informa a lista e a TV entra sozinha (consulta a cada 5s, depois 20s,
  e tem o botão **Verificar agora**).
- **Login manual** por Xtream Codes ou link M3U.
- **Listas salvas** no aparelho.
- **Canais / Filmes / Séries**, com pastas (categorias) e séries em
  temporada → episódio.
- **Player** com HLS nativo da LG e fallback para `hls.js`.
- **Controle remoto**: D-pad, OK, Voltar (461) e teclas de mídia
  (play, pause, parar, avançar, retroceder).
- **Magic Remote**: o ponteiro move o foco e o clique ativa o item.

## Estrutura

```
tv-webos/
  appinfo.json          metadados do app (id, versão, ícones)
  index.html            telas
  css/app.css           layout 1920x1080
  js/app.js             telas, navegação e player
  js/source.js          Xtream Codes e M3U
  js/store.js           sessão, listas, MAC e ativação
  js/net.js             requisições (XHR)
  js/ui.js              foco por controle remoto
  js/util.js            utilidades
  js/sha256.js          hash do código de fallback
  vendor/               hls.js (fallback) e qrcodejs
  assets/               ícone, ícone grande e splash
```

## Gerar o IPK

O build roda no GitHub Actions (`.github/workflows/webos.yml`) a cada push em
`tv-webos/`. O artefato **Reptor-webOS** traz o `.ipk` pronto.

Para gerar na mão:

```bash
npm install -g @webos-tools/cli
ares-package tv-webos -o dist
```

Resultado: `dist/com.reptor.player_1.0.0_all.ipk`.

## Instalar na TV

1. Na TV: **Configurações → Conexão → LG Developer Mode** (ou o app
   *Developer Mode* da LG Store), entre com a conta LG e ative.
2. Anote IP e porta (padrão 9922) e a passphrase mostrados na TV.
3. No PC, com a CLI instalada:

```bash
ares-setup-device           # cadastra a TV (IP, porta 9922, passphrase)
ares-install --device tv dist/com.reptor.player_1.0.0_all.ipk
ares-launch  --device tv com.reptor.player
```

Também dá para instalar por pendrive usando o app **Developer Mode** da TV
(`ares-install` é o caminho mais simples).

## Ativação

O app usa `Activation.SITE_BASE` (`js/store.js`) apontando para
`https://reptor-player.netlify.app` — o mesmo site do app Android.

1. A TV mostra `AA:BB:CC:DD:EE:FF` e o QR.
2. O QR abre `https://reptor-player.netlify.app/?code=<MAC sem separadores>`.
3. O cliente preenche a lista e envia.
4. A TV recebe em até 5 segundos e entra.

O MAC vem de `com.webos.service.connectionmanager/getinfo`. Se a TV não
informar, o app deriva um código fixo a partir do `deviceId` do aparelho, no
mesmo formato — o cliente não percebe diferença.

## Compatibilidade

- webOS 4.0 ou superior (LG de 2018 em diante).
- O layout evita `grid`, `flex-gap`, `aspect-ratio` e `inset` para funcionar
  nas versões mais antigas do Chromium usadas pelas TVs.
- Streams ao vivo usam `.m3u8`; filmes e episódios usam a extensão informada
  pelo painel (`.mp4`, `.mkv`...).

## Observações

- Nada de lista, usuário ou senha fica no repositório.
- Se o painel não responder por CORS, o app mostra a mensagem de falha de
  rede; nesse caso o servidor precisa liberar `Access-Control-Allow-Origin`.
