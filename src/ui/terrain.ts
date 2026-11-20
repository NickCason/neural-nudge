/**
 * The geometry of the loss landscape: loss over two dials, drawn as ground seen from above
 * and to one side. Kept apart from the drawing so the tricky part can be tested: every spot
 * on the ground has to be visible, or the player can't see or reach the goal.
 */
import { evaluate } from '../engine/net';
import type { Level } from '../levels/types';

/** Settings sampled per side. */
export const N = 49;
/** Radians the ground is turned, so it reads as a solid. */
export const TURN = -0.4;
/**
 * How far above the ground we're looking from. It has to be high enough that the near rim
 * never hides the valley floor: tan(TILT) must beat RISE / SPREAD times the steepest slope
 * facing the viewer.
 */
export const TILT = 0.85;
export const SPREAD = 0.31;
export const RISE = 0.36;
export const BASE = 0.57;
/** The picture's height as a share of its width. */
export const SHAPE = 0.9;

const cosT = Math.cos(TURN);
const sinT = Math.sin(TURN);

/** How far from the viewer a setting is, in the same units the tiles are sorted by. */
export const depth = (u: number, v: number) => u * sinT + v * cosT;

export class Terrain {
  /** Loss at every pair of settings. Row 0 is the lowest bias, column 0 the lowest weight. */
  readonly field: Float32Array;
  /** The dials run from -range to +range. */
  readonly range: number;
  readonly peak: number;

  constructor(level: Level) {
    const hill = level.hill;
    if (!hill) throw new Error(`level ${level.id} has no hill`);
    this.range = hill.range;
    const R = hill.range;
    this.field = new Float32Array(N * N);
    const p = level.start.slice();
    let peak = 0;
    for (let r = 0; r < N; r++) {
      p[hill.y] = -R + (2 * R * r) / (N - 1);
      for (let c = 0; c < N; c++) {
        p[hill.x] = -R + (2 * R * c) / (N - 1);
        const loss = evaluate(level.spec, p, level.data, level.loss).loss;
        this.field[r * N + c] = loss;
        peak = Math.max(peak, loss);
      }
    }
    this.peak = peak || 1;
  }

  /** Height of the ground, 0..1. The square root keeps the valley floor from looking flat. */
  heightOf(loss: number): number {
    return Math.sqrt(Math.min(loss, this.peak) / this.peak);
  }

  /** Loss between grid points. */
  lossAt(w: number, b: number): number {
    const R = this.range;
    const fc = Math.max(0, Math.min(N - 1.001, ((w + R) / (2 * R)) * (N - 1)));
    const fr = Math.max(0, Math.min(N - 1.001, ((b + R) / (2 * R)) * (N - 1)));
    const c = Math.floor(fc);
    const r = Math.floor(fr);
    const tc = fc - c;
    const tr = fr - r;
    const f = this.field;
    const top = f[r * N + c] * (1 - tc) + f[r * N + c + 1] * tc;
    const bottom = f[(r + 1) * N + c] * (1 - tc) + f[(r + 1) * N + c + 1] * tc;
    return top * (1 - tr) + bottom * tr;
  }

  /** Where a setting, at a given height, lands on the picture, in widths (so y runs 0..SHAPE). */
  project(w: number, b: number, h: number): [number, number] {
    const u = w / this.range;
    const v = b / this.range;
    const across = u * cosT - v * sinT;
    return [0.5 + across * SPREAD, BASE - depth(u, v) * SPREAD * Math.sin(TILT) - h * RISE * Math.cos(TILT)];
  }

  /** Where a setting lands when it's resting on the ground, optionally lifted a little above it. */
  onGround(w: number, b: number, lift = 0): [number, number] {
    return this.project(w, b, this.heightOf(this.lossAt(w, b)) + lift);
  }

  /** The setting whose spot on the ground is nearest a point on the picture. */
  pick(px: number, py: number): [number, number] {
    const R = this.range;
    let best: [number, number] = [0, 0];
    let bestGap = Infinity;
    const consider = (w: number, b: number) => {
      const p = this.onGround(w, b);
      const gap = (p[0] - px) ** 2 + (p[1] - py) ** 2;
      if (gap < bestGap) {
        bestGap = gap;
        best = [w, b];
      }
    };
    const cell = (2 * R) / (N - 1);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) consider(-R + c * cell, -R + r * cell);
    // then look closer round the best grid point
    for (const step of [cell / 3, cell / 9]) {
      const [w0, b0] = best;
      for (let i = -3; i <= 3; i++) {
        for (let j = -3; j <= 3; j++) {
          consider(Math.max(-R, Math.min(R, w0 + i * step)), Math.max(-R, Math.min(R, b0 + j * step)));
        }
      }
    }
    return best;
  }
}
