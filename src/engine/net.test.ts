import { describe, expect, it } from 'vitest';
import { evaluate, lossOnly, paramCount, paramLayout, predict, trace, countCorrect } from './net';
import type { LossKind, NetSpec, Sample } from './net';
import { rng } from './rng';

function randomParams(spec: NetSpec, seed: number): number[] {
  const next = rng(seed);
  return Array.from({ length: paramCount(spec) }, () => next() * 2 - 1);
}

function numericGrad(spec: NetSpec, p: number[], data: Sample[], kind: LossKind): number[] {
  const h = 1e-5;
  return p.map((_, i) => {
    const up = p.slice();
    const down = p.slice();
    up[i] += h;
    down[i] -= h;
    return (evaluate(spec, up, data, kind).loss - evaluate(spec, down, data, kind).loss) / (2 * h);
  });
}

describe('layout', () => {
  it('orders parameters as weights then bias, neuron by neuron', () => {
    const spec: NetSpec = { inputs: 2, layers: [{ size: 2, act: 'tanh' }, { size: 1, act: 'sigmoid' }] };
    const layout = paramLayout(spec);
    expect(layout).toHaveLength(9);
    expect(paramCount(spec)).toBe(9);
    expect(layout.map((p) => `${p.layer}.${p.neuron}.${p.kind === 'bias' ? 'b' : p.from}`)).toEqual([
      '0.0.0', '0.0.1', '0.0.b', '0.1.0', '0.1.1', '0.1.b', '1.0.0', '1.0.1', '1.0.b',
    ]);
  });
});

describe('forward', () => {
  it('computes a single linear neuron by hand', () => {
    const spec: NetSpec = { inputs: 2, layers: [{ size: 1, act: 'linear' }] };
    expect(predict(spec, [2, -3, 0.5], [1, 2])[0]).toBeCloseTo(2 - 6 + 0.5);
  });

  it('keeps every intermediate value in the trace', () => {
    const spec: NetSpec = { inputs: 1, layers: [{ size: 2, act: 'relu' }, { size: 1, act: 'linear' }] };
    const t = trace(spec, [1, 0, -1, 0, 1, 1, 0.25], [2]);
    expect(t.z[0]).toEqual([2, -2]);
    expect(t.a[1]).toEqual([2, 0]);
    expect(t.a[2][0]).toBeCloseTo(2.25);
  });
});

describe('gradients match finite differences', () => {
  const next = rng(7);
  const data2: Sample[] = Array.from({ length: 6 }, () => ({
    x: [next() * 2 - 1, next() * 2 - 1],
    y: [next() > 0.5 ? 1 : 0],
  }));

  const cases: [string, NetSpec, LossKind][] = [
    ['one linear neuron, mse', { inputs: 2, layers: [{ size: 1, act: 'linear' }] }, 'mse'],
    ['one sigmoid neuron, bce', { inputs: 2, layers: [{ size: 1, act: 'sigmoid' }] }, 'bce'],
    ['2-3-1 tanh, bce', { inputs: 2, layers: [{ size: 3, act: 'tanh' }, { size: 1, act: 'sigmoid' }] }, 'bce'],
    ['2-3-2-1 mixed, mse', { inputs: 2, layers: [{ size: 3, act: 'tanh' }, { size: 2, act: 'sigmoid' }, { size: 1, act: 'linear' }] }, 'mse'],
  ];

  for (const [name, spec, kind] of cases) {
    it(name, () => {
      const p = randomParams(spec, 42);
      const analytic = evaluate(spec, p, data2, kind).grad;
      const numeric = numericGrad(spec, p, data2, kind);
      analytic.forEach((g, i) => expect(g).toBeCloseTo(numeric[i], 5));
    });
  }
});

describe('lossOnly', () => {
  it('agrees with the loss that comes with the gradient', () => {
    const spec: NetSpec = { inputs: 2, layers: [{ size: 3, act: 'tanh' }, { size: 1, act: 'sigmoid' }] };
    const next = rng(3);
    const data: Sample[] = Array.from({ length: 5 }, () => ({ x: [next(), next()], y: [next() > 0.5 ? 1 : 0] }));
    const p = randomParams(spec, 9);
    expect(lossOnly(spec, p, data, 'bce')).toBeCloseTo(evaluate(spec, p, data, 'bce').loss, 10);
    expect(lossOnly(spec, p, data, 'mse')).toBeCloseTo(evaluate(spec, p, data, 'mse').loss, 10);
  });
});

describe('countCorrect', () => {
  it('counts samples on the right side of one half', () => {
    const spec: NetSpec = { inputs: 1, layers: [{ size: 1, act: 'sigmoid' }] };
    const data: Sample[] = [
      { x: [1], y: [1] },
      { x: [-1], y: [0] },
      { x: [2], y: [0] },
    ];
    expect(countCorrect(spec, [3, 0], data)).toBe(2);
  });
});
