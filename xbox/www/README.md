# Raptor Player — edição de loja (LG webOS)

Versão destinada à LG Content Store. Contém somente:

- aceite dos termos na primeira abertura;
- identificação do aparelho pelo código MAC, com QR Code para o site;
- botão **Ativar TV**, que abre o QR Code em destaque;
- botão **Testar o player (vídeos de exemplo)** com quatro clipes públicos.

Não há login manual, biblioteca de mídia nem dados de acesso. A ativação apenas
cadastra o código do aparelho em `https://raptor-player.netlify.app/ativar`.

## Arquivos

| Arquivo | Função |
|---|---|
| `appinfo.json` | ID `com.raptor.player.store`, versão 1.2.1 |
| `index.html` | telas de termos, acesso e player |
| `js/app.js` | controle completo, player e códigos de demonstração |
| `js/util.js`, `js/ui.js` | utilitários e navegação por controle |
| `js/sha256.js` | geração do código estável do aparelho |
| `vendor/qrcode.min.js` | QR Code |

## Empacotar

```powershell
ares-package . -o ../dist
```

O pacote gerado é `com.raptor.player.store_1.2.1_all.ipk`.

## Instalar na TV de teste

```powershell
ares-install --device reptor ../dist/com.raptor.player.store_1.2.1_all.ipk
ares-launch --device reptor com.raptor.player.store
```

## Validação

- Termos na primeira abertura.
- Código MAC e QR Code visíveis.
- Botão **Ativar TV** abre o QR ampliado; Voltar fecha o popup.
- Botão de vídeos de exemplo toca o clipe 1 e avança sozinho para o 2.
- Voltar ao sair do player retorna à tela de acesso.
