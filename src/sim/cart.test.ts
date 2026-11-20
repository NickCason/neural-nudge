import { describe, expect, it } from 'vitest';
import { levels } from '../levels';
import type { Level } from '../levels/types';
import { sense, trips } from './cart';

const byId = (id: string): Level => levels.find((l) => l.id === id)!;
const goalOf = (level: Level) => (level.goal.kind === 'park' ? 'park' : 'arrive');
const run = (level: Level, params: number[]) => trips(level.spec, params, level.drive!, goalOf(level));
const met = (level: Level, params: number[]) => run(level, params).every((t) => t.met);

describe('the eyes', () => {
  const lamp = { x: 0, y: 1 };
  it('see more with the eye on the side the lamp is on', () => {
    const [left, right] = sense({ x: 0.5, y: 0, a: Math.PI / 2 }, lamp); // lamp is ahead and to the left
    expect(left).toBeGreaterThan(right);
  });
  it('see nothing when facing away', () => {
    expect(sense({ x: 0, y: 0, a: -Math.PI / 2 }, lamp)).toEqual([0, 0]);
  });
  it('see more and more on the way in', () => {
    let last = 0;
    for (let y = -0.8; y < 0.9; y += 0.1) {
      const [left] = sense({ x: 0, y, a: Math.PI / 2 }, lamp);
      expect(left).toBeGreaterThan(last);
      last = left;
    }
  });
});

describe('driving levels', () => {
  const driving = levels.filter((l) => l.view === 'drive');
  it('come after the first act and do not begin solved', () => {
    expect(driving.map((l) => l.id)).toEqual(['two-eyes-two-wheels', 'in-the-dark', 'stop-at-the-lamp']);
    for (const level of driving) expect(met(level, level.start), level.id).toBe(false);
  });
});

describe('two eyes, two wheels', () => {
  const level = byId('two-eyes-two-wheels');
  it('swings away from the lamp as wired at the start', () => {
    const [t] = run(level, level.start);
    expect(t.crashed).toBe('wall');
    expect(t.closest).toBeGreaterThan(1);
  });
  it('reaches the lamp once the wires are crossed, fully or mostly', () => {
    expect(met(level, [0, 1, 0.25, 1, 0, 0.25])).toBe(true);
    expect(met(level, [0.2, 0.8, 0.25, 0.8, 0.2, 0.25])).toBe(true);
    expect(met(level, [0.1, 0.9, 0.25, 0.7, 0, 0.25])).toBe(true);
  });
  it('does not reach it half crossed', () => {
    expect(met(level, [0.5, 0.5, 0.25, 0.5, 0.5, 0.25])).toBe(false);
  });
});

describe('in the dark', () => {
  const level = byId('in-the-dark');
  it('starts from the answer to the level before, which fails only from the start that faces away', () => {
    expect(run(level, level.start).map((t) => t.met)).toEqual([true, true, false]);
  });
  it('is solved by making the biases unequal, either way round', () => {
    expect(met(level, [0, 1, 0.15, 1, 0, 0.3])).toBe(true);
    expect(met(level, [0, 1, 0.2, 1, 0, 0.3])).toBe(true);
    expect(met(level, [0, 1, 0.3, 1, 0, 0.2])).toBe(true);
  });
});

describe('stop at the lamp', () => {
  const level = byId('stop-at-the-lamp');
  it('rams the lamp as wired at the start', () => {
    expect(run(level, level.start)[0].crashed).toBe('lamp');
  });
  it('parks when each eye brakes its own wheel, across a range of strengths', () => {
    for (const [w, b] of [[-0.6, 0.4], [-1, 0.6], [-1, 0.7], [-0.8, 0.5], [-1.5, 1], [-2, 1.2]]) {
      expect(met(level, [w, 0, b, 0, w, b]), `${w} / ${b}`).toBe(true);
    }
  });
  it('drives off when the braking wires are crossed', () => {
    expect(run(level, [0, -1, 0.4, -1, 0, 0.4])[0].crashed).toBe('wall');
  });
  it('stops short when the brakes are too strong for the biases', () => {
    const [t] = run(level, [-1, 0, 0.3, 0, -1, 0.3]);
    expect(t.met).toBe(false);
    expect(t.endDistance).toBeGreaterThan(0.34);
  });
});
