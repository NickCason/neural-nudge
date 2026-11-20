<script lang="ts">
  import { predict } from '../engine/net';
  import { game } from '../game.svelte';

  const S = 300;
  const R = 1.6; // the plot shows -R..R on both axes, so error squares are true squares
  const px = (x: number) => ((x + R) / (2 * R)) * S;
  const py = (y: number) => S - ((y + R) / (2 * R)) * S;

  const params = $derived([...game.params]);

  const line = $derived(
    Array.from({ length: 33 }, (_, i) => {
      const x = -R + (2 * R * i) / 32;
      return `${px(x).toFixed(1)},${py(predict(game.spec, params, [x])[0]).toFixed(1)}`;
    }).join(' '),
  );

  const points = $derived(
    game.level.data.map((s, i) => {
      const guess = predict(game.spec, params, s.x)[0];
      const x = px(s.x[0]);
      const y = py(s.y[0]);
      const gy = py(guess);
      const side = Math.abs(gy - y);
      return { i, x, y, gy, side, top: Math.min(y, gy) };
    }),
  );
</script>

<svg class="plot" viewBox="0 0 {S} {S}" role="img" aria-label="The examples and the machine's guesses">
  <defs>
    <clipPath id="line-clip"><rect width={S} height={S} rx="6" /></clipPath>
  </defs>
  <rect class="ground" width={S} height={S} rx="6" />
  <g clip-path="url(#line-clip)">
    <line class="axis" x1="0" y1={py(0)} x2={S} y2={py(0)} />
    <line class="axis" x1={px(0)} y1="0" x2={px(0)} y2={S} />
    {#each points as p (p.i)}
      <rect class="square" x={p.x} y={p.top} width={p.side} height={p.side} />
    {/each}
    <polyline class="guess" points={line} />
    {#each points as p (p.i)}
      <line class="miss" x1={p.x} y1={p.y} x2={p.x} y2={p.gy} />
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
        <circle class="hit" cx={p.x} cy={p.y} r="13" />
        <circle class="dot" cx={p.x} cy={p.y} r="4.5" />
      </g>
    {/each}
  </g>
  <text class="tick" x={S - 8} y={py(0) - 7} text-anchor="end">input</text>
  <text class="tick" x={px(0) + 8} y="16">answer</text>
</svg>

<style>
  .plot {
    width: 100%;
    height: auto;
    display: block;
    touch-action: manipulation;
  }

  .ground {
    fill: var(--board-deep);
  }

  .axis {
    stroke: var(--rule);
    stroke-width: 1;
  }

  .square {
    fill: color-mix(in srgb, var(--sky) 9%, transparent);
    stroke: color-mix(in srgb, var(--sky) 32%, transparent);
    stroke-width: 1;
  }

  .guess {
    fill: none;
    stroke: var(--chalk);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .miss {
    stroke: var(--sky);
    stroke-width: 1.5;
  }

  .hit {
    fill: transparent;
  }

  .dot {
    fill: var(--sun);
    stroke: var(--board-deep);
    stroke-width: 1.5;
  }

  .point.probed .dot {
    r: 7px;
    stroke: var(--chalk);
  }

  .tick {
    fill: var(--dust);
    font-size: 11px;
  }
</style>
