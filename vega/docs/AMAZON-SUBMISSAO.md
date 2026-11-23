# Submissão na Amazon Appstore (Vega OS — Fire TV Stick 4K Select)

Checklist e textos para publicar o **Raptor Player** como tocador de vídeo
neutro, sem menção a IPTV, listas pagas ou conteúdo embutido.

> O cadastro do app já existe no console da Amazon. O Fire TV Stick 4K Select
> roda Vega OS e exige o pacote `raptor_armv7.vpkg`; o APK Fire OS já publicado
> **não** cobre esse aparelho.

## 1. Ficha da loja

**Título:** Raptor Player

**Subtítulo:** Video player

**Categoria:** Entretenimento (Apps → Vídeo)

**Preço:** Gratuito (sem compras dentro do app)

**Descrição curta (até 256 caracteres):**

> Tocador de vídeo para a sua TV. Configure sua própria fonte no site e ative
> pelo código mostrado na tela. Inclui modo de demonstração com vídeos públicos.

**Descrição completa:**

> O Raptor Player é um tocador de vídeo para Fire TV, com navegação feita para
> o controle remoto. Ele não inclui conteúdo próprio: a fonte é configurada
> pelo próprio usuário no site oficial.
>
> Recursos:
> • Ativação por código no site, sem digitar senha na TV
> • Organização por categorias e busca pelo nome
> • Modo de demonstração com vídeos públicos
> • Reprodução em tela cheia com pausa, avanço e retrocesso
> • Ajustes com o código do aparelho e o link da política de privacidade
>
> O aplicativo não vende conteúdo, não mostra anúncios e não coleta dados de
> navegação. Ele é apenas o player: o que assistir é escolhido pelo usuário.

**Palavras-chave:** video player, media player, tv, remote, demo

## 2. Política de privacidade (obrigatória)

Página pública já publicada e respondendo HTTP 200:

```
https://raptor-player.netlify.app/privacidade.html
```

Texto da página:

> O Raptor Player não coleta dados pessoais. O aplicativo armazena somente no
> aparelho o código de ativação e a configuração da fonte informada pelo
> usuário. A única comunicação externa é a consulta de ativação feita ao site
> oficial, para verificar se o aparelho foi liberado. O app não usa anúncios,
> rastreamento, câmera, microfone, localização ou contatos. Nenhum dado é
> vendido ou compartilhado.

## 3. Checklist técnico

| Item | Situação |
| --- | --- |
| Pacote VegaOS com `build_number` > 0 | Gerado na nuvem por `npm run build:submission`; conferir `vpkg-info.json` |
| `min`/`target` Vega OS 1.2 | Feito — `manifest.toml` |
| Build `armv7` (Fire TV Stick 4K Select) | Feito — o script barra libs de outras arquiteturas |
| Ícone 512×512 | Feito — `assets/icons/icon_512x512.png` |
| Feature graphic 1024×500 | Feito — `assets/icons/feature_graphic_1024x500.png` |
| Ícone 114×114 | Feito — `assets/icons/icon_114x114.png` |
| Modo demonstração para o revisor | Feito — botão na tela de ativação |
| Sem anúncios, compras ou login social | Feito |
| Permissão de rede justificada (ativação + vídeo) | Feito — manifesto |
| Sem bibliotecas de rastreamento | Feito |
| Textos sem menção a IPTV/conteúdo pago | Feito |
| Capturas de tela 1920×1080 | Separadas em `iptv/reptor/store/` |
| Página de privacidade publicada | Feito — 200 OK |
| Teste de reprodução no Fire TV Stick 4K Select | A fazer pelo usuário no aparelho |
| Conta Amazon Developer | Feito — console logado em 23/11 |

## 4. Como o revisor testa

1. Instalar o app. Na primeira abertura aparecem os termos de uso.
2. Aceitar e, na tela de ativação, escolher **Usar modo demonstração**.
3. Abrir a área de vídeos de demonstração e reproduzir um item.
4. Testar Pausar/Reproduzir, Voltar e as setas do controle.
5. **Ajustes** mostra o código do aparelho e o link da privacidade.

Nenhuma conta, senha ou lista é necessária para a análise.

## 5. Envio

1. Amazon Developer Console → **Release Tracks** → aba **Vega OS** →
   **Create a release**.
2. Fazer upload de `build/armv7-release/raptor_armv7.vpkg`.
3. Preencher ficha, palavras-chave, ícone, feature graphic e capturas.
4. Informar a URL da política de privacidade.
5. Questionário de conteúdo: sem violência, drogas, jogos de azar ou
   conteúdo adulto; sem compras; sem anúncios.
6. Dispositivos: Fire TV Stick 4K Select (Vega OS 1.2+).
7. Enviar para análise **somente após** a validação do pacote.

## 6. Cuidados para não reprovar

- Não citar IPTV, M3U, canais, filmes, séries, listas pagas ou "conteúdo liberado".
- Não prometer conteúdo: o app é só o player.
- Não incluir lista real, usuário ou senha no pacote.
- Manter o modo demonstração funcionando sem login.
- Responder à análise com o passo a passo da seção 4 se pedirem conta.
