import { describe, expect, it } from 'vitest';
import { countCorrect, evaluate, paramCount } from '../engine/net';
import { descend, freshParams, goalMet, specFor } from '../play';
import { levels } from './act1';
import type { Level } from './types';

const byId = (id: string): Level => {
  const level = levels.find((l) => l.id === id);
  if (!level) throw new Error(`no level ${id}`);
  return level;
};

/** Train with plain gradient descent and report whether the goal was met, and when. */
function train(level: Level, rate: number, maxSteps: number, hidden = 0, seed = 1) {
  const spec = specFor(level, hidden);
  let params = hidden > 0 ? freshParams(spec, seed) : level.start.slice();
  let best = 0;
  for (let step = 0; step <= maxSteps; step++) {
    const { loss, grad } = evaluate(spec, params, level.data, level.loss);
    const correct = countCorrect(spec, params, level.data);
    best = Math.max(best, correct);
    if (goalMet(level, loss, correct)) return { met: true, steps: step, loss, best };
    if (!Number.isFinite(loss)) return { met: false, steps: step, loss, best };
    params = descend(params, grad, rate, level.hidden);
  }
  const loss = evaluate(spec, params, level.data, level.loss).loss;
  return { met: false, steps: maxSteps, loss, best };
}

describe('every level', () => {
  it('has unique ids and a start that fits its network', () => {
    expect(new Set(levels.map((l) => l.id)).size).toBe(levels.length);
    for (const level of levels) expect(level.start).toHaveLength(paramCount(level.spec));
  });

  it('does not begin already solved', () => {
    for (const level of levels) {
      const { loss } = evaluate(level.spec, level.start, level.data, level.loss);
      const correct = countCorrect(level.spec, level.start, level.data);
      expect(goalMet(level, loss, correct), level.id).toBe(false);
    }
  });
});

describe('hand-tuned levels can be solved', () => {
  for (const id of ['one-dial', 'two-dials', 'the-hill', 'sorting-dots']) {
    it(id, () => expect(train(byId(id), 0.3, 5000).met).toBe(true));
  }
});

describe('which way is down', () => {
  it('is solved in a reasonable number of single-dial nudges', () => {
    const level = byId('which-way-is-down');
    let params = level.start.slice();
    let clicks = 0;
    while (clicks < 40) {
      const { loss, grad } = evaluate(level.spec, params, level.data, level.loss);
      if (goalMet(level, loss, 0)) break;
      // Nudge whichever dial has the longer arrow, as a player would.
      const i = Math.abs(grad[0]) > Math.abs(grad[1]) ? 0 : 1;
      params[i] -= level.nudgeRate! * grad[i];
      clicks++;
    }
    expect(clicks).toBeGreaterThan(3);
    expect(clicks).toBeLessThan(20);
  });
});

describe('let it roll', () => {
  const level = byId('let-it-roll');
  it('fails at the starting step size', () => {
    expect(train(level, level.rate!.value, level.stepBudget!).met).toBe(false);
  });
  it('succeeds within budget at a sensible step size', () => {
    expect(train(level, 0.5, level.stepBudget!).met).toBe(true);
  });
  it('gets worse at the largest step size', () => {
    const start = evaluate(level.spec, level.start, level.data, level.loss).loss;
    expect(train(level, level.rate!.max, level.stepBudget!).loss).toBeGreaterThan(start);
  });
});

describe('hands off', () => {
  const level = byId('hands-off');
  it('fails at the starting step size', () => {
    expect(train(level, level.rate!.value, level.stepBudget!).met).toBe(false);
  });
  it('succeeds within budget at a larger one', () => {
    expect(train(level, 2, level.stepBudget!).met).toBe(true);
  });
});

describe('the wall', () => {
  it('cannot be solved by one neuron', () => {
    const level = byId('the-wall');
    for (const rate of [0.1, 1, 5]) {
      const result = train({ ...level, goal: { kind: 'allCorrect' } }, rate, 3000);
      expect(result.met).toBe(false);
      expect(result.best).toBeLessThanOrEqual(15);
    }
  });
});

describe('bend the line', () => {
  const level = byId('bend-the-line');
  const solvedSeeds = (hidden: number) =>
    [1, 2, 3, 4, 5, 6, 7, 8].filter((seed) => train(level, 1, 3000, hidden, seed).met).length;

  it('still fails with one hidden neuron', () => {
    expect(solvedSeeds(1)).toBe(0);
  });
  it('can be solved with two, though not from every start', () => {
    expect(solvedSeeds(2)).toBeGreaterThanOrEqual(3);
  });
  it('is solved from most starts with four', () => {
    expect(solvedSeeds(4)).toBeGreaterThanOrEqual(6);
  });
});
