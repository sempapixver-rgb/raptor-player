# Sites e links para submissão nas lojas

Use estes endereços públicos nos formulários da Amazon, LG e Samsung.

| Campo da loja | URL |
|---|---|
| Site de suporte do app | `https://raptor-player.netlify.app/revisor` |
| Política de privacidade (PT) | `https://raptor-player.netlify.app/privacidade.html` |
| Política de privacidade (EN) | `https://raptor-player.netlify.app/privacy.html` |
| Termos de uso | `https://raptor-player.netlify.app/termos.html` |
| Cadastro do aparelho | `https://raptor-player.netlify.app/ativar.html` |

A página **/revisor** reúne o que o app faz, os quatro vídeos públicos de
demonstração, o passo a passo de teste por plataforma, dados e permissões, e os
links de privacidade/termos. É o endereço indicado para o campo "URL de suporte".

## Versões de loja

Para aprovação, use **somente** as versões de loja. Elas não têm biblioteca,
 login manual nem qualquer menção a provedores: mostram apenas o código MAC com
QR Code para o site e o botão de vídeos de exemplo.

| Loja | Pacote de loja | Versão completa (só para seus usuários) |
|---|---|---|
| LG webOS | `tv-webos-store` → IPK `com.raptor.player.store` | `tv-webos` |
| Samsung Tizen | `tv-tizen-store` → WGT | `tv-tizen` |
| Amazon / Android | flavor `store` | flavors `mobile` e `firetv` |

O site público também segue a mesma regra: `/ativar` pede **apenas o MAC**. O
cadastro dos vídeos continua no painel do proprietário, protegido por token,
sem link na home.

## Texto curto para o revisor (pode colar no campo de notas)

```
O Raptor Player é apenas um tocador de vídeo. Não inclui conteúdo próprio,
catálogo, assinaturas nem anúncios.

Para testar: instale o app, aceite os termos e use "Testar o player (vídeos de
exemplo)" na tela de acesso. Teste Play/Pause, avançar, retroceder, Voltar
e os botões Anterior/Próximo. Ao final de cada vídeo, o próximo começa sozinho.

Para testar a identificação do aparelho, use "Ativar TV": o código MAC e o QR
Code abrem https://raptor-player.netlify.app/ativar.html , onde só o código é
preenchido.

Os quatro vídeos públicos usados na demonstração (MP4/H.264, CC-BY) estão
listados em https://raptor-player.netlify.app/revisor .

Privacidade: https://raptor-player.netlify.app/privacidade.html
```

## Checklist por loja

### Amazon Appstore (Fire TV / Android)

- [x] Política de privacidade pública (PT e EN)
- [x] Versão `store` sem biblioteca, login manual ou termos proibidos
- [x] Modo demonstração sem conta na tela de acesso
- [x] E-mail real da conta Amazon Developer (`sempapixver@gmail.com`)
- [x] Capturas 1920×1080 e feature graphic 1024×500 (em inglês)
- [x] APK da versão `store` enviado — **In Review** (19/11/2026)

### LG Content Store (webOS)

- [x] Política de privacidade pública
- [x] Página de suporte/revisor
- [x] IPK de loja com ativação por MAC/QR e vídeos de exemplo
- [x] Teste de reprodução na LG (aparelho 50UK6510PSF), incluindo auto-next do modo demo
- [x] Conta LG Seller Lounge e envio do IPK — **QA Request** em 19/11/2026

### Samsung Store (Tizen)

- [x] Política de privacidade pública
- [x] Página de suporte/revisor
- [x] WGT de loja com ativação por MAC/QR e vídeos de exemplo
- [ ] Instalar e testar em TV Samsung (usuário ainda não tem o aparelho)
- [x] Conta **TV Seller Office** (`sempapixver@gmail.com`, Individual)
- [x] App **Raptor Player**, ID `3202611051385` — **v1.2.1 enviada em 18/11/2026**
  (`Submitted` em 7 model groups, `100% Rollout (scheduled)`), aguardando revisão

> **Atenção (19/11/2026):** o envio Samsung **já foi feito**. Usar sempre o
> **TV Seller Office** (`https://seller.samsungapps.com/tv/`), nunca o
> *Galaxy Store Seller Portal* (`https://seller.samsungapps.com/`), que exige
> cadastro de vendedora e retorna `gateSignUp`/`astoreNotPermittedError`.
> O WGT local 1.2.2 **ainda não foi enviado** — não enviar sem autorização.
> O ✗ laranja no menu **App Review** significa apenas *"No reviews for this
> beta test yet"* (aguardando a Samsung), não é erro do app.
> Histórico completo: `ENTREGAS/Loja/HISTORICO-ENVIO.md`.

## Atenção antes de enviar

- Use apenas as palavras **"vídeos"**, **"aparelho"** e **"código MAC"**.
  Nunca use: canais, filmes, séries, provedor, lista, assinatura, conteúdo premium.
- O app de loja não pede login, anúncios, compras, câmera, microfone, localização
  nem contatos.
- Se o revisor pedir conta de teste, responda que o modo demonstração dispensa
  credenciais e que a ativação é apenas o cadastro do código do aparelho.
- A versão completa continua disponível para instalação própria; ela não deve ser
  enviada às lojas.
