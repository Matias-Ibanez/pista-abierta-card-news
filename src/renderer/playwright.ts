import { chromium as playwrightChromium, type Browser } from "playwright";

const IS_VERCEL = process.env.VERCEL === "1";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;

  let launched: Browser;
  if (IS_VERCEL) {
    // 서버리스 환경: @sparticuz/chromium + playwright-core (optional deps)
    // 변수 specifier로 동적 import → 미설치 시에도 typecheck 통과
    const sparticuzMod = "@sparticuz/chromium";
    const coreMod = "playwright-core";
    const chromiumPkg = (await import(sparticuzMod)).default;
    const { chromium: playwrightCore } = await import(coreMod);
    const executablePath = await chromiumPkg.executablePath();
    launched = await playwrightCore.launch({
      args: chromiumPkg.args,
      executablePath,
      headless: true,
    });
  } else {
    // 로컬: 번들된 Chromium 사용
    launched = await playwrightChromium.launch({ headless: true });
  }

  browser = launched;
  return launched;
}

// 디자인 기준 720×900 (4:5), deviceScaleFactor 1.5로 1080×1350 출력 (인스타 4:5 권장 해상도)
const CARD_CSS_WIDTH = 720;
const CARD_CSS_HEIGHT = 900;
const CARD_SCALE = 1.5;

export async function renderHtmlToPng(html: string): Promise<Buffer> {
  const b = await getBrowser();
  const context = await b.newContext({
    viewport: { width: CARD_CSS_WIDTH, height: CARD_CSS_HEIGHT },
    deviceScaleFactor: CARD_SCALE,
  });
  const page = await context.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle" });
    // 폰트/이미지 로딩 대기
    await page.waitForTimeout(300);
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const image of document.querySelectorAll<HTMLImageElement>("[data-required-image]")) {
        if (!image.complete || !image.naturalWidth) throw new Error("Cover photo did not load");
      }
      for (const element of document.querySelectorAll<HTMLElement>("[data-fit-height]")) {
        const initial = Math.floor(parseFloat(getComputedStyle(element).fontSize));
        const minimum = Number(element.dataset.fitMin);
        const maxHeight = Number(element.dataset.fitHeight);
        const preferredLines = Number(element.dataset.fitLines);
        let fitted = false;
        for (const lines of preferredLines ? [preferredLines, Infinity] : [Infinity]) {
          for (let size = initial; size >= minimum; size--) {
            element.style.fontSize = size + "px";
            const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
            const height = Math.min(maxHeight, lineHeight * lines + 1);
            if (element.scrollHeight <= height && element.scrollWidth <= element.clientWidth + 1) {
              fitted = true;
              break;
            }
          }
          if (fitted) break;
        }
        if (!fitted) throw new Error("Text does not fit: " + element.dataset.fitLabel);
      }
    });
    const screenshot = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: CARD_CSS_WIDTH, height: CARD_CSS_HEIGHT },
    });
    return Buffer.from(screenshot);
  } finally {
    await page.close();
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
