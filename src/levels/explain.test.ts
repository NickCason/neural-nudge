import { describe, expect, it } from 'vitest';
import { countCorrect } from '../engine/net';
import { levels } from './index';
import { explain, steerKind, twoHiddenKind } from './explain';

const byId = (id: string) => levels.find((l) => l.id === id)!;

describe('two hidden neurons: which solution was found', () => {
  const level = byId('hands-off-again');
  const all = level.data.length;

  it("recognises a player's real run where the lines sit together and softness does the work", () => {
    // dials read off a screenshot of a solved level 11
    const p = [0.87, -0.94, 0.33, -2.46, 2.71, -1.52, 5.35, 4.61, 1.25];
    expect(countCorrect(level.spec, p, level.data)).toBe(all);
    const found = twoHiddenKind(level, level.spec, p);
    expect(found.kind).toBe('ramp');
    expect(found.sharper).toBe(1);
    expect(explain(level, level.spec, p)).toContain('Hidden neuron 2 has large weights');
  });

  it('recognises lines facing apart with the pink dots between them', () => {
    const p = [4, -4, -2, -4, 4, -2, 3, 3, 3];
    expect(countCorrect(level.spec, p, level.data)).toBe(all);
    const found = twoHiddenKind(level, level.spec, p);
    expect(found.kind).toBe('pink-between');
    expect(found.says).toEqual([false, false]);
  });

  it('recognises lines facing the same way with the yellow dots between them', () => {
    const p = [4, 4, 2, 4, 4, -2, 2, -2, -1];
    expect(countCorrect(level.spec, p, level.data)).toBe(all);
    const found = twoHiddenKind(level, level.spec, p);
    expect(found.kind).toBe('yellow-between');
    expect(found.says).toEqual([true, false]);
  });

  it('never claims a rule the network is not using', () => {
    for (const p of [[0.87, -0.94, 0.33, -2.46, 2.71, -1.52, 5.35, 4.61, 1.25], [4, -4, -2, -4, 4, -2, 3, 3, 3], [4, 4, 2, 4, 4, -2, 2, -2, -1]]) {
      const text = explain(level, level.spec, p)!;
      const kind = twoHiddenKind(level, level.spec, p).kind;
      expect(text.includes('flips like a switch')).toBe(kind === 'ramp');
      expect(text.includes('claimed one yellow clump')).toBe(kind === 'pink-between');
    }
  });
});

describe('the cart: which way of steering was found', () => {
  it('tells crossed wires from braking wires from both', () => {
    expect(steerKind([0, 1, 0.25, 1, 0, 0.25])).toBe('crossed');
    expect(steerKind([-0.6, 0, 0.25, 0, -0.6, 0.25])).toBe('braking');
    expect(steerKind([-0.5, 0.5, 0.25, 0.5, -0.5, 0.25])).toBe('both');
    // the one mixed setting known to solve the first cart level is described as both
    expect(steerKind([-0.2, 0.1, 0.25, 0.1, -0.2, 0.25])).toBe('both');
  });

  it('describes the dark by what the biases really do', () => {
    const level = byId('in-the-dark');
    expect(explain(level, level.spec, [0, 1, 0.15, 1, 0, 0.3])).toContain('circles to the left');
    expect(explain(level, level.spec, [0, 1, 0.3, 1, 0, 0.15])).toContain('circles to the right');
    expect(explain(level, level.spec, [0, 1, 0.3, 1, 0, 0.3])).toContain('yours are equal');
  });
});

describe('what the solved text says about a cart taught by driving', () => {
  const byId = (id: string) => levels.find((l) => l.id === id)!;
  const text = (id: string, starts: number[], examples: number) => {
    const level = byId(id);
    return explain(level, level.spec, level.start, { starts, examples });
  };
  it('counts the drives and the examples', () => {
    expect(text('show-it-how', [0], 32)).toContain('You drove once, and the cart kept 32 examples');
    expect(text('show-it-how', [0, 0, 0], 90)).toContain('You drove 3 times');
  });
  it('credits drives from both sides when both were shown', () => {
    expect(text('off-the-path', [0, 1], 64)).toContain('drives from both sides among its 64 examples');
    expect(text('off-the-path', [1, 0, 0], 99)).toContain('both sides');
  });
  it('calls it luck when only one side was shown, and names the side', () => {
    expect(text('off-the-path', [1, 1], 60)).toContain('You only drove from start 2');
    expect(text('off-the-path', [0], 30)).toContain('That was luck');
  });
});
