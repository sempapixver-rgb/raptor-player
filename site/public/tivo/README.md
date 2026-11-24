# Raptor Player — TiVo OS (Powered by TiVo)

Versão 1.2.2, derivada do pacote LG webOS Store (`tv-webos-store`, v1.2.2).

TiVo OS usa o **Vewd Core**, uma plataforma HTML5 baseada em Chromium. O app é
um widget W3C com `config.xml` e `index.html` na raiz do ZIP.

Diferenças em relação ao pacote LG:

- O layout 1920×1080 é escalado automaticamente para 720p/1080p/4K.
- Back usa `Focus.isBack()` (461, 8, 27, 10009 ou `window.VK_BACK`) e fecha o
  app com `window.close()` quando não há nada para voltar.
- Como o TiVo não expõe o MAC por uma API Luna, o código de ativação é um
  pseudo-MAC estável, guardado em `localStorage` (`raptor.deviceCode`).

## Build

O empacotamento é feito somente na nuvem, pelo GitHub Actions:

- Workflow: `.github/workflows/tivo.yml`
- Artefatos: `Raptor-TiVo-Store.wgt` e `Raptor-TiVo-Store.zip`

## Envio

A Xperi/TiVo não abre uma loja pública para desenvolvedores: apps são
pré-integrados. O contato de submissão é
`developers-support@xperi.com`.

Para enviar, anexar o ZIP e informar:

- Nome: Raptor Player
- Pacote: `com.raptor.player.tivo`
- Versão: 1.2.2
- Descrição neutra: *Video player for Powered by TiVo smart TVs.*
- Política de privacidade: `https://raptor-player.netlify.app/privacy.html`

Não mencionar M3U, IPTV, canais, filmes, séries, assinatura ou conteúdo pago.
