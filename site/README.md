# Site de ativação — Reptor Player

**No ar:** https://reptor-player.netlify.app

Site que ativa a TV pelo código (MAC) exibido no app. O cliente não digita nada
no controle: ele preenche o site e o app busca a configuração sozinho.

## Páginas

- `/` — apresentação (identidade visual, capa e recursos).
- `/ativar` — formulário de ativação da TV.
- `/termos` — termo de uso.
- `/assets/capa.png` — imagem de capa (1200×630) usada no compartilhamento.

## Publicação atual

Projeto Netlify: `reptor-player` (time `pix-ver-sempa`), ID
`0843606b-c53b-4da1-9430-055151404dd1`.

Para publicar uma alteração:

```bash
npm install --prefix site
netlify deploy --prod --site 0843606b-c53b-4da1-9430-055151404dd1 \
  --dir site/public --functions site/netlify/functions
```

## Como publicar na Netlify (do zero)

1. Suba este repositório no GitHub (o mesmo do app).
2. Na Netlify: **Add new site → Import an existing project**.
3. Escolha o repositório e configure:
   - **Base directory:** `site`
   - **Build command:** (vazio)
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions` (já vem do `netlify.toml`)
4. Publique. A Netlify instala o `@netlify/blobs` e ativa o armazenamento sozinha.
5. Anote a URL final (ex.: `https://reptor-player.netlify.app`).

## Ligar o site ao app

No Android, o endereço fica em uma única linha:

`app/src/main/java/com/reptor/player/data/Activation.kt`

```kotlin
const val SITE_BASE = "https://reptor-player.netlify.app"
```

Se o site ficar em outro endereço, troque essa linha e gere o APK de novo.

## Endpoints

- `POST /api/activate`
  ```json
  {
    "code": "AABBCCDDEEFF",
    "mode": "XTREAM",
    "host": "http://servidor:8080",
    "user": "usuario",
    "pass": "senha",
    "label": "Minha TV"
  }
  ```
  Para M3U, troque `host/user/pass` por `"mode": "M3U"` e `"m3u": "http://.../get.php?..."`.

- `GET /api/device?code=AABBCCDDEEFF`
  Devolve `{ "ok": true, "activation": { ... } }` quando a TV já foi ativada,
  ou `404` enquanto não houver ativação.

## Teste rápido

```bash
curl -X POST https://SEU-SITE.netlify.app/api/activate \
  -H "Content-Type: application/json" \
  -d '{"code":"AABBCCDDEEFF","mode":"M3U","m3u":"http://exemplo.com/lista.m3u"}'

curl "https://SEU-SITE.netlify.app/api/device?code=AABBCCDDEEFF"
```

## Observações

- O código da TV tem 12 caracteres (formato de MAC). Em aparelhos que escondem
  o MAC real, o app gera um código fixo no mesmo formato.
- A ativação fica guardada por código; reativar o mesmo código substitui a
  configuração anterior.
- O app consulta a ativação a cada 5 segundos enquanto está na tela de login.
- Nada de conteúdo é hospedado aqui: o site só guarda os dados de acesso que o
  próprio cliente informa.
