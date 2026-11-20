<script lang="ts">
  import { evaluate } from '../engine/net';
  import { game } from '../game.svelte';
  import { COLORS, contour, rgb } from './format';

  const S = 300;
  const N = 64; // settings sampled per side
  const M = 384; // pixels drawn per side
  const BANDS = 11;

  const hill = $derived(game.level.hill!);
  const R = $derived(hill.range);
  const px = (v: number) => ((v + R) / (2 * R)) * S;
  const py = (v: number) => S - ((v + R) / (2 * R)) * S;

  /** Loss at every pair of settings. Only depends on the level, so it's worked out once. */
  const field = $derived.by(() => {
    const level = game.level;
    const out = new Float32Array(N * N);
    const p = level.start.slice();
    for (let r = 0; r < N; r++) {
      p[hill.y] = R - (2 * R * r) / (N - 1);
      for (let c = 0; c < N; c++) {
        p[hill.x] = -R + (2 * R * c) / (N - 1);
        out[r * N + c] = evaluate(level.spec, p, level.data, level.loss).loss;
      }
    }
    return out;
  });

  const cell = S / (N - 1);
  const goal = $derived(game.level.goal.kind === 'loss' ? contour(field, N, game.level.goal.below) : []);

  const here = $derived({ x: px(game.params[hill.x]), y: py(game.params[hill.y]) });
  const trail = $derived(game.trail.map(([a, b]) => `${px(a).toFixed(1)},${py(b).toFixed(1)}`).join(' '));

  /** Downhill direction at the marker, in pixels. */
  const downhill = $derived.by(() => {
    if (!game.tools.hints) return null;
    const gx = -game.evaluation.grad[hill.x];
    const gy = -game.evaluation.grad[hill.y];
    const size = Math.hypot(gx, gy);
    if (!Number.isFinite(size) || size < 0.01) return null;
    const length = 14 + 44 * Math.min(1, Math.sqrt(size / 4));
    const ux = gx / size;
    const uy = -gy / size;
    const tx = here.x + ux * length;
    const ty = here.y + uy * length;
    const h = 7;
    // arrowhead: two short strokes swept back from the tip
    const left = `${tx - ux * h - uy * h * 0.7},${ty - uy * h + ux * h * 0.7}`;
    const right = `${tx - ux * h + uy * h * 0.7},${ty - uy * h - ux * h * 0.7}`;
    return { tx, ty, head: `M${left} L${tx},${ty} L${right}` };
  });

  let canvas: HTMLCanvasElement;
  let svg: SVGSVGElement;

  $effect(() => {
    const values = field;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let max = 0;
    for (const v of values) max = Math.max(max, v);
    const image = ctx.createImageData(M, M);
    const low = rgb(COLORS.boardDeep);
    const high = rgb('#7fa398');
    for (let y = 0; y < M; y++) {
      const fy = (y / (M - 1)) * (N - 1);
      const r0 = Math.min(N - 2, Math.floor(fy));
      const ty = fy - r0;
      for (let x = 0; x < M; x++) {
        const fx = (x / (M - 1)) * (N - 1);
        const c0 = Math.min(N - 2, Math.floor(fx));
        const tx = fx - c0;
        const top = values[r0 * N + c0] * (1 - tx) + values[r0 * N + c0 + 1] * tx;
        const bottom = values[(r0 + 1) * N + c0] * (1 - tx) + values[(r0 + 1) * N + c0 + 1] * tx;
        const v = top * (1 - ty) + bottom * ty;
        // Square root spreads the bands out near the valley floor, like contour lines on a map.
        const band = Math.min(BANDS - 1, Math.floor(Math.sqrt(v / max) * BANDS)) / (BANDS - 1);
        const i = (y * M + x) * 4;
        image.data[i] = low[0] + (high[0] - low[0]) * band;
        image.data[i + 1] = low[1] + (high[1] - low[1]) * band;
        image.data[i + 2] = low[2] + (high[2] - low[2]) * band;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  });

  let dragging = false;

  function place(e: PointerEvent) {
    const box = svg.getBoundingClientRect();
    const a = ((e.clientX - box.left) / box.width) * 2 * R - R;
    const b = R - ((e.clientY - box.top) / box.height) * 2 * R;
    game.setParam(hill.x, Math.round(Math.max(-R, Math.min(R, a)) * 100) / 100);
    game.setParam(hill.y, Math.round(Math.max(-R, Math.min(R, b)) * 100) / 100);
  }

  function down(e: PointerEvent) {
    if (!game.tools.drag) return;
    dragging = true;
    svg.setPointerCapture(e.pointerId);
    place(e);
  }
</script>

<div class="hill">
  <canvas bind:this={canvas} width={M} height={M} aria-hidden="true"></canvas>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    bind:this={svg}
    class:draggable={game.tools.drag}
    viewBox="0 0 {S} {S}"
    role="img"
    aria-label="Loss for every setting of the weight and the bias, with the machine's position marked"
    onpointerdown={down}
    onpointermove={(e) => dragging && place(e)}
    onpointerup={() => (dragging = false)}
    onpointercancel={() => (dragging = false)}
  >
    <line class="axis" x1="0" y1={py(0)} x2={S} y2={py(0)} />
    <line class="axis" x1={px(0)} y1="0" x2={px(0)} y2={S} />
    {#each goal as seg, i (i)}
      <line class="goal" x1={seg[0] * cell} y1={seg[1] * cell} x2={seg[2] * cell} y2={seg[3] * cell} />
    {/each}
    <polyline class="trail" points={trail} />
    {#if downhill}
      <line class="downhill" x1={here.x} y1={here.y} x2={downhill.tx} y2={downhill.ty} />
      <path class="downhill" d={downhill.head} />
    {/if}
    <circle class="here" cx={here.x} cy={here.y} r="7" />
    <text class="tick" x={S - 8} y={py(0) - 7} text-anchor="end">weight</text>
    <text class="tick" x={px(0) + 8} y="16">bias</text>
  </svg>
</div>

<style>
  .hill {
    position: relative;
    aspect-ratio: 1;
    border-radius: 6px;
    overflow: hidden;
    background: var(--board-deep);
  }

  canvas,
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  svg.draggable {
    cursor: grab;
    touch-action: none;
  }

  .axis {
    stroke: color-mix(in srgb, var(--chalk) 22%, transparent);
    stroke-width: 1;
  }

  .goal {
    stroke: var(--sun);
    stroke-width: 2;
    stroke-linecap: round;
  }

  .trail {
    fill: none;
    stroke: var(--sky);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.9;
  }

  .downhill {
    fill: none;
    stroke: var(--sky);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .here {
    fill: var(--chalk);
    stroke: var(--board-deep);
    stroke-width: 2;
  }

  .tick {
    fill: var(--chalk);
    font-size: 11px;
    opacity: 0.8;
  }
</style>
