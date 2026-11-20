// Take one good-looking screenshot of every level, each played into a state worth looking at.
// Usage: node scripts/gallery.mjs [baseUrl]   ->  shots/gallery/NN-title.png
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:8097/';
mkdirSync('shots/gallery', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 880 }, deviceScaleFactor: 2 });

const solved = async () => (await page.locator('.goal.solved').count()) > 0;
const dials = () => page.locator('svg.net g.dial');
const button = (name) => page.getByRole('button', { name, exact: true });
const settle = () => page.waitForTimeout(2600); // let the burst of chalk dust clear
const centre = async (locator) => {
  const b = await locator.boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
};

async function open(n) {
  await page.goto(`${base}?unlock#${n}`);
  await page.reload();
  await page.waitForSelector('svg.net');
  await page.waitForTimeout(300);
}

async function shoot(n, name) {
  await page.screenshot({ path: `shots/gallery/${String(n).padStart(2, '0')}-${name}.png` });
  console.log(`level ${n}: ${name}`);
}

async function loss() {
  const side = page.locator('.readout .side .num');
  const text = (await side.count()) ? await side.innerText() : await page.locator('.readout .figure').innerText();
  return text === 'huge' ? Infinity : Number(text);
}

/** Turn dials with the keyboard, keeping any turn that lowers the loss, until solved. */
async function tune() {
  for (const [up, down] of [['PageUp', 'PageDown'], ['ArrowUp', 'ArrowDown'], ['Shift+ArrowUp', 'Shift+ArrowDown']]) {
    for (let pass = 0; pass < 40; pass++) {
      let improved = false;
      for (let i = 0; i < (await dials().count()); i++) {
        await dials().nth(i).focus();
        for (const [go, back] of [[up, down], [down, up]]) {
          for (let k = 0; k < 60; k++) {
            const before = await loss();
            await page.keyboard.press(go);
            if (await solved()) return;
            if ((await loss()) < before) improved = true;
            else {
              await page.keyboard.press(back);
              break;
            }
          }
        }
      }
      if (!improved) break;
    }
  }
}

async function stepSize(t) {
  await page.locator('input[type=range]').evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, t);
}

async function runUntilSolved(extraMs = 0) {
  await button('Run').click();
  await page.locator('.goal.solved').waitFor({ timeout: 40000 });
  if (extraMs) {
    await button('Run').click();
    await page.waitForTimeout(extraMs);
    await button('Pause').click();
  }
}

// 1: part-way there, with one example being sent through the machine
await open(1);
await dials().nth(0).focus();
for (let i = 0; i < 6; i++) await page.keyboard.press('PageUp');
await page.locator('svg.plot g.point').nth(7).hover();
await shoot(1, 'one-dial');

// 2: solved, inspecting an example
await open(2);
await tune();
await settle();
await page.locator('svg.plot g.point').nth(6).hover();
await shoot(2, 'two-dials');

// 3: the ball dragged down into the valley, trail behind it
await open(3);
{
  const box = await page.locator('canvas.hill').boundingBox();
  const read = async () =>
    (await page.locator('svg.net g.dial text.reading').allTextContents()).map((t) => Number(t.trim().replace('\u2212', '-')));
  // First learn how the pointer maps to the dials, then start over so that leaves no trail.
  const probe = [box.x + box.width * 0.6, box.y + box.height * 0.5];
  await page.mouse.move(...probe);
  await page.mouse.down();
  const here = await read();
  await page.mouse.move(probe[0] + 20, probe[1]);
  const right = await read();
  await page.mouse.move(probe[0], probe[1] + 20);
  const below = await read();
  await page.mouse.up();
  const a = (right[0] - here[0]) / 20, c = (right[1] - here[1]) / 20;
  const b = (below[0] - here[0]) / 20, d = (below[1] - here[1]) / 20;
  const det = a * d - b * c;
  const toward = (from, w, bias) => [(d * (w - from[0]) - b * (bias - from[1])) / det, (-c * (w - from[0]) + a * (bias - from[1])) / det];
  await button('Start over').click();
  // Pick the ball up where it starts, then walk it to the valley floor, correcting as it goes.
  const lift = toward(here, 1.2, -1.2);
  let [x, y] = [probe[0] + lift[0], probe[1] + lift[1]];
  await page.mouse.move(x, y);
  await page.mouse.down();
  let now = await read();
  for (let i = 0; i < 24 && !(await solved()); i++) {
    const step = toward(now, -0.9, 0.5);
    x += step[0] * 0.4;
    y += step[1] * 0.4;
    await page.mouse.move(x, y, { steps: 4 });
    now = await read();
  }
  await page.mouse.up();
}
await settle();
await page.mouse.move(700, 860);
await shoot(3, 'the-hill');

// 4: five nudges in, arrows showing which way is down
await open(4);
for (let i = 0; i < 4; i++) {
  const offered = page.locator('svg.net g.dial g.step');
  await offered.nth((i + 1) % (await offered.count())).click();
}
await page.mouse.move(700, 860);
await page.waitForTimeout(500);
await shoot(4, 'which-way-is-down');

// 5: rolled downhill in a handful of steps
await open(5);
await stepSize(0.8);
await runUntilSolved();
await settle();
await shoot(5, 'let-it-roll');

// 6: sorted by hand
await open(6);
await tune();
await settle();
await page.locator('.plane g.point').nth(4).hover();
await shoot(6, 'sorting-dots');

// 7: sorted by training
await open(7);
await stepSize(0.83);
await runUntilSolved();
await settle();
await shoot(7, 'hands-off');

// 8: stuck, with the way out on offer
await open(8);
await button('Run').click();
await page.waitForTimeout(2500);
await button('Pause').click();
await page.waitForTimeout(1000);
await shoot(8, 'the-wall');

// 9: the output neuron tuned so every group is right
await open(9);
await tune();
await settle();
await page.locator('.tally tbody tr').nth(1).hover();
await shoot(9, 'two-opinions');

// 10: both lines stood up either side of the stripe
await open(10);
{
  const box = await page.locator('.plane svg').boundingBox();
  const R = 1.1;
  const at = (px, py) => [box.x + ((px + R) / (2 * R)) * box.width, box.y + ((R - py) / (2 * R)) * box.height];
  const drag = async (from, to) => {
    await page.mouse.move(...from);
    await page.mouse.down();
    await page.mouse.move(...to, { steps: 8 });
    await page.mouse.up();
  };
  for (const [j, px] of [[0, -0.35], [1, 0.35]]) {
    const line = page.locator('.plane .hidden-line').nth(j);
    const pivot = await centre(line.locator('.badge'));
    await drag(await centre(line.locator('.swing')), [pivot[0], pivot[1] - box.height * 0.3]);
    await drag(await centre(line.locator('.badge')), at(px, j === 0 ? -0.05 : 0.05));
  }
}
await settle();
await page.mouse.move(700, 860);
await shoot(10, 'move-the-lines');

// 11: trained, then left running a little so the answer firms up
await open(11);
await runUntilSolved(5000);
await page.waitForTimeout(1000);
await shoot(11, 'hands-off-again');

// 12: three lines fencing in the middle, one of them lit
await open(12);
await button('Add a hidden neuron').click();
await runUntilSolved(4000);
await page.waitForTimeout(1000);
await page.locator('svg.net g.neuron').nth(2).hover();
await shoot(12, 'fence-it-in');

/** Set a dial to an exact value by picking it and typing in the panel on the left. */
async function setDial(i, value) {
  await dials().nth(i).locator('.face').click();
  const input = page.locator('.inspector input');
  await input.fill(String(value));
  await input.press('Enter');
}

// 13: wires crossed, cart part-way to the lamp
await open(13);
for (const [i, v] of [[0, 0], [1, 1], [3, 1], [4, 0]]) await setDial(i, v);
await page.mouse.move(700, 860);
await button('Go').click();
await page.waitForTimeout(3600);
await shoot(13, 'two-eyes-two-wheels');

// 14: three carts homing in, one of them having turned round in the dark
await open(14);
await setDial(2, 0.15);
await setDial(5, 0.3);
await page.mouse.move(700, 860);
await button('Go').click();
await page.waitForTimeout(4200);
await shoot(14, 'in-the-dark');

// 15: parked inside the ring
await open(15);
for (const [i, v] of [[0, -1], [1, 0], [3, 0], [4, -1], [2, 0.65], [5, 0.65]]) await setDial(i, v);
await page.mouse.move(700, 860);
await button('Go').click();
await page.locator('.goal.solved').waitFor({ timeout: 30000 });
await settle();
await shoot(15, 'stop-at-the-lamp');

await browser.close();
