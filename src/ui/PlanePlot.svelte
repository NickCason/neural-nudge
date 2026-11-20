<script lang="ts">
  import { predict, trace } from '../engine/net';
  import { game } from '../game.svelte';
  import { COLORS, contour, rgb } from './format';

  const S = 300;
  const R = 1.1;
  const N = 56;
  const px = (x: number) => ((x + R) / (2 * R)) * S;
  const py = (y: number) => S - ((y + R) / (2 * R)) * S;

  const params = $derived([...game.params]);

  /** The shown neuron's answer across the plane, scaled so 0.5 is "undecided". */
  const field = $derived.by(() => {
    const out = new Float32Array(N * N);
    const focus = game.focus;
    const signed = focus ? game.spec.layers[focus.layer].act !== 'sigmoid' : false;
    for (let r = 0; r < N; r++) {
      const y = R - (2 * R * r) / (N - 1);
      for (let c = 0; c < N; c++) {
        const x = -R + (2 * R * c) / (N - 1);
        let v: number;
        if (focus) {
          v = trace(game.spec, params, [x, y]).a[focus.layer + 1][focus.neuron];
          if (signed) v = (Math.max(-1, Math.min(1, v)) + 1) / 2;
        } else {
          v = predict(game.spec, params, [x, y])[0];
        }
        out[r * N + c] = v;
      }
    }
    return out;
  });

  const edge = $derived(contour(field, N, 0.5));
  const cell = S / (N - 1);

  const points = $derived(
    game.level.data.map((s, i) => {
      const guess = predict(game.spec, params, s.x)[0];
      return { i, x: px(s.x[0]), y: py(s.x[1]), kind: s.y[0], wrong: guess > 0.5 !== s.y[0] > 0.5 };
    }),
  );

  let canvas: HTMLCanvasElement;

  $effect(() => {
    const values = field;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const image = ctx.createImageData(N, N);
    const base = rgb(COLORS.boardDeep);
    const yes = rgb(COLORS.sun);
    const no = rgb(COLORS.rose);
    for (let i = 0; i < values.length; i++) {
      const s = (values[i] - 0.5) * 2;
      const toward = s >= 0 ? yes : no;
      const k = Math.pow(Math.abs(s), 0.7) * 0.5;
      image.data[i * 4] = base[0] + (toward[0] - base[0]) * k;
      image.data[i * 4 + 1] = base[1] + (toward[1] - base[1]) * k;
      image.data[i * 4 + 2] = base[2] + (toward[2] - base[2]) * k;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  });
</script>

<div class="plane">
  <canvas bind:this={canvas} width={N} height={N} aria-hidden="true"></canvas>
  <svg viewBox="0 0 {S} {S}" role="img" aria-label="The dots, coloured by kind, over the network's answer">
    {#each edge as seg, i (i)}
      <line class="edge" x1={seg[0] * cell} y1={seg[1] * cell} x2={seg[2] * cell} y2={seg[3] * cell} />
    {/each}
    {#each points as p (p.i)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <g
        class="point"
        class:probed={game.probe === p.i}
        onpointerenter={() => (game.probe = p.i)}
        onpointerdown={() => (game.probe = p.i)}
        onpointerleave={(e) => {
          if (e.pointerType === 'mouse') game.probe = null;
        }}
      >
        <circle class="hit" cx={p.x} cy={p.y} r="11" />
        {#if p.wrong}
          <circle class="wrong" cx={p.x} cy={p.y} r="10" />
        {/if}
        {#if p.kind > 0.5}
          <circle class="yes" cx={p.x} cy={p.y} r="5.5" />
        {:else}
          <rect class="no" x={p.x - 5} y={p.y - 5} width="10" height="10" rx="1.5" />
        {/if}
      </g>
    {/each}
    <text class="tick" x={S - 8} y={S - 10} text-anchor="end">x<tspan dy="3" font-size="8">1</tspan><tspan dy="-3">&#160;across</tspan></text>
    <text class="tick" x="8" y="16">x<tspan dy="3" font-size="8">2</tspan><tspan dy="-3">&#160;up</tspan></text>
  </svg>
</div>

<style>
  .plane {
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

  svg {
    touch-action: manipulation;
  }

  .edge {
    stroke: var(--chalk);
    stroke-width: 2.5;
    stroke-linecap: round;
  }

  .hit {
    fill: transparent;
  }

  .yes {
    fill: var(--sun);
    stroke: var(--board-deep);
    stroke-width: 1.5;
  }

  .no {
    fill: var(--rose);
    stroke: var(--board-deep);
    stroke-width: 1.5;
  }

  .wrong {
    fill: none;
    stroke: var(--chalk);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
  }

  .point.probed .yes,
  .point.probed .no {
    stroke: var(--chalk);
  }

  .tick {
    fill: var(--dust);
    font-size: 11px;
  }
</style>
