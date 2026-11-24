# Raptor Player — TiVo OS (Powered by TiVo)

Versão 1.2.2, derivada do pacote LG webOS Store (`tv-webos-store`, v1.2.2).

TiVo OS usa o **Vewd Core**, uma plataforma HTML5 baseada em Chromium. O app é
um widget W3C com `config.xml` e `index.html` na raiz do ZIP.

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
