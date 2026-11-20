import { describe, expect, it } from 'vitest';
import { evaluate } from '../engine/net';
import type { Sample } from '../engine/net';
import { levels } from '../levels';
import { descend } from '../play';
import { trip } from './cart';
import type { Point, Pose } from './cart';
import { driveWith } from './teach';
import type { Steer } from './teach';

/** A stand-in for a person: steers toward the lamp, but late, in held bursts, and not quite straight. */
function person(lamp: Point, seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const dead = 0.1 + rnd() * 0.25;
  let hold = 0;
  let steer: Steer = 0;
  return (pose: Pose): Steer => {
    if (hold-- <= 0) {
      let b = Math.atan2(lamp.y - pose.y, lamp.x - pose.x) - pose.a;
      b = Math.atan2(Math.sin(b), Math.cos(b)) + (rnd() - 0.5) * 0.2;
      steer = b > dead ? 1 : b < -dead ? -1 : 0;
      hold = 4 + Math.floor(rnd() * 8);
    }
    return steer;
  };
}

const level = levels.find((l) => l.id === 'off-the-path')!;
const { lamp, starts } = level.drive!;

function train(data: Sample[], steps = 400): number[] {
  let params = level.start.slice();
  for (let i = 0; i < steps; i++) params = descend(params, evaluate(level.spec, params, data, 'mse').grad, level.rate!.value);
  return params;
}
const reaches = (params: number[], k: number) => trip(level.spec, params, level.drive!, starts[k], 'arrive').met;

/** Out of 40 different people: how often the trained cart reaches the lamp from each start. */
function tally(from: number[]) {
  const wins = [0, 0];
  let drove = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const drives = from.map((k, j) => driveWith(k, starts[k], lamp, person(lamp, seed * 31 + j * 7 + k)));
    if (drives.some((d) => !d)) continue;
    drove++;
    const params = train(drives.flatMap((d) => d!.samples));
    [0, 1].forEach((k) => reaches(params, k) && wins[k]++);
  }
  return { wins, drove };
}

describe('teaching the cart by driving it', () => {
  it('does nothing before it has been shown anything', () => {
    expect(reaches(level.start, 0)).toBe(false);
  });
  it('a person can reach the lamp by hand from either start', () => {
    expect(tally([0]).drove).toBeGreaterThanOrEqual(38);
    expect(tally([1]).drove).toBeGreaterThanOrEqual(38);
  });
  it('shown one side, it gets there from that side and not from the other', () => {
    const left = tally([0]);
    const right = tally([1]);
    console.log('one side', left, right);
    expect(left.wins[0]).toBeGreaterThanOrEqual(left.drove * 0.9);
    expect(right.wins[1]).toBeGreaterThanOrEqual(right.drove * 0.9);
    expect(left.wins[1]).toBeLessThanOrEqual(left.drove * 0.15);
    expect(right.wins[0]).toBeLessThanOrEqual(right.drove * 0.15);
  });
  it('shown both sides, it gets there from both', () => {
    const both = tally([0, 1]);
    console.log('both sides', both);
    expect(both.wins[0]).toBeGreaterThanOrEqual(both.drove * 0.85);
    expect(both.wins[1]).toBeGreaterThanOrEqual(both.drove * 0.85);
  });
});
