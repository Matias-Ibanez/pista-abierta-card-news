# card-news

## Pista Abierta

Este fork incorpora un tema fotográfico para noticias de Fórmula 1. Genera
una portada y placas de detalle en PNG de 1080 × 1350. Cada placa se numera
según su orden en el carrusel.

```sh
npm ci --omit=optional
npm run build
npx playwright install chromium
node dist/render-cli.js examples/pista-abierta.json --out card-news-out
```

El ejemplo usa datos de demostración y permite probar el flujo localmente.
Para una portada fotográfica, completá `image_url` con una URL de imagen o
un data URL. `editorial.credit` imprime el crédito y `editorial.focus` acepta
`x` e `y` entre 0 y 100 para ajustar el encuadre (50 y 22 por defecto).
`editorial.comparison` dibuja la franja de tres valores si la noticia la
necesita. Las placas de detalle reciben `editorial.lines` con una afirmación
por renglón.

El motor mide el texto con las fuentes cargadas antes de exportar. La portada
prioriza dos líneas para el titular. Un texto que excede el espacio disponible
en el tamaño mínimo produce un error con la placa afectada.

Las tipografías Barlow e IBM Plex Sans y sus licencias OFL están junto al tema.

> 🇰🇷 한국어 문서는 [README.ko.md](./README.ko.md) 를 보세요.

A **Claude Code plugin** that produces post-ready **Instagram-style card news**
carousels (1080×1350 PNG) — from picking a topic all the way to publishing on
Instagram and Threads. It ships the whole automation pipeline as **composable
skills** you can run end-to-end or piece by piece.

Built for **SURFERS** (AI·AX offline education) — the default chain picks an
AI/LLM topic, writes beginner-friendly Korean copy, renders in the SURFERS brand
theme, archives to a team wiki, and auto-publishes. Swap the theme and sources to
retarget it to your own brand.

## Pipeline

| # | Skill | Does | Gate |
|---|-------|------|------|
| 1 | *(topic pick)* | crawl `news.hada.io/rss/news`, pick the most viral on-brand item | — |
| 2 | `cardnews-research` | pull the article + linked sources → core message, key points, hook, gaps | — |
| 3 | `cardnews-copy` | write the render spec (`spec.json`) | **schema + char-count lint** |
| 4 | `cardnews-image` | fill each card's image: **①** the topic's own article/links, **②** Google/Unsplash crawl | crawl fail → ask user |
| 5 | `cardnews-render` | render 1080×1350 PNGs locally (Playwright), **surfers** theme | renderer built + Chromium |
| 6 | `cardnews-wiki` | archive note + PNGs into the `llm-wiki` git repo and push | repo reachable |
| 7 | `cardnews-autopublish` | Instagram + Threads carousel via the local publish runtime | **approval manifest** |
| — | `cardnews-workflow` | orchestrate steps 1–7 end-to-end | — |

**Optional / standalone**
- `cardnews-review` — Slack sign-off → writes the approval manifest that
  `cardnews-autopublish` requires. Not in the default chain.
- `cardnews-notion` — legacy Notion save (superseded by `cardnews-wiki`).

Run the whole thing with **`cardnews-workflow`**, or invoke any single skill to
build your own flow: render-only, copy + render, archive without publishing, etc.

## Install

```bash
claude plugin marketplace add https://github.com/AX-Surfers/card-news-mcp
claude plugin install card-news@cardnews
```

(For local development, `claude plugin marketplace add /path/to/this/repo`.)

### Renderer setup (once)

The render step uses a bundled Playwright renderer. Build it and install Chromium:

```bash
cd <plugin-root> && npm install && npm run build && npx playwright install chromium
```

## The renderer (`render-cli`)

The render step calls a small CLI that turns a spec JSON into PNGs:

```bash
node dist/render-cli.js <spec.json> [--out <dir>]
```

Input spec shape:

```jsonc
{
  "id": "my-post",          // optional, used for the output folder name
  "theme": "surfers",       // optional, theme name or path
  "cards": [
    { "type": "thumbnail", "index": 0, "title": "…", "category": "NEWS", "image_url": "https://…" },
    { "type": "body", "index": 1, "page_number": 1, "title": "…", "body": "…", "image_url": "https://…" },
    { "type": "closing", "index": 2, "tagline": "…", "cta": "…", "image_url": "https://…" }
  ],
  "brand": {                // optional, overrides theme defaults per-call
    "brand_name": "SURFERS",
    "tagline": "Follow for more",
    "cta": "Follow us <b>now</b>",
    "primary_color": "#0573F0"
  }
}
```

Output (stdout JSON):

```jsonc
{
  "id": "my-post",
  "theme": "surfers",
  "rendered_cards": [
    { "index": 0, "type": "thumbnail", "path": "/abs/path/0_thumbnail.png", "base64": "data:image/png;base64,…" }
  ]
}
```

### Card types

| Type | What's on it |
|------|--------------|
| `thumbnail` | Full-bleed background image, brand logo, category badge, big title |
| `body` | Background image, page number badge, heading, body text, brand mark |
| `closing` | Brand wordmark, tagline, call-to-action, save/like/follow icons |

### Copy lint (schema gate)

`cardnews-copy` only emits a spec once every card passes (default theme; tune per theme):

| Rule | Limit |
|------|-------|
| exactly 1 `thumbnail` (first) + 1 `closing` (last) | required |
| `body` cards | 1..N |
| thumbnail `category` / `title` | ≤ 10 / ≤ 40 chars |
| body `title` / `body` | ≤ 30 / ≤ 200 chars |
| closing `tagline` / `cta` | ≤ 24 / ≤ 80 chars |
| any title/body | non-empty |

## Themes

Two themes ship in the box:

- **`surfers`** — the SURFERS brand theme (blue `#0573F0`, Pretendard). Used by the
  default pipeline.
- **`default`** — clean, achromatic (grayscale). A neutral starting point.

Pick one with `spec.theme`, the `THEME` env var, or a `THEME_DIR` path.

Want your own colors, fonts, and logo? See **[DESIGN.md](./DESIGN.md)** — a custom
theme is a `theme.json` + three HTML files + a few SVGs, no code.

```bash
THEME_DIR=/path/to/my-theme
```

## Storage backends

Render output location, chosen with `STORAGE_BACKEND`:

| Value | Behavior | Extra setup |
|-------|----------|-------------|
| `local` (default) | Saves PNGs to `OUTPUT_DIR`, also returns base64 | none |
| `base64` | Returns base64 data URIs only (no files) | none |
| `supabase` | Uploads to Supabase Storage, returns public URL | `npm i @supabase/supabase-js`, set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `s3` | Uploads to S3 / Cloudflare R2, returns public URL | `npm i @aws-sdk/client-s3`, set `S3_*` vars |

> **Publishing doesn't need a public render backend.** `cardnews-autopublish`
> uploads the rendered PNGs to public Google Drive URLs at publish time, so plain
> `local` render output is fine. (IG/Threads only fetch images from public URLs.)

## Renderer env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `THEME` | `default` | Bundled theme name (pipeline uses `surfers`) |
| `THEME_DIR` | — | Path to an external custom theme |
| `STORAGE_BACKEND` | `local` | `base64` / `local` / `supabase` / `s3` |
| `OUTPUT_DIR` | `./card-news-out` | Where `local` saves files |

## Publish runtime (`cardnews-autopublish`)

Publishing runs local scripts in a self-contained runtime — **no hermes, no
docker, no Notion**:

```
~/.local/share/cardnews/     ($CARDNEWS_DATA_ROOT to relocate)
├── .env / .secrets/         tokens (600/700, gitignored, never printed)
├── scripts/                 patched publish scripts
├── work/                    scratch (PNGs, url lists, results)
└── run_publish.sh           loads .env → runs verify / upload-public / publish
```

- **Credentials** (names only; values stay in `.env`/`.secrets` and are never
  echoed): `INSTAGRAM_GRAPH_TOKEN` (or `META_GRAPH_ACCESS_TOKEN`) +
  `INSTAGRAM_BUSINESS_ACCOUNT_ID`, `THREADS_ACCESS_TOKEN` + `THREADS_USER_ID`,
  `GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE`, `GOOGLE_DRIVE_PARENT_ID` (must be a **Shared
  Drive** — the service account has 0 personal Drive quota).
- **Approval gate.** Publish blocks unless an `approval.json` manifest asserts
  `{ "approved": true, "approval_source": "...", "approved_at": "..." }`. Never
  fabricate approval — get an explicit go, then write the manifest (or use
  `cardnews-review`'s Slack sign-off to produce it).
- **One platform or both.** `--platform {both,instagram,threads}` (default `both`).

## Wiki archive (`cardnews-wiki`)

Every piece is archived to the team's `llm-wiki` git repo
(`~/Develop/llm-wiki`, remote `AX-Surfers/marketing-llm-wiki`, branch `main`) under
`01-콘텐츠마케팅/카드뉴스/<id>/` as an Obsidian note (`## 관련` MOC links) plus the
PNGs, then committed and pushed. This is the permanent home for produced content;
it replaces the old Notion save.

## Troubleshooting

- **Chromium download is large / blocked.** Set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
  during install and point Playwright at an existing Chrome/Chromium.
- **Korean / CJK text looks wrong.** Themes load the Pretendard web font; ensure the
  rendering machine has internet on first render, or bundle a local font in your theme.
- **Google Drive upload 403.** `GOOGLE_DRIVE_PARENT_ID` must be a Shared Drive the
  service account belongs to, not My Drive.

## Development

```bash
npm install
npm run typecheck
npm run test:render surfers   # renders sample cards to ./card-news-out
npm run build
node dist/render-cli.js spec.json --out ./card-news-out
```

## License

[MIT](./LICENSE)
