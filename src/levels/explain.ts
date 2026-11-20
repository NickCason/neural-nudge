/**
 * What to tell the player once a level is solved, when there is more than one way to solve it.
 * Each function looks at the dials they ended up with and describes the solution they actually
 * found, so the text is never about a mechanism their network isn't using.
 */
import { trace } from '../engine/net';
import type { NetSpec } from '../engine/net';
import type { Level } from './types';

export type TwoHiddenKind = 'yellow-between' | 'pink-between' | 'ramp' | 'clean';

/** How a two-hidden-neuron network is telling the two kinds of dot apart. */
export function twoHiddenKind(level: Level, spec: NetSpec, params: ArrayLike<number>): {
  kind: TwoHiddenKind;
  /** For the kind that sits in a group of its own: what each hidden neuron says about it. */
  says: [boolean, boolean];
  /** Which hidden neuron (0 or 1) has the larger weights, and so flips more sharply. */
  sharper: number;
} {
  const patterns = { yellow: new Set<number>(), pink: new Set<number>() };
  for (const sample of level.data) {
    const h = trace(spec, params, sample.x).a[1];
    const key = (h[0] > 0 ? 1 : 0) + (h[1] > 0 ? 2 : 0);
    (sample.y[0] > 0.5 ? patterns.yellow : patterns.pink).add(key);
  }
  const width = spec.inputs + 1;
  const size = (j: number) => Math.hypot(params[j * width], params[j * width + 1]);
  const sharper = size(0) >= size(1) ? 0 : 1;
  const decode = (key: number): [boolean, boolean] => [(key & 1) === 1, (key & 2) === 2];

  // If any yes/no combination holds both kinds, yes and no alone can't be what separates them.
  const shared = [...patterns.yellow].some((k) => patterns.pink.has(k));
  if (shared) return { kind: 'ramp', says: [false, false], sharper };
  if (patterns.yellow.size === 1) return { kind: 'yellow-between', says: decode([...patterns.yellow][0]), sharper };
  if (patterns.pink.size === 1) return { kind: 'pink-between', says: decode([...patterns.pink][0]), sharper };
  return { kind: 'clean', says: [false, false], sharper };
}

const word = (yes: boolean) => (yes ? 'yes' : 'no');

function twoHidden(level: Level, spec: NetSpec, params: ArrayLike<number>): string {
  const found = twoHiddenKind(level, spec, params);
  const where = `neuron 1 says ${word(found.says[0])} and neuron 2 says ${word(found.says[1])}`;
  const lead = 'Nobody told the hidden neurons where to draw their lines. Stepping downhill on the loss put them there.';
  switch (found.kind) {
    case 'yellow-between':
      return `${lead} This time the yellow dots ended up in a group of their own, where ${where}, and the output neuron says yes only there. That's the same kind of rule you built by hand two levels ago.`;
    case 'pink-between':
      return `${lead} This time the pink dots ended up in a group of their own, where ${where}. Each hidden neuron has claimed one yellow clump, and the output neuron says no only where neither claim applies. That's a different rule from the one you built by hand, and it's just as right.`;
    case 'ramp':
      return `${lead} This time the two lines landed close together, so on yes and no alone some yellow and pink dots look the same: the table shows them as separate rows with matching answers. It works because the neurons aren't equally sharp. Hidden neuron ${found.sharper + 1} has large weights and flips like a switch. Hidden neuron ${2 - found.sharper} has small weights and changes gradually across the whole board, so it tells near dots from far ones. The output neuron plays one against the other. It's a thinner solution than clean groups. Shuffle and run again to see training find a different one.`;
    case 'clean':
      return `${lead} The two lines cut the dots into groups with one kind in each, and the output neuron picks out the yellow ones.`;
  }
}

export type SteerKind = 'crossed' | 'braking' | 'both';

/**
 * How a cart is turning toward the light. Dials are: left eye to left wheel, right eye to
 * left wheel, left bias, left eye to right wheel, right eye to right wheel, right bias.
 */
export function steerKind(params: ArrayLike<number>): SteerKind {
  const crossed = Math.max(0, params[1]) + Math.max(0, params[3]);
  const braking = Math.max(0, -params[0]) + Math.max(0, -params[4]);
  const total = crossed + braking || 1;
  if (crossed / total > 0.75) return 'crossed';
  if (braking / total > 0.75) return 'braking';
  return 'both';
}

function cartSteer(params: ArrayLike<number>): string {
  const tail = 'Nothing in there knows what a lamp is. A few numbers are enough to look like wanting.';
  switch (steerKind(params)) {
    case 'crossed':
      return `Crossed wires: the left eye drives the right wheel, so the far wheel speeds up and the cart turns toward whatever it sees. ${tail}`;
    case 'braking':
      return `You got there by braking: each eye slows the wheel on its own side, so the wheel nearer the lamp drags and the cart swings toward it. Crossing the wires with positive weights does the same job the other way round, by speeding up the far wheel. ${tail}`;
    case 'both':
      return `You used both tricks at once: each eye speeds up the wheel on the far side and slows the one on its own side. Either would turn the cart toward the lamp alone. ${tail}`;
  }
}

function cartDark(params: ArrayLike<number>): string {
  const [left, right] = [params[2], params[5]];
  if (Math.abs(left - right) < 0.03) {
    return 'With both eyes dark, only the biases act, and yours are equal, so the cart goes in a straight line until something comes into view. That happened to work from these three starts. Unequal biases are the sturdier answer: the cart circles until an eye catches the light. The biases are what it does by default. The weights are how it reacts.';
  }
  const way = right > left ? 'left' : 'right';
  return `With unequal biases the cart circles to the ${way} until an eye catches the light, then the weights take over. The biases are what it does by default. The weights are how it reacts.`;
}

/** What the player showed the cart: which start each kept drive was from, and how many examples came of them. */
export interface Shown {
  starts: number[];
  examples: number;
}

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

function taught(shown: Shown): string {
  return `You drove ${times(shown.starts.length)}, and the cart kept ${shown.examples} examples of it: what the eyes saw, and what you did with the wheels. Training never knew about the lamp or the floor. It only turned the dials until the wheels did roughly what yours had, and reaching the lamp came along with that. It's the same loop as the dots: examples, a loss, downhill. Only where the examples come from has changed.`;
}

function taughtBothSides(shown: Shown, startCount: number): string {
  const sides = new Set(shown.starts);
  if (sides.size >= startCount) {
    return `The cart copies what it was shown, and nothing else. Drives from one side are all turns the same way, so dials fitted to them say nothing dependable about turning the other way. With drives from both sides among its ${shown.examples} examples, one set of dials had to fit both. What it was missing wasn't training time. It was examples.`;
  }
  const only = [...sides][0] + 1;
  return `You only drove from start ${only}, and the cart still made it from the other one. That was luck, not teaching: none of your ${shown.examples} examples covers turning the other way, and dials fitted to one side usually send the cart into a wall from the other. Press Start over and try the same thing again, and it may well not work twice. The dependable fix is a drive from each side.`;
}

/** The solved text for a level, tailored to the dials, or null to use the level's own. */
export function explain(level: Level, spec: NetSpec, params: ArrayLike<number>, shown?: Shown): string | null {
  switch (level.explain) {
    case 'two-hidden':
      return spec.layers.length === 2 && spec.layers[0].size === 2 ? twoHidden(level, spec, params) : null;
    case 'cart-steer':
      return cartSteer(params);
    case 'cart-dark':
      return cartDark(params);
    case 'taught':
      return shown && shown.starts.length ? taught(shown) : null;
    case 'taught-both-sides':
      return shown && shown.starts.length ? taughtBothSides(shown, level.drive?.starts.length ?? 2) : null;
    default:
      return null;
  }
}
