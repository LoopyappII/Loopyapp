// Rasteriza los SVG de marca de public/icons/ a los PNG que referencia
// public/manifest.json y app/layout.tsx. No corre en el build: se ejecuta a
// mano cuando cambia el mark (`node scripts/generate-icons.mjs`) y los PNG
// resultantes se commitean.
//
// Usa el Chromium que ya trae @playwright/test (devDep). Si falta el binario:
//   npx playwright install chromium
//
// Fuentes (public/icons/):
//   icon-any.svg       rect redondeado, esquinas transparentes  -> purpose "any"
//   icon-square.svg    cuadrado navy a sangre, aro completo      -> apple-touch
//   icon-maskable.svg  cuadrado navy a sangre, aro al 78%        -> purpose "maskable"

import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

/** @type {{src:string,out:string,size:number,opaque:boolean}[]} */
const TARGETS = [
  { src: "icon-any.svg", out: "icon-192.png", size: 192, opaque: false },
  { src: "icon-any.svg", out: "icon-512.png", size: 512, opaque: false },
  { src: "icon-maskable.svg", out: "icon-maskable-512.png", size: 512, opaque: true },
  { src: "icon-square.svg", out: "apple-touch-icon.png", size: 180, opaque: true },
];

const browser = await chromium.launch();
try {
  for (const t of TARGETS) {
    const svg = await readFile(join(iconsDir, t.src), "utf8");
    const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
    await page.setContent(
      `<!doctype html><meta charset="utf-8"><style>
        html,body{margin:0;padding:0;background:transparent}
        svg{display:block;width:${t.size}px;height:${t.size}px}
      </style>${svg}`,
      { waitUntil: "networkidle" },
    );
    const buf = await page.screenshot({
      omitBackground: !t.opaque,
      clip: { x: 0, y: 0, width: t.size, height: t.size },
    });
    await writeFile(join(iconsDir, t.out), buf);
    console.log(`✓ ${t.out}  ${t.size}×${t.size}${t.opaque ? "  (opaco)" : ""}`);
    await page.close();
  }
} finally {
  await browser.close();
}
