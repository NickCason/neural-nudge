// Render the app icons from public/icon.svg. Usage: node scripts/icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync('public/icon.svg', 'utf8');
const browser = await chromium.launch();

async function render(file, size, inset) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  // Maskable icons get cropped to a circle or squircle, so the drawing sits inside a safe margin.
  const scale = 1 - inset * 2;
  await page.setContent(
    `<body style="margin:0;background:#23403a;display:grid;place-items:center;height:100vh">
       <div style="width:${size * scale}px;height:${size * scale}px">${svg}</div></body>`,
  );
  await page.screenshot({ path: `public/${file}` });
  await page.close();
}

await render('icon-192.png', 192, 0);
await render('icon-512.png', 512, 0);
await render('icon-maskable-512.png', 512, 0.1);
await browser.close();
