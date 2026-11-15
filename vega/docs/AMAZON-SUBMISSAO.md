# Submissão na Amazon Appstore (VegaOS / Fire TV)

Checklist e textos para publicar o **Raptor Player** como tocador de
vídeo neutro, sem nenhuma menção a IPTV, canais pagos ou conteúdo
embutido. O app precisa passar na análise da Amazon.

## 1. Ficha da loja

**Título:** Raptor Player

**Subtítulo:** Video player

**Categoria:** Entretenimento (Apps → Vídeo)

**Preço:** Gratuito (sem compras dentro do app)

**Descrição curta (até 256 caracteres):**

> Tocador de vídeo para a sua TV. Reproduza as listas e os servidores que
> você mesmo configura, com ativação por código no site. Inclui modo de
> demonstração com vídeos públicos para testar a reprodução.

**Descrição completa:**

> O Raptor Player é um tocador de vídeo para Fire TV. Ele não inclui
> canais, filmes ou séries: você conecta a sua própria lista (M3U) ou
> servidor compatível e assiste na TV, com navegação simples pelo
> controle remoto.
>
> Recursos:
> • Menu com Canais, Filmes e Séries
> • Categorias e busca em todas as pastas de cada aba
> • Séries com lista de episódios e próximo automático
> • Ativação por código, sem digitar senha no controle
> • Modo de demonstração com vídeos públicos
> • Reprodução em tela cheia com pausa, avanço e retrocesso
>
> O aplicativo não vende conteúdo, não exibe anúncios e não coleta dados
> de navegação. Ele é apenas o player: o conteúdo é escolhido e
> configurado pelo próprio usuário.

**Palavras-chave:** video player, m3u, player de vídeo, tv, mídia

## 2. Política de privacidade (obrigatória)

Publicar uma página pública e informar a URL na ficha. Texto base:

> O Raptor Player não coleta dados pessoais. O aplicativo armazena
> somente no aparelho o código de ativação e a configuração da conta
> informada pelo usuário. A única comunicação externa é a consulta de
> ativação feita ao site oficial, para verificar se o aparelho foi
> liberado. O app não usa anúncios, rastreamento, câmera, microfone,
> localização ou contatos. Nenhum dado é vendido ou compartilhado.

URL prevista: `https://reptor-player.netlify.app/privacidade.html`
(a página ainda precisa ser publicada no site).

## 3. Checklist técnico

| Item | Situação |
| --- | --- |
| Pacote VegaOS com `build_number` > 0 | Feito — `npm run build:submission` |
| `min`/`target` Vega OS 1.2 | Feito — `manifest.toml` |
| Build `armv7` (Fire TV Stick 4K Select) | Feito — script confere |
| Ícone 512×512 | Feito — `assets/icon_512x512.png` |
| Feature graphic 1024×500 | Feito — `assets/feature_graphic_1024x500.png` |
| Ícone 114×114 | Feito — `assets/icon_114x114.png` |
| Modo demonstração para o revisor | Feito — botão na tela de ativação |
| Sem anúncios, compras ou login social | Feito |
| Permissão de rede justificada (ativação + vídeo) | Feito — manifesto |
| Sem bibliotecas de rastreamento | Feito |
| Textos sem menção a IPTV/conteúdo pago | Feito |
| Capturas de tela 1920×1080 | **Pendente** — precisa do aparelho/emulador |
| Página de privacidade publicada | **Pendente** — publicar no site |
| Teste de reprodução no Fire TV Stick 4K Select | **Pendente** — precisa do aparelho |
| Conta Amazon Developer + taxa anual | **Pendente** — ação do usuário |

## 4. Como o revisor testa

1. Instalar o app. Na primeira abertura aparecem os termos de uso.
2. Aceitar e, na tela de ativação, escolher **Usar modo demonstração**.
3. Abrir **Filmes** e reproduzir qualquer item (vídeos públicos).
4. Testar **Canais** para a transmissão HLS de demonstração.
5. **Voltar** retorna ao menu; **Ajustes** mostra a fonte e a privacidade.

Nenhuma conta, senha ou lista é necessária para a análise.

## 5. Envio

1. Amazon Developer Console → **Add new app** → plataforma **Vega OS**.
2. Nome, categoria e idioma (Português - Brasil; inglês como secundário).
3. Upload de `build/armv7-release/raptor_armv7.vpkg`.
4. Preencher ficha, palavras-chave, ícone, feature graphic e capturas.
5. Informar a URL da política de privacidade.
6. Questionário de conteúdo: sem violência, drogas, jogos de azar ou
   conteúdo adulto; sem compras; sem anúncios.
7. Dispositivos: Fire TV Stick 4K Select (VegaOS 1.2+).
8. Enviar para análise.

## 6. Cuidados para não reprovar

- Não citar nomes de serviços de IPTV, listas pagas ou "canais liberados".
- Não prometer conteúdo: o app é só o player.
- Não incluir lista real, usuário ou senha no pacote.
- Manter o modo demonstração funcionando sem rede externa além dos
  vídeos públicos.
- Responder à análise com o passo a passo da seção 4 se pedirem conta.
