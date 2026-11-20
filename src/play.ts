/** The rules of play, kept free of UI so they can be tested directly. */
import { paramCount } from './engine/net';
import type { NetSpec } from './engine/net';
import { rng } from './engine/rng';
import type { Level } from './levels/types';

/** The network a level is played on, given how many hidden neurons the player has added. */
export function specFor(level: Level, hidden: number): NetSpec {
  if (!level.grow || hidden <= 0) return level.spec;
  return {
    inputs: level.spec.inputs,
    layers: [{ size: hidden, act: level.grow.act }, ...level.spec.layers],
  };
}

/** The seed for a level's random dials, given how big the network is and how often it's been shuffled. */
export function seedFor(level: Level, hidden: number, shuffles: number): number {
  return (level.seed ?? 1000) + hidden * 97 + shuffles * 7919;
}

/** Random starting values. Weights are spread wide enough that neurons start out different. */
export function freshParams(spec: NetSpec, seed: number): number[] {
  const next = rng(seed);
  const out: number[] = [];
  let fanIn = spec.inputs;
  for (const layer of spec.layers) {
    for (let j = 0; j < layer.size; j++) {
      for (let i = 0; i < fanIn; i++) out.push(round((next() * 2 - 1) * 1.5));
      out.push(round((next() * 2 - 1) * 0.4));
    }
    fanIn = layer.size;
  }
  if (out.length !== paramCount(spec)) throw new Error('parameter count mismatch');
  return out;
}

/** One step of gradient descent. Parameters listed in `frozen` stay put. */
export function descend(params: number[], grad: number[], rate: number, frozen: number[] = []): number[] {
  return params.map((p, i) => (frozen.includes(i) ? p : p - rate * grad[i]));
}

export function goalMet(level: Level, loss: number, correct: number): boolean {
  switch (level.goal.kind) {
    case 'loss':
      return loss < level.goal.below;
    case 'allCorrect':
      return correct === level.data.length;
    case 'impossible':
      return false;
  }
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
