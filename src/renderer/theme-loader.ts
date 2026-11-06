import Handlebars from "handlebars";
import { readFileSync, existsSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, isAbsolute } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/renderer 또는 src/renderer 기준 → 프로젝트 루트의 themes/
const BUNDLED_THEMES_DIR = join(__dirname, "../../themes");

export interface ThemeConfig {
  name: string;
  primary_color: string;
  accent_color: string;
  ink_color: string;
  closing_tint: string;
  font: string;
  brand_name: string;
  logo_icon: string;
  wordmark: string;
  brand_image: string;
  stylesheet?: string;
  fonts?: { display: string; body: string };
}

export interface Theme {
  name: string;
  // 템플릿에 주입할 기본 컨텍스트
  context: {
    primary_color: string;
    accent_color: string;
    ink_color: string;
    closing_tint: string;
    font: string;
    brand_name: string;
    logo_url: string;    // logo_icon → data URI
    wordmark_url: string;
    brand_image: string; // data URI
    stylesheet?: string;
  };
  templates: {
    thumbnail: HandlebarsTemplateDelegate;
    body: HandlebarsTemplateDelegate;
    closing: HandlebarsTemplateDelegate;
  };
}

const cache = new Map<string, Theme>();

function svgToDataUri(absPath: string): string {
  const svg = readFileSync(absPath, "utf-8");
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function resolveThemeDir(theme?: string): string {
  // 1) 외부 절대/상대 경로 (THEME_DIR 또는 input.theme이 경로인 경우)
  if (theme && (isAbsolute(theme) || theme.startsWith(".") || theme.includes("/"))) {
    const dir = isAbsolute(theme) ? theme : join(process.cwd(), theme);
    if (existsSync(join(dir, "theme.json"))) return dir;
  }
  // 2) 환경변수 THEME_DIR
  const envDir = process.env.THEME_DIR;
  if (envDir && existsSync(join(envDir, "theme.json"))) return envDir;
  // 3) 번들 테마 이름
  const name = theme || process.env.THEME || "default";
  const bundled = join(BUNDLED_THEMES_DIR, name);
  if (existsSync(join(bundled, "theme.json"))) return bundled;
  // 4) 폴백: default
  return join(BUNDLED_THEMES_DIR, "default");
}

export function loadTheme(theme?: string): Theme {
  const dir = resolveThemeDir(theme);
  if (cache.has(dir)) return cache.get(dir)!;

  const cfg: ThemeConfig = JSON.parse(readFileSync(join(dir, "theme.json"), "utf-8"));

  const compile = (file: string) =>
    Handlebars.compile(readFileSync(join(dir, file), "utf-8"));

  const fontUrl = (file: string) =>
    "data:font/ttf;base64," + readFileSync(join(dir, file)).toString("base64");
  const stylesheet = cfg.stylesheet ? compile(cfg.stylesheet)({
    display_font: cfg.fonts && fontUrl(cfg.fonts.display),
    body_font: cfg.fonts && fontUrl(cfg.fonts.body),
  }) : undefined;

  const loaded: Theme = {
    name: cfg.name,
    context: {
      primary_color: cfg.primary_color,
      accent_color: cfg.accent_color,
      ink_color: cfg.ink_color,
      closing_tint: cfg.closing_tint,
      font: cfg.font,
      brand_name: cfg.brand_name,
      logo_url: svgToDataUri(join(dir, cfg.logo_icon)),
      wordmark_url: svgToDataUri(join(dir, cfg.wordmark)),
      brand_image: svgToDataUri(join(dir, cfg.brand_image)),
      stylesheet,
    },
    templates: {
      thumbnail: compile("thumbnail.html"),
      body: compile("body.html"),
      closing: compile("closing.html"),
    },
  };

  cache.set(dir, loaded);
  return loaded;
}

export interface ThemeSummary {
  id: string;
  name: string;
}

/** 번들된 themes/ 디렉터리에서 theme.json을 가진 테마 목록을 반환 */
export function listThemes(): ThemeSummary[] {
  if (!existsSync(BUNDLED_THEMES_DIR)) return [];
  return readdirSync(BUNDLED_THEMES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(BUNDLED_THEMES_DIR, e.name, "theme.json")))
    .map((e) => {
      const cfg = JSON.parse(
        readFileSync(join(BUNDLED_THEMES_DIR, e.name, "theme.json"), "utf-8")
      ) as { name?: string };
      return { id: e.name, name: cfg.name ?? e.name };
    });
}
