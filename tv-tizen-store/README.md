# Raptor Player — edição de loja (Samsung Tizen)

Versão destinada à Samsung Store. Mesmo fluxo da edição LG: termos, código MAC
com QR Code, botão **Ativar TV** e os quatro vídeos públicos de demonstração.
Não há login manual, biblioteca de mídia nem dados de acesso.

## Arquivos

| Arquivo | Função |
|---|---|
| `config.xml` | ID `http://raptor.player/tv.store`, versão 1.2.1 |
| `index.html` | telas de termos, acesso e player |
| `js/app.js` | controle completo, player e códigos de demonstração |
| `js/util.js`, `js/ui.js` | utilitários e navegação por controle |
| `js/sha256.js` | geração do código estável do aparelho |
| `vendor/qrcode.min.js` | QR Code |

## Empacotar

Use o Tizen Studio (Package Designer) ou:

```powershell
tizen package -t wgt -o ../dist -- .
```

## Publicação

Somente após autorização. É necessária conta Samsung Developer e certificado
digital. A publicação da versão completa não é autorizada.
