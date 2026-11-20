<script lang="ts">
  import { predict, trace } from '../engine/net';
  import { game } from '../game.svelte';
  import { answerInk, contour } from './format';

  const S = 300;
  const R = 1.1;
  const N = 72;
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
  /** Lines of equal confidence, like height lines on a map: close together where the answer flips fast. */
  const sure = $derived([0.08, 0.25, 0.75, 0.92].map((level) => ({ level, lines: contour(field, N, level) })));
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
    for (let i = 0; i < values.length; i++) {
      const ink = answerInk((values[i] - 0.5) * 2, 0.46);
      image.data[i * 4] = ink[0];
      image.data[i * 4 + 1] = ink[1];
      image.data[i * 4 + 2] = ink[2];
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  });
</script>

<div class="plane">
  <canvas bind:this={canvas} width={N} height={N} aria-hidden="true"></canvas>
  <svg viewBox="0 0 {S} {S}" role="img" aria-label="The dots, coloured by kind, over the network's answer">
    {#each [-0.5, 0, 0.5] as g (g)}
      <line class="grid" x1={px(g)} y1="0" x2={px(g)} y2={S} />
      <line class="grid" x1="0" y1={py(g)} x2={S} y2={py(g)} />
    {/each}
    {#each sure as band (band.level)}
      <g class="sure" class:yes-side={band.level > 0.5}>
        {#each band.lines as seg, i (i)}
          <line x1={seg[0] * cell} y1={seg[1] * cell} x2={seg[2] * cell} y2={seg[3] * cell} />
        {/each}
      </g>
    {/each}
    <g class="edges">
      {#each edge as seg, i (i)}
        <line x1={seg[0] * cell} y1={seg[1] * cell} x2={seg[2] * cell} y2={seg[3] * cell} />
      {/each}
    </g>
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
    border-radius: 10px;
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

  .grid {
    stroke: color-mix(in srgb, var(--chalk) 7%, transparent);
    stroke-width: 1;
  }

  .sure {
    stroke: color-mix(in srgb, var(--rose) 55%, transparent);
    stroke-width: 1;
    stroke-linecap: round;
  }

  .sure.yes-side {
    stroke: color-mix(in srgb, var(--sun) 55%, transparent);
  }

  .edges {
    stroke: var(--chalk);
    stroke-width: 2.5;
    stroke-linecap: round;
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--chalk) 80%, transparent));
  }

  .hit {
    fill: transparent;
  }

  .yes {
    fill: var(--sun);
    stroke: var(--board-deep);
    stroke-width: 1.5;
    filter: drop-shadow(0 0 4px color-mix(in srgb, var(--sun) 70%, transparent));
  }

  .no {
    fill: var(--rose);
    stroke: var(--board-deep);
    stroke-width: 1.5;
    filter: drop-shadow(0 0 4px color-mix(in srgb, var(--rose) 70%, transparent));
  }

  /* A dot on the wrong side keeps tapping for attention until it's fixed. */
  .wrong {
    fill: none;
    stroke: var(--chalk);
    stroke-width: 1.5;
    transform-box: fill-box;
    transform-origin: center;
    animation: tap 1.4s ease-in-out infinite;
  }

  @keyframes tap {
    0%,
    100% {
      transform: scale(0.85);
      opacity: 0.95;
    }
    50% {
      transform: scale(1.25);
      opacity: 0.35;
    }
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
