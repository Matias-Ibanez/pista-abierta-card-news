#!/usr/bin/env node
import { readFileSync } from "fs";
import { RenderCardNewsInputSchema, renderCardNews } from "./tools/render-card-news.js";
import { closeBrowser } from "./renderer/playwright.js";

/**
 * Render card-news PNGs from a spec JSON file.
 *
 *   node dist/render-cli.js <spec.json> [--out <dir>]
 *
 * spec.json matches RenderCardNewsInputSchema: { id?, theme?, cards[], brand? }.
 * Result is printed to stdout as JSON. Use --out to override the local output
 * directory (sets OUTPUT_DIR for the local storage backend).
 */
function parseArgs(argv: string[]): { specPath?: string; out?: string; pathsOnly?: boolean } {
  const result: { specPath?: string; out?: string; pathsOnly?: boolean } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--out") {
      result.out = argv[++i];
    } else if (arg === "--paths-only") {
      result.pathsOnly = true;
    } else if (!arg.startsWith("--") && !result.specPath) {
      result.specPath = arg;
    }
  }
  return result;
}

async function main() {
  const { specPath, out, pathsOnly } = parseArgs(process.argv.slice(2));

  if (!specPath) {
    console.error("Usage: render-cli <spec.json> [--out <dir>] [--paths-only]");
    process.exit(1);
  }

  if (out) process.env.OUTPUT_DIR = out;

  let raw: string;
  try {
    raw = readFileSync(specPath, "utf8");
  } catch (err) {
    console.error(`Cannot read spec file: ${specPath}`);
    throw err;
  }

  const parsed = RenderCardNewsInputSchema.parse(JSON.parse(raw));
  const result = await renderCardNews(parsed);
  if (pathsOnly) {
    for (const card of result.rendered_cards) delete card.base64;
  }

  // 결과 JSON은 stdout 전용 (로그는 stderr)
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

main()
  .then(async () => {
    await closeBrowser();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await closeBrowser();
    process.exit(1);
  });
