// Play every level through the real interface, start to finish, the way a person would:
// keyboard on the dials, clicks on the buttons. Usage: node scripts/play.mjs [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:8097/';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const problems = [];
page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
page.on('pageerror', (e) => problems.push(String(e)));

const check = (ok, what) => {
  if (!ok) throw new Error(`FAILED: ${what}`);
  console.log(`  ok  ${what}`);
};
const solved = async () => (await page.locator('.goal.solved').count()) > 0;
const title = () => page.locator('.lesson h1').innerText();
const dials = () => page.locator('svg.net g.dial');
const button = (name) => page.getByRole('button', { name, exact: true });

/** The number being minimised, whichever readout the level uses. */
async function loss() {
  const side = page.locator('.readout .side .num');
  const text = (await side.count()) ? await side.innerText() : await page.locator('.readout .figure').innerText();
  return text === 'huge' ? Infinity : Number(text);
}

/** Turn dials with the keyboard, keeping any turn that lowers the loss. */
async function tuneByHand() {
  for (const [up, down] of [['PageUp', 'PageDown'], ['ArrowUp', 'ArrowDown'], ['Shift+ArrowUp', 'Shift+ArrowDown']]) {
    for (let pass = 0; pass < 40; pass++) {
      let improved = false;
      for (let i = 0; i < (await dials().count()); i++) {
        await dials().nth(i).focus();
        for (const [go, back] of [[up, down], [down, up]]) {
          for (let n = 0; n < 60; n++) {
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

async function setStepSize(t) {
  await page.locator('input[type=range]').evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, t);
}

async function next(expected) {
  await button('Next level').click();
  check((await title()) === expected, `moved on to "${expected}"`);
}

await page.goto(base);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector('svg.net');

console.log('1 One dial');
check((await title()) === 'One dial', 'starts on level 1');
check(await page.getByRole('button', { name: /^Level 2/ }).isDisabled(), 'level 2 is locked at first');
await tuneByHand();
check(await solved(), 'solved by turning the dial');
await next('Two dials');

console.log('2 Two dials');
await tuneByHand();
check(await solved(), 'solved by turning both dials');
await page.locator('svg.plot g.point').nth(2).hover();
check((await page.locator('svg.net text.label').allTextContents()).some((t) => t.includes('wanted')), 'hovering a dot sends it through the network');
await page.mouse.move(5, 5);
await next('The hill');

console.log('3 The hill');
{
  // Drag the ball the way a person would: move, look at what the dials say, correct, repeat.
  const box = await page.locator('canvas.hill').boundingBox();
  const read = async () =>
    (await page.locator('svg.net g.dial text.reading').allTextContents()).map((t) => Number(t.trim().replace('\u2212', '-')));
  let x = box.x + box.width / 2;
  let y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  const here = await read();
  await page.mouse.move(x + 24, y);
  const right = await read();
  await page.mouse.move(x, y + 24);
  const below = await read();
  check(!(await solved()), 'not solved by dropping the ball in the middle');
  // how the two dials respond to moving the pointer across and down
  const a = (right[0] - here[0]) / 24, c = (right[1] - here[1]) / 24;
  const b = (below[0] - here[0]) / 24, d = (below[1] - here[1]) / 24;
  const det = a * d - b * c;
  let now = below;
  y += 24;
  for (let i = 0; i < 12 && !(await solved()); i++) {
    const ew = -0.9 - now[0], eb = 0.5 - now[1];
    x += ((d * ew - b * eb) / det) * 0.8;
    y += ((-c * ew + a * eb) / det) * 0.8;
    await page.mouse.move(x, y, { steps: 3 });
    now = await read();
    if (process.env.DEBUG) console.log(i, x.toFixed(0), y.toFixed(0), now, await loss());
  }
  await page.mouse.up();
  check(await solved(), 'solved by dragging the ball to the valley floor');
}
await next('Which way is down');

console.log('4 Which way is down');
{
  await dials().nth(0).focus();
  const before = await loss();
  await page.keyboard.press('PageUp');
  check((await loss()) === before, 'dials cannot be turned by hand');
  let clicks = 0;
  while (!(await solved()) && clicks < 30) {
    await dials().nth(clicks % 2).click();
    clicks++;
  }
  check(await solved(), `solved in ${clicks} nudges`);
}
await next('Let it roll');

console.log('5 Let it roll');
await button('Run').click();
await page.getByText('Out of steps').waitFor({ timeout: 15000 });
check(!(await solved()), 'the starting step size runs out of steps');
await button('Start over').click();
await setStepSize(1);
await button('Run').click();
await page.getByText('ran away').waitFor({ timeout: 15000 });
check(true, 'the largest step size runs away and says so');
await button('Start over').click();
await setStepSize(0.8);
await button('Run').click();
await page.locator('.goal.solved').waitFor({ timeout: 15000 });
check(true, 'a sensible step size solves it within the budget');
await next('Sorting dots');

console.log('6 Sorting dots');
await tuneByHand();
check(await solved(), 'solved by turning the dials');
await next('Hands off');

console.log('7 Hands off');
await setStepSize(0.83);
await button('Run').click();
await page.locator('.goal.solved').waitFor({ timeout: 15000 });
check(true, 'training solves it within the budget');
await next('The wall');

console.log('8 The wall');
check((await button("This can't be done").count()) === 0, 'no way to give up before trying');
await button('Run').click();
await page.waitForTimeout(2500);
check(!(await solved()), 'training does not solve it');
await button('Pause').click();
await button("This can't be done").click();
check(await solved(), 'calling it impossible is the answer');
await next('Two opinions');

console.log('9 Two opinions');
{
  check((await dials().count()) === 9, 'two hidden neurons and an output make nine dials');
  const readings = () => page.locator('svg.net g.dial text.reading').allTextContents();
  const before = await readings();
  await dials().nth(0).focus();
  await page.keyboard.press('PageUp');
  check((await readings())[0] === before[0], 'the hidden neurons are locked');
  check((await page.locator('.plane .hidden-line').count()) === 2, "both hidden neurons' lines are drawn on the plot");
  check(await page.getByText('What the output neuron sees').isVisible(), "the output neuron's view is shown");
  await tuneByHand();
  check(await solved(), 'solved by turning only the output neuron');
}
await next('Move the lines');

console.log('10 Move the lines');
{
  const box = await page.locator('.plane svg').boundingBox();
  const R = 1.1;
  const at = (x, y) => [box.x + ((x + R) / (2 * R)) * box.width, box.y + ((R - y) / (2 * R)) * box.height];
  const centre = async (locator) => {
    const b = await locator.boundingBox();
    return [b.x + b.width / 2, b.y + b.height / 2];
  };
  const drag = async (from, to) => {
    await page.mouse.move(...from);
    await page.mouse.down();
    await page.mouse.move(...to, { steps: 8 });
    await page.mouse.up();
  };
  const reading = async (i) => Number((await page.locator('svg.net g.dial text.reading').nth(i).textContent()).trim().replace('−', '-'));
  for (const [j, x] of [[0, -0.35], [1, 0.35]]) {
    const line = page.locator('.plane .hidden-line').nth(j);
    // stand the line upright: swing its small handle to straight above the round one
    const pivot = await centre(line.locator('.badge'));
    await drag(await centre(line.locator('.swing')), [pivot[0], pivot[1] - box.height * 0.3]);
    // then slide it to one side of the yellow stripe
    await drag(await centre(line.locator('.badge')), at(x, 0));
  }
  check(Math.abs(await reading(1)) < 0.3, 'swinging a line upright turned its second weight to about zero');
  check(await solved(), 'solved by dragging the two lines either side of the stripe');
}
await next('Hands off again');

console.log('11 Hands off again');
await button('Run').click();
await page.locator('.goal.solved').waitFor({ timeout: 30000 });
check(true, 'training finds the two lines on its own');
await next('Fence it in');

console.log('12 Fence it in');
{
  check((await dials().count()) === 9, 'starts with two hidden neurons');
  await button('Run').click();
  await page.waitForTimeout(4000);
  check(!(await solved()), 'two lines cannot surround the middle');
  await button('Pause').click();
  await button('Add a hidden neuron').click();
  check((await dials().count()) === 13, 'a third hidden neuron makes thirteen dials');
  await button('Run').click();
  await page.locator('.goal.solved').waitFor({ timeout: 30000 });
  check(true, 'three lines fence it in');
  await page.locator('svg.net g.neuron').nth(1).hover();
  check((await page.locator('.plane .hidden-line.lit').count()) === 1, 'pointing at a hidden neuron lights up its line');
  await page.mouse.move(5, 5);
  check(await page.getByText("That's every level so far").isVisible(), 'the last level says what comes next');
  await page.screenshot({ path: 'shots/played-12.png' });
}

await page.reload();
await page.waitForSelector('svg.net');
check((await page.locator('.pip.done').count()) === 12, 'progress survives a reload');

console.log(problems.length ? `console problems:\n${problems.join('\n')}` : 'no console errors');
await browser.close();
process.exit(problems.length ? 1 : 0);
