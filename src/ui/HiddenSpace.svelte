<script lang="ts">
  import { activate, predict, trace } from '../engine/net';
  import { game } from '../game.svelte';
  import { answerInk, contour } from './format';

  // The dots where the two hidden neurons put them. This is everything the output neuron
  // gets to see, and in here it only ever draws one straight line.
  const S = 300;
  const R = 1.42;
  const N = 48;
  const px = (v: number) => ((v + R) / (2 * R)) * S;
  const py = (v: number) => S - ((v + R) / (2 * R)) * S;

  const params = $derived([...game.params]);
  /** The output neuron's three dials: weight from neuron 1, weight from neuron 2, bias. */
  const out = $derived(params.slice(game.spec.layers[0].size * (game.spec.inputs + 1)));
  const outAct = $derived(game.spec.layers[game.spec.layers.length - 1].act);

  const field = $derived.by(() => {
    const values = new Float32Array(N * N);
    for (let r = 0; r < N; r++) {
      const h2 = R - (2 * R * r) / (N - 1);
      for (let c = 0; c < N; c++) {
        const h1 = -R + (2 * R * c) / (N - 1);
        values[r * N + c] = activate(outAct, out[0] * h1 + out[1] * h2 + out[2]);
      }
    }
    return values;
  });

  const edge = $derived(contour(field, N, 0.5));
  const cell = S / (N - 1);

  const points = $derived(
    game.level.data.map((s, i) => {
      const hidden = trace(game.spec, params, s.x).a[1];
      const guess = predict(game.spec, params, s.x)[0];
      return { i, x: px(hidden[0]), y: py(hidden[1]), kind: s.y[0], wrong: guess > 0.5 !== s.y[0] > 0.5 };
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

<div class="space">
  <canvas bind:this={canvas} width={N} height={N} aria-hidden="true"></canvas>
  <svg viewBox="0 0 {S} {S}" role="img" aria-label="Each dot placed by what the two hidden neurons say about it">
    <!-- the square the hidden neurons' answers live in: -1 to +1 each -->
    <rect class="frame" x={px(-1)} y={py(1)} width={px(1) - px(-1)} height={py(-1) - py(1)} />
    <line class="mid" x1={px(0)} y1={py(1)} x2={px(0)} y2={py(-1)} />
    <line class="mid" x1={px(-1)} y1={py(0)} x2={px(1)} y2={py(0)} />
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
        <circle class="hit" cx={p.x} cy={p.y} r="10" />
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
    <text class="tick" x={px(-1)} y={S - 7}>1 says no</text>
    <text class="tick" x={px(1)} y={S - 7} text-anchor="end">1 says yes</text>
    <text class="tick" x="-{py(-1)}" y="12" transform="rotate(-90)">2 says no</text>
    <text class="tick" x="-{py(1)}" y="12" transform="rotate(-90)" text-anchor="end">2 says yes</text>
  </svg>
</div>

<style>
  .space {
    position: relative;
    aspect-ratio: 1;
    border-radius: 10px;
    overflow: hidden;
    background: var(--board-deep);
    box-shadow:
      0 0 0 1.5px var(--rule),
      0 18px 50px -24px rgba(0, 0, 0, 0.8);
  }

  canvas,
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .frame {
    fill: none;
    stroke: color-mix(in srgb, var(--chalk) 28%, transparent);
    stroke-width: 1;
    stroke-dasharray: 3 4;
  }

  .mid {
    stroke: color-mix(in srgb, var(--chalk) 8%, transparent);
    stroke-width: 1;
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

  /* Dots pile up in the corners here, so they're see-through enough to count. */
  .yes {
    fill: color-mix(in srgb, var(--sun) 78%, transparent);
    stroke: var(--board-deep);
    stroke-width: 1.5;
  }

  .no {
    fill: color-mix(in srgb, var(--rose) 78%, transparent);
    stroke: var(--board-deep);
    stroke-width: 1.5;
  }

  .point.probed .yes,
  .point.probed .no {
    stroke: var(--chalk);
  }

  .point {
    transition: transform 0.08s linear;
  }

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

  .tick {
    fill: var(--dust);
    font-size: 10.5px;
    pointer-events: none;
  }
</style>
