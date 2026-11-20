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
  const box = await page.locator('.hill svg').boundingBox();
  // The examples sit near weight -0.9, bias 0.5. Drag the marker there in two moves.
  const at = (w, b) => [box.x + ((w + 2) / 4) * box.width, box.y + (1 - (b + 2) / 4) * box.height];
  await page.mouse.move(...at(1.2, -1.2));
  await page.mouse.down();
  await page.mouse.move(...at(0, 0), { steps: 5 });
  check(!(await solved()), 'not solved halfway there');
  await page.mouse.move(...at(-0.9, 0.5), { steps: 5 });
  await page.mouse.up();
  check(await solved(), 'solved by dragging the marker to the valley floor');
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
await next('Bend the line');

console.log('9 Bend the line');
{
  await button('Add a hidden neuron').click();
  await button('Add a hidden neuron').click();
  check((await dials().count()) === 9, 'two hidden neurons make nine dials');
  let shuffles = 0;
  for (; shuffles < 6; shuffles++) {
    await button('Run').click();
    try {
      await page.locator('.goal.solved').waitFor({ timeout: 8000 });
      break;
    } catch {
      await button('Shuffle').click();
    }
  }
  check(await solved(), `solved with two hidden neurons after ${shuffles} shuffles`);
  await page.locator('svg.net g.neuron').nth(0).click();
  check(await page.getByText('Showing hidden neuron 1').isVisible(), 'clicking a hidden neuron shows its own answer');
  check(await page.getByText("That's every level so far").isVisible(), 'the last level says what comes next');
  await page.screenshot({ path: 'shots/played-9.png' });
}

await page.reload();
await page.waitForSelector('svg.net');
check((await page.locator('.pip.done').count()) === 9, 'progress survives a reload');

console.log(problems.length ? `console problems:\n${problems.join('\n')}` : 'no console errors');
await browser.close();
process.exit(problems.length ? 1 : 0);
