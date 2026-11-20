// Screenshot every level of a running build. Usage: node scripts/shots.mjs [baseUrl] [width] [height]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:8097/';
const width = Number(process.argv[3] ?? 1440);
const height = Number(process.argv[4] ?? 900);
const levels = (process.argv[5] ?? '1,2,3,4,5,6,7,8,9').split(',').map(Number);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
page.on('pageerror', (e) => problems.push(String(e)));

for (const n of levels) {
  await page.goto(`${base}?unlock#${n}`);
  await page.reload();
  await page.waitForSelector('svg.net');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `shots/level-${n}-${width}.png`, fullPage: width < 800 });
}
console.log(problems.length ? `problems:\n${problems.join('\n')}` : 'no console errors');
await browser.close();
