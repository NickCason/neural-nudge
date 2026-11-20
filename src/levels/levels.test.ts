import { describe, expect, it } from 'vitest';
import { countCorrect, evaluate, paramCount } from '../engine/net';
import { descend, freshParams, goalMet, seedFor, specFor } from '../play';
import { levels } from './act1';
import type { Level } from './types';

const byId = (id: string): Level => {
  const level = levels.find((l) => l.id === id);
  if (!level) throw new Error(`no level ${id}`);
  return level;
};

interface Run {
  hidden?: number;
  shuffles?: number;
  /** Start from these dials instead of the level's own. */
  from?: number[];
}

/** The dials a level starts from, the way the game sets them up. */
function startOf(level: Level, hidden: number, shuffles: number): number[] {
  const spec = specFor(level, hidden);
  if (level.grow ? hidden > 0 || shuffles > 0 : shuffles > 0) return freshParams(spec, seedFor(level, hidden, shuffles));
  return level.start.slice();
}

/** Train with plain gradient descent and report whether the goal was met, and when. */
function train(level: Level, rate: number, maxSteps: number, run: Run = {}) {
  const hidden = run.hidden ?? level.grow?.start ?? 0;
  const spec = specFor(level, hidden);
  const fixed = level.grow ? [] : [...(level.hidden ?? []), ...(level.locked ?? [])];
  let params = run.from ?? startOf(level, hidden, run.shuffles ?? 0);
  let best = 0;
  for (let step = 0; step <= maxSteps; step++) {
    const { loss, grad } = evaluate(spec, params, level.data, level.loss);
    const correct = countCorrect(spec, params, level.data);
    best = Math.max(best, correct);
    if (goalMet(level, loss, correct)) return { met: true, steps: step, loss, best };
    if (!Number.isFinite(loss)) return { met: false, steps: step, loss, best };
    params = descend(params, grad, rate, fixed);
  }
  const loss = evaluate(spec, params, level.data, level.loss).loss;
  return { met: false, steps: maxSteps, loss, best };
}

/** Whether a given setting of the dials meets the level's goal. */
function solves(level: Level, params: number[]): boolean {
  const { loss } = evaluate(level.spec, params, level.data, level.loss);
  return goalMet(level, loss, countCorrect(level.spec, params, level.data));
}

describe('every level', () => {
  it('has unique ids and a start that fits its network', () => {
    expect(new Set(levels.map((l) => l.id)).size).toBe(levels.length);
    for (const level of levels) expect(level.start).toHaveLength(paramCount(level.spec));
  });

  it('does not begin already solved', () => {
    for (const level of levels) {
      const hidden = level.grow?.start ?? 0;
      const spec = specFor(level, hidden);
      const start = startOf(level, hidden, 0);
      const { loss } = evaluate(spec, start, level.data, level.loss);
      expect(goalMet(level, loss, countCorrect(spec, start, level.data)), level.id).toBe(false);
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

describe('two opinions', () => {
  const level = byId('two-opinions');
  it('is solved by saying yes where neuron 1 agrees and neuron 2 does not', () => {
    const p = level.start.slice();
    [p[6], p[7], p[8]] = [2, -2, -1];
    expect(solves(level, p)).toBe(true);
  });
  it('can be solved by training the output neuron alone', () => {
    expect(train(level, 1, 2000).met).toBe(true);
  });
  it('keeps the hidden neurons locked', () => {
    expect(level.locked).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('move the lines', () => {
  const level = byId('move-the-lines');
  it('is solved by standing the two lines either side of the yellow stripe', () => {
    const p = level.start.slice();
    [p[0], p[1], p[2]] = [4, 0, 1.4];
    [p[3], p[4], p[5]] = [4, 0, -1.4];
    expect(solves(level, p)).toBe(true);
  });
  it('keeps the output rule from the level before', () => {
    expect(level.locked).toEqual([6, 7, 8]);
    expect(solves(byId('two-opinions'), [...byId('two-opinions').start.slice(0, 6), ...level.start.slice(6)])).toBe(true);
  });
});

describe('hands off again', () => {
  const level = byId('hands-off-again');
  it('trains from its starting dials slowly enough to watch', () => {
    const result = train(level, level.rate!.value, 1500);
    expect(result.met).toBe(true);
    expect(result.steps).toBeGreaterThan(40);
  });
  it('recovers on the first shuffle', () => {
    expect(train(level, level.rate!.value, 1500, { shuffles: 1 }).met).toBe(true);
  });
});

describe('fence it in', () => {
  const level = byId('fence-it-in');
  it('starts with two hidden neurons, which can never surround the middle', () => {
    expect(level.grow!.start).toBe(2);
    for (const shuffles of [0, 1, 2, 3, 4, 5]) {
      expect(train(level, 1, 3000, { hidden: 2, shuffles }).met).toBe(false);
    }
  });
  it('is solved on the first run after adding a neuron, and with more', () => {
    for (const hidden of [3, 4, 5]) {
      const result = train(level, level.rate!.value, 1500, { hidden });
      expect(result.met, `${hidden} hidden`).toBe(true);
    }
  });
  it('is usually solved after a shuffle too', () => {
    const solved = [1, 2, 3].filter((shuffles) => train(level, 1, 1500, { hidden: 3, shuffles }).met).length;
    expect(solved).toBeGreaterThanOrEqual(2);
  });
});
