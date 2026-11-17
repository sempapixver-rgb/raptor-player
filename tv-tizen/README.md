# Raptor Player — Tizen (Samsung Smart TV)

Versão para Samsung Smart TV (Tizen), criada a partir da **versão webOS 1.2.1**.
A interface, o player e todos os recursos são idênticos aos da versão LG.

## Recursos (iguais ao webOS 1.2.1)

- Termo de uso v2 na primeira abertura.
- Ativação por QR Code: a TV mostra um código no formato MAC e o cliente
  cadastra a lista no site; a TV entra sozinha.
- Login manual por Xtream Codes ou link M3U.
- Canais, filmes e séries com temporadas e episódios.
- **Autoplay**: o vídeo começa sozinho ao abrir o player.
- **Pulos** de 30 s, 5 min, 10 min e 30 min (frente e atrás).
- **Barra de tempo navegável**: clique ou ←/→ no controle.
- **Próximo episódio automático**, inclusive virada de temporada.
- Correção do `playPending` preso (travamento quando um vídeo falha).
- Controle remoto: D-pad, OK, Voltar (461 ou 10009) e teclas de mídia.

## O que mudou em relação ao webOS

| Arquivo | Adaptação |
|---|---|
| `appinfo.json` (removido) | Substituído por `config.xml` (manifesto Tizen). |
| `config.xml` (novo) | Identificador `raptorPlayer`, perfil `tv`, privilégios de rede. |
| `js/store.js` | Device ID e modelo via `tizen.systeminfo`; já não usa LUNA. O código de ativação continua no mesmo formato MAC. |
| `js/app.js` | Voltar também aceita `10009`; saída via `tizen.application...exit()`; teclas do controle registradas com `tizen.tvinputdevice`. |
| `js/ui.js` | Constante `BACK_ALT` para o Voltar alternativo. |
| `js/net.js` | User-Agent identifica a plataforma Tizen. |

O site de ativação continua sendo `https://reptor-player.netlify.app` — o mesmo
do Android e do webOS. O código gerado na Tizen é estável por aparelho, então o
cliente não percebe diferença.

## Gerar o pacote `.wgt`

O build roda no GitHub Actions (`.github/workflows/tizen.yml`) e gera o artefato
**Raptor-Tizen**. Para gerar na mão, com o conteúdo da pasta `tv-tizen/`:

```bash
cd tv-tizen
zip -r ../dist/Raptor-Tizen.wgt .
```

O `.wgt` é um ZIP com `config.xml` na raiz.

## Instalar na TV (modo desenvolvedor)

1. Na TV Samsung: **Configurações → Geral → Rede → Configurações de desenvolvedor**
   (em alguns modelos, **Smart Hub → Configurações → Desenvolvedor**).
2. Ative o **Modo desenvolvedor** e anote o IP da TV.
3. No Tizen Studio (Device Manager), conecte ao IP e use **Install** no `.wgt`,
   ou envie por pendrive com a pasta `userwidget` na raiz.

> Publicação na Samsung Store exige conta de desenvolvedor Samsung e certificado
> de assinatura. Este repositório gera apenas o pacote instalável; nada foi
> publicado na loja.

## Compatibilidade

- Tizen 4.0 ou superior (Samsung Smart TV de 2017 em diante).
- Layout 1920×1080, sem `grid`/`gap`/`aspect-ratio` (compatível com motores
  web antigos das TVs).
- HLS nativo da TV com fallback para `hls.js`.
