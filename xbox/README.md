# Raptor Player — Xbox (UWP/MSIX)

Versão para **Xbox One, Xbox Series S e Xbox Series X** feita a partir de uma
**cópia idêntica da edição LG 1.2.2** (`iptv/reptor/tv-webos-store`).

## O que foi copiado

`www/` é a cópia integral da pasta da LG:

- `index.html`
- `css/app.css`
- `js/app.js`, `js/ui.js`, `js/util.js`, `js/sha256.js`
- `vendor/qrcode.min.js`
- `assets/*`

Nada dessa pasta foi alterado. Mesmas telas, textos, cores, QR Code, código do
aparelho, aceite de termos e vídeos de exemplo.

## Como o app abre no Xbox

O projeto UWP (`RaptorXbox/`) é só o host:

- carrega `ms-appx-web:///www/index.html` de **arquivos locais do pacote**;
- **não redireciona** para o site público nem abre navegador externo;
- converte o botão **Voltar** do controle para o `App.back()` da LG;
- converte o encerramento da LG para saída real do app.

Ou seja: app instalado e aberto direto no Xbox, com a interface idêntica à da TV
LG. A interface continua em HTML/CSS/JS, exatamente como na LG — o empacotamento,
a instalação e o ciclo de vida são UWP nativos do Xbox.

## Console e build

- Plataformas: **x64** (Xbox não aceita mais pacotes x86).
- Pacote: `.msixbundle` assinado.
- Build na nuvem: `.github/workflows/build-xbox.yml` (`windows-latest`).
- Publicação: **Microsoft Partner Center**, como **app**, não como jogo.
- Certificado de build gerado no workflow com `CN=Raptor`.
- Para enviar à Store, usar o certificado do Partner Center com o mesmo
  publisher (`CN=Raptor`).

## O que NÃO está incluído

- **Xbox Cloud Gaming (xCloud)** — o serviço transmite apenas jogos do catálogo
  da Microsoft; não aceita app de terceiro dentro da sessão na nuvem.
- APK, VPKG, IPK ou WGT — o Xbox usa somente MSIX/UWP.
- Alteração na identidade visual: a cópia da LG mantém `1.2.2`.

## Estado

Build concluído com sucesso em 26/11/2026:

- commit `6c04559`
- run `https://github.com/sempapixver-rgb/raptor-player/actions/runs/45898892933` (#6)
- artefato **`Raptor-Xbox-MSIX`**, 54,7 MB
- sha256 do ZIP do artefato:
  `5cfd6686564b44ceb448f7ca7b4dd1b26bd1a01b9cd6e3857665e1c6230d3387`

**Nada foi publicado na Microsoft Store.** O pacote está pronto apenas no
artefato do GitHub Actions, para envio futuro pelo Partner Center.
