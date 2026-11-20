import { describe, expect, it } from 'vitest';
import { levels } from '../levels/act1';
import { N, SHAPE, Terrain } from './terrain';

const hills = levels.filter((l) => l.hill);

describe('the loss landscape', () => {
  it('exists on the levels that talk about it', () => {
    expect(hills.map((l) => l.id)).toEqual(['the-hill', 'which-way-is-down', 'let-it-roll']);
  });

  for (const level of hills) {
    describe(level.id, () => {
      const terrain = new Terrain(level);
      const R = terrain.range;

      it('fits inside the picture', () => {
        for (let r = 0; r < N; r += 4) {
          for (let c = 0; c < N; c += 4) {
            const [x, y] = terrain.onGround(-R + (2 * R * c) / (N - 1), -R + (2 * R * r) / (N - 1));
            expect(x).toBeGreaterThan(0);
            expect(x).toBeLessThan(1);
            expect(y).toBeGreaterThan(0);
            expect(y).toBeLessThan(SHAPE);
          }
        }
      });

      // Regression: the near rim once hid the valley floor, so the goal couldn't be dragged to.
      it('never hides one part of the ground behind another', () => {
        let worst = 0;
        for (let w = -R * 0.95; w <= R * 0.95; w += R / 8) {
          for (let b = -R * 0.95; b <= R * 0.95; b += R / 8) {
            const [x, y] = terrain.onGround(w, b);
            const [pw, pb] = terrain.pick(x, y);
            worst = Math.max(worst, Math.hypot(pw - w, pb - b));
          }
        }
        expect(worst).toBeLessThan(0.05);
      });

      it('lets the ball be dragged to the goal', () => {
        let best = { loss: Infinity, w: 0, b: 0 };
        for (let w = -R; w <= R; w += 0.02) {
          for (let b = -R; b <= R; b += 0.02) {
            const loss = terrain.lossAt(w, b);
            if (loss < best.loss) best = { loss, w, b };
          }
        }
        const [x, y] = terrain.onGround(best.w, best.b);
        const [pw, pb] = terrain.pick(x, y);
        const goal = level.goal.kind === 'loss' ? level.goal.below : 0;
        expect(terrain.lossAt(pw, pb)).toBeLessThan(goal);
      });
    });
  }
});
