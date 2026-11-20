<script lang="ts">
  import { game } from '../game.svelte';
  import { EYE_ANGLE, LAMP, REACH, RING, STILL } from '../sim/cart';
  import type { Pose } from '../sim/cart';

  // The floor seen from above: the lamp, the path the cart is going to take, and the cart.
  const S = 300;
  const R = 1.1;
  const px = (x: number) => ((x + R) / (2 * R)) * S;
  const py = (y: number) => S - ((y + R) / (2 * R)) * S;
  const scale = S / (2 * R);
  const deg = (a: number) => (-a * 180) / Math.PI;

  const drive = $derived(game.level.drive!);
  const parking = $derived(game.level.goal.kind === 'park');
  const moved = $derived(game.driving || game.clock > 0);

  const routes = $derived(
    game.trips.map((t, k) => {
      const points = t.frames.map((f) => `${px(f.pose.x).toFixed(1)},${py(f.pose.y).toFixed(1)}`);
      const at = Math.min(game.clock, t.frames.length - 1);
      const end = t.frames[t.frames.length - 1].pose;
      return {
        k,
        met: t.met,
        // Time ran out with the wheels still turning: the path doesn't end here, it's cut off.
        rolling: !t.met && !t.crashed && t.endSpeed >= STILL,
        planned: points.join(' '),
        driven: points.slice(0, at + 1).join(' '),
        frame: t.frames[at],
        end,
      };
    }),
  );

  const place = (p: Pose) => `translate(${px(p.x)},${py(p.y)}) rotate(${deg(p.a)})`;
  /** How far a wheel's speed streak reaches behind it. */
  const streak = (speed: number) => Math.max(-10, Math.min(16, speed * 12));
</script>

<svg class="floor" viewBox="0 0 {S} {S}" role="img" aria-label="The cart, the lamp, and the path the cart will take">
  <defs>
    <radialGradient id="lamp-glow">
      <stop offset="0" stop-color="#ffd447" stop-opacity="0.55" />
      <stop offset="0.35" stop-color="#ffd447" stop-opacity="0.16" />
      <stop offset="1" stop-color="#ffd447" stop-opacity="0" />
    </radialGradient>
    <clipPath id="floor-clip"><rect width={S} height={S} rx="10" /></clipPath>
  </defs>
  <rect class="ground" width={S} height={S} rx="10" />
  <g clip-path="url(#floor-clip)">
    {#each [-1, -0.5, 0, 0.5, 1] as g (g)}
      <line class="grid" x1={px(g)} y1="0" x2={px(g)} y2={S} />
      <line class="grid" x1="0" y1={py(g)} x2={S} y2={py(g)} />
    {/each}

    <!-- the lamp and the light it throws -->
    <circle cx={px(drive.lamp.x)} cy={py(drive.lamp.y)} r={1.25 * scale} fill="url(#lamp-glow)" />
    <circle class="target" class:ring={parking} cx={px(drive.lamp.x)} cy={py(drive.lamp.y)} r={(parking ? RING : REACH) * scale} />
    <circle class="lamp" cx={px(drive.lamp.x)} cy={py(drive.lamp.y)} r={(LAMP - 0.02) * scale} />

    <!-- where each trip starts -->
    {#each drive.starts as start, k (k)}
      <g transform={place(start)} class="start">
        <path d="M-9,-7 L4,0 L-9,7" />
      </g>
    {/each}

    {#each routes as r (r.k)}
      <polyline class="planned" class:met={r.met} points={r.planned} />
      {#if moved}
        <polyline class="driven" points={r.driven} />
      {/if}
      <!-- how the planned trip ends -->
      {#if r.rolling}
        <g transform={place(r.end)} class="miss rolling">
          <path d="M-5,-6 L5,0 L-5,6" />
        </g>
      {:else if !r.met}
        <g transform="translate({px(r.end.x)},{py(r.end.y)})" class="miss">
          <path d="M-4,-4 L4,4 M-4,4 L4,-4" />
        </g>
      {/if}
    {/each}

    {#each routes as r (r.k)}
      {@const f = r.frame}
      <g transform="{place(f.pose)} scale(1.3)" class="cart">
        <!-- what each eye can see: a faint wedge, brighter the more light it catches -->
        {#each [1, -1] as side, e (side)}
          <path
            class="sight"
            d="M0,0 L{Math.cos(EYE_ANGLE * side - 0.5) * 34},{-Math.sin(EYE_ANGLE * side - 0.5) * 34} A34,34 0 0 0 {Math.cos(EYE_ANGLE * side + 0.5) * 34},{-Math.sin(EYE_ANGLE * side + 0.5) * 34} Z"
            opacity={0.05 + 0.4 * f.eyes[e]}
          />
        {/each}
        <!-- wheels, with a streak behind each one showing how fast it's turning -->
        {#each [-1, 1] as offset, w (offset)}
          <line class="streak" x1="-3" y1={offset * 10} x2={-3 - streak(f.wheels[w])} y2={offset * 10} />
          <rect class="wheel" x="-7" y={offset * 10 - 2.5} width="14" height="5" rx="2" />
        {/each}
        <rect class="body" x="-9" y="-7.5" width="19" height="15" rx="5" />
        {#each [-1, 1] as offset, e (offset)}
          <circle class="eye" cx="7.5" cy={offset * 4.2} r="2.6" />
          <circle class="eye-light" cx="7.5" cy={offset * 4.2} r="2.6" opacity={Math.min(1, 0.1 + f.eyes[e] * 1.4)} />
        {/each}
      </g>
    {/each}
  </g>
</svg>

<style>
  .floor {
    width: 100%;
    height: auto;
    display: block;
  }

  .ground {
    fill: var(--board-deep);
  }

  .grid {
    stroke: color-mix(in srgb, var(--chalk) 6%, transparent);
    stroke-width: 1;
  }

  .lamp {
    fill: var(--sun);
    filter: drop-shadow(0 0 8px var(--sun));
  }

  .target {
    fill: none;
    stroke: color-mix(in srgb, var(--sun) 55%, transparent);
    stroke-width: 1.5;
  }

  .target.ring {
    stroke: var(--sun);
    stroke-dasharray: 3 5;
    stroke-linecap: round;
  }

  .start path {
    fill: none;
    stroke: var(--dust);
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.7;
  }

  /* Blue is guidance everywhere in this game: here it's the path the cart is going to take. */
  .planned {
    fill: none;
    stroke: var(--sky);
    stroke-width: 2;
    stroke-dasharray: 2 6;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.85;
  }

  .planned.met {
    filter: drop-shadow(0 0 4px var(--sky));
  }

  .driven {
    fill: none;
    stroke: var(--chalk);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--chalk) 70%, transparent));
  }

  .miss path {
    stroke: var(--rose);
    stroke-width: 2.5;
    stroke-linecap: round;
  }

  .miss.rolling path {
    fill: none;
    stroke-linejoin: round;
  }

  .sight {
    fill: var(--sun);
  }

  .wheel {
    fill: var(--dust);
  }

  .streak {
    stroke: var(--sky);
    stroke-width: 3;
    stroke-linecap: round;
    opacity: 0.8;
  }

  .body {
    fill: var(--board-lift);
    stroke: var(--chalk);
    stroke-width: 1.75;
  }

  .eye {
    fill: var(--board-deep);
    stroke: var(--chalk);
    stroke-width: 1;
  }

  .eye-light {
    fill: var(--sun);
    filter: drop-shadow(0 0 3px var(--sun));
  }
</style>
