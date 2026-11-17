# Sites e links para submissão nas lojas

Use estes endereços públicos nos formulários da Amazon, LG e Samsung.
Todos já estão no ar em `https://reptor-player.netlify.app`.

| Campo da loja | URL |
|---|---|
| Site de suporte do app | `https://reptor-player.netlify.app/revisor` |
| Política de privacidade (PT) | `https://reptor-player.netlify.app/privacidade.html` |
| Política de privacidade (EN) | `https://reptor-player.netlify.app/privacy.html` |
| Termos de uso | `https://reptor-player.netlify.app/termos.html` |
| Ativação | `https://reptor-player.netlify.app/ativar.html` |

A página **/revisor** reúne: o que o app faz (e o que não faz), os quatro clipes
públicos de demonstração, o passo a passo de teste por plataforma, dados e
permissões, e os links de privacidade/termos. É o endereço mais indicado para o
campo "URL de suporte".

## Texto curto para o revisor (pode colar no campo de notas)

```
O Raptor Player é apenas um tocador de vídeo. Não inclui conteúdo, canais,
catálogo, assinaturas nem anúncios: o usuário informa a própria fonte.

Para testar sem conta ou lista:
- Fire TV / Android: aceite os termos e use "Testar o player (vídeos de exemplo)"
  na tela de acesso.
- LG webOS / Samsung Tizen: o app mostra um código na tela de acesso; configure
  uma fonte em https://reptor-player.netlify.app/ativar.html com esse código.

Os quatro clipes públicos usados na demonstração (MP4/H.264, CC-BY) estão
listados em https://reptor-player.netlify.app/revisor , hospedados na página
de releases do desenvolvedor. Nenhum conteúdo de terceiros vem dentro do app.

Privacidade: https://reptor-player.netlify.app/privacidade.html
```

## Checklist por loja

### Amazon Appstore (Fire TV / Android)

- [x] Política de privacidade pública (PT e EN)
- [x] Modo demonstração sem conta na tela de acesso
- [x] Clipes de demonstração acessíveis por URL pública
- [x] Textos da ficha sem menção a conteúdo pago ou IPTV
- [ ] E-mail real da conta Amazon Developer (preencher no console)
- [ ] Capturas 1920×1080 e feature graphic 1024×500 (em `vega/assets/icons`)
- [ ] Enviar o APK de produção (`apk-latest`)

### LG Content Store (webOS)

- [x] Política de privacidade pública
- [x] Página de suporte/revisor
- [x] IPK 1.2.1 gerado pelo workflow `Build webOS`
- [ ] Teste de reprodução na LG (já feito em aparelho 50UK6510PSF)
- [ ] Conta LG Seller Lounge e envio do IPK — pendente de autorização

### Samsung Store (Tizen)

- [x] Política de privacidade pública
- [x] Página de suporte/revisor
- [x] WGT 1.2.1 gerado pelo workflow `Build Tizen`
- [ ] Instalar e testar em TV Samsung (usuário ainda não tem o aparelho)
- [ ] Conta Samsung Developer + certificado de assinatura
- [ ] Publicação — somente após autorização

## Atenção antes de enviar

- Os textos das lojas devem usar **"vídeos", "seus vídeos", "sua biblioteca"**.
  Evitar: canais, filmes, séries, IPTV, lista, assinatura, conteúdo premium.
- O app não pede login obrigatório, anúncios, compras, câmera, microfone,
  localização nem contatos.
- Se o revisor pedir conta de teste, responda com o passo a passo acima e
  reforce que o modo demonstração dispensa credenciais (Fire TV/Android).
- As versões de TV (LG/Samsung) não têm botão de demonstração dentro do app;
  para facilitar a análise, o ideal é adicionar o mesmo modo demonstração do
  Android antes do envio.
