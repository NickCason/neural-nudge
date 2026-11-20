import type { Sample } from '../engine/net';
import { gaussian, rng } from '../engine/rng';

/** Points scattered around the line y = slope * x + offset. */
export function linePoints(seed: number, slope: number, offset: number, count = 9, noise = 0.03): Sample[] {
  const next = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const x = -1 + (2 * i) / (count - 1) + (next() - 0.5) * 0.08;
    return { x: [round(x)], y: [round(slope * x + offset + gaussian(next) * noise)] };
  });
}

export interface Clump {
  at: [number, number];
  kind: 0 | 1;
  count: number;
  spread: number;
}

/** Clumps of labelled points on the plane. */
export function clumps(seed: number, list: Clump[]): Sample[] {
  const next = rng(seed);
  const out: Sample[] = [];
  for (const c of list) {
    for (let i = 0; i < c.count; i++) {
      // Clip the tails so a stray point can't make a solvable level unsolvable.
      const dx = clip(gaussian(next), 1.6) * c.spread;
      const dy = clip(gaussian(next), 1.6) * c.spread;
      out.push({ x: [round(c.at[0] + dx), round(c.at[1] + dy)], y: [c.kind] });
    }
  }
  return out;
}

/** A clump of one kind in the middle with the other kind scattered all the way round it. */
export function ring(seed: number, inside: number, outside: number, radius: number): Sample[] {
  const next = rng(seed);
  const out: Sample[] = [];
  for (let i = 0; i < inside; i++) {
    out.push({ x: [round(clip(gaussian(next), 1.5) * 0.13), round(clip(gaussian(next), 1.5) * 0.13)], y: [1] });
  }
  for (let i = 0; i < outside; i++) {
    const angle = ((i + next() * 0.6) / outside) * Math.PI * 2;
    const r = radius + (next() - 0.5) * 0.14;
    out.push({ x: [round(Math.cos(angle) * r), round(Math.sin(angle) * r)], y: [0] });
  }
  return out;
}

function clip(v: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, v));
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
