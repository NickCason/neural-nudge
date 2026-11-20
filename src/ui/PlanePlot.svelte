<script lang="ts">
  import { predict, trace } from '../engine/net';
  import { DIAL_LIMIT, game } from '../game.svelte';
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

  // ---- the hidden neurons' own lines ---------------------------------------------------------

  type Point = [number, number];

  interface HiddenLine {
    j: number;
    /** Unit vector toward the neuron's yes side. */
    n: Point;
    /** Unit vector along the line. */
    d: Point;
    /** The stretch of the line that's inside the picture, if any. */
    ends: [Point, Point] | null;
    /** Where the slide handle sits. */
    pivot: Point;
    /** Where the swing handle sits, and which way along the line it is from the pivot. */
    swing: Point;
    swingSign: number;
    ticks: [Point, Point][];
    movable: boolean;
  }

  const showLines = $derived(!!game.level.show?.lines && game.spec.layers.length > 1);
  const EDGE = R - 0.08;
  const inView = (p: Point) => Math.abs(p[0]) <= EDGE && Math.abs(p[1]) <= EDGE;

  /** How far along each line its slide handle sits, measured from the point nearest the middle. */
  let slide: number[] = [];

  const lines = $derived.by((): HiddenLine[] => {
    if (!showLines) return [];
    const width = game.spec.inputs + 1;
    const out: HiddenLine[] = [];
    for (let j = 0; j < game.spec.layers[0].size; j++) {
      const w1 = params[j * width];
      const w2 = params[j * width + 1];
      const b = params[j * width + 2];
      const size = Math.hypot(w1, w2);
      if (size < 1e-6) continue;
      const n: Point = [w1 / size, w2 / size];
      const d: Point = [-n[1], n[0]];
      const foot: Point = [(-b * w1) / (size * size), (-b * w2) / (size * size)];
      // clip the line to the picture
      let lo = -Infinity;
      let hi = Infinity;
      for (const k of [0, 1]) {
        if (Math.abs(d[k]) < 1e-9) {
          if (Math.abs(foot[k]) > R) lo = Infinity;
          continue;
        }
        const a = (-R - foot[k]) / d[k];
        const c = (R - foot[k]) / d[k];
        lo = Math.max(lo, Math.min(a, c));
        hi = Math.min(hi, Math.max(a, c));
      }
      const visible = lo < hi;
      const at = (t: number): Point => [foot[0] + d[0] * t, foot[1] + d[1] * t];
      let pivot: Point;
      if (visible) {
        const margin = Math.min(0.12, (hi - lo) / 2);
        pivot = at(Math.max(lo + margin, Math.min(hi - margin, slide[j] ?? 0)));
      } else {
        // the line is off the picture: leave its handle at the nearest edge so it can be pulled back
        pivot = [Math.max(-EDGE, Math.min(EDGE, foot[0])), Math.max(-EDGE, Math.min(EDGE, foot[1]))];
      }
      const reach = 0.42;
      const ahead: Point = [pivot[0] + d[0] * reach, pivot[1] + d[1] * reach];
      const behind: Point = [pivot[0] - d[0] * reach, pivot[1] - d[1] * reach];
      const swingSign = !inView(ahead) && inView(behind) ? -1 : 1;
      const ticks: [Point, Point][] = [];
      if (visible) {
        for (let t = Math.ceil(lo / 0.22) * 0.22; t < hi; t += 0.22) {
          const p = at(t);
          ticks.push([p, [p[0] + n[0] * 0.055, p[1] + n[1] * 0.055]]);
        }
      }
      out.push({
        j,
        n,
        d,
        ends: visible ? [at(lo), at(hi)] : null,
        pivot,
        swing: swingSign > 0 ? ahead : behind,
        swingSign,
        ticks,
        movable: game.tools.lines && !game.fixed.includes(j * width),
      });
    }
    return out;
  });

  let svg: SVGSVGElement;
  let grab: { j: number; kind: 'slide' | 'swing'; pivot: Point; sign: number } | null = $state(null);

  function pointer(e: PointerEvent): Point {
    const box = svg.getBoundingClientRect();
    return [((e.clientX - box.left) / box.width) * 2 * R - R, R - ((e.clientY - box.top) / box.height) * 2 * R];
  }

  /** Put hidden neuron j's line through `through`, facing `n`, keeping how sharply it switches. */
  function setLine(j: number, n: Point, through: Point) {
    const width = game.spec.inputs + 1;
    const size = Math.hypot(game.params[j * width], game.params[j * width + 1]) || 1;
    let w1 = n[0] * size;
    let w2 = n[1] * size;
    let b = -(w1 * through[0] + w2 * through[1]);
    // If a dial would run off its scale, soften all three together: same line, gentler switch.
    const over = Math.max(Math.abs(w1), Math.abs(w2), Math.abs(b)) / DIAL_LIMIT;
    if (over > 1) {
      w1 /= over;
      w2 /= over;
      b /= over;
    }
    const round = (v: number) => Math.round(v * 100) / 100;
    game.setParams([
      [j * width, round(w1)],
      [j * width + 1, round(w2)],
      [j * width + 2, round(b)],
    ]);
    // keep the slide handle where the hand is
    const s2 = w1 * w1 + w2 * w2 || 1;
    const foot: Point = [(-b * w1) / s2, (-b * w2) / s2];
    slide[j] = (through[0] - foot[0]) * -n[1] + (through[1] - foot[1]) * n[0];
  }

  function grabLine(e: PointerEvent, line: HiddenLine, kind: 'slide' | 'swing') {
    if (!line.movable) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    grab = { j: line.j, kind, pivot: line.pivot, sign: line.swingSign };
    game.hover = line.j;
    e.preventDefault();
    e.stopPropagation();
  }

  function dragLine(e: PointerEvent) {
    if (!grab) return;
    const p = pointer(e);
    const line = lines.find((l) => l.j === grab!.j);
    if (!line) return;
    if (grab.kind === 'slide') {
      setLine(grab.j, line.n, [Math.max(-R, Math.min(R, p[0])), Math.max(-R, Math.min(R, p[1]))]);
      return;
    }
    const dx = (p[0] - grab.pivot[0]) * grab.sign;
    const dy = (p[1] - grab.pivot[1]) * grab.sign;
    const length = Math.hypot(dx, dy);
    if (length < 0.06) return;
    // the yes side stays on the same hand of the line as it turns
    setLine(grab.j, [dy / length, -dx / length], grab.pivot);
  }

  function release() {
    if (grab) game.hover = null;
    grab = null;
  }

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
  <svg
    bind:this={svg}
    viewBox="0 0 {S} {S}"
    role="img"
    aria-label="The dots, coloured by kind, over the network's answer"
    onpointermove={dragLine}
    onpointerup={release}
    onpointercancel={release}
  >
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
    <!-- each hidden neuron's own line, numbered to match its circle in the network -->
    {#each lines as line (line.j)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <g
        class="hidden-line"
        class:lit={game.hover === line.j}
        class:movable={line.movable}
        onpointerenter={() => (game.hover = line.j)}
        onpointerleave={() => {
          if (!grab) game.hover = null;
        }}
      >
        {#if line.ends}
          <line class="reach" x1={px(line.ends[0][0])} y1={py(line.ends[0][1])} x2={px(line.ends[1][0])} y2={py(line.ends[1][1])} />
          <line class="stroke" x1={px(line.ends[0][0])} y1={py(line.ends[0][1])} x2={px(line.ends[1][0])} y2={py(line.ends[1][1])} />
          {#each line.ticks as tick, i (i)}
            <line class="tick-mark" x1={px(tick[0][0])} y1={py(tick[0][1])} x2={px(tick[1][0])} y2={py(tick[1][1])} />
          {/each}
        {/if}
        {#if line.movable && line.ends}
          <circle
            class="swing"
            cx={px(line.swing[0])}
            cy={py(line.swing[1])}
            r="6"
            onpointerdown={(e) => grabLine(e, line, 'swing')}
          />
        {/if}
        <g class="slide" transform="translate({px(line.pivot[0])},{py(line.pivot[1])})" onpointerdown={(e) => grabLine(e, line, 'slide')}>
          <circle class="grip" r="16" />
          <circle class="badge" r="9.5" />
          <text class="num badge-text" dy="0.35em">{line.j + 1}</text>
        </g>
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
    user-select: none;
    -webkit-user-select: none;
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
    pointer-events: none;
  }

  .hidden-line .stroke {
    stroke: var(--sky);
    stroke-width: 1.75;
    stroke-linecap: round;
    pointer-events: none;
  }

  /* a wide invisible stroke, so pointing near a line is enough to light it up */
  .hidden-line .reach {
    stroke: transparent;
    stroke-width: 14;
  }

  .hidden-line .tick-mark {
    stroke: var(--sky);
    stroke-width: 1.5;
    stroke-linecap: round;
    opacity: 0.8;
    pointer-events: none;
  }

  .hidden-line.lit .stroke {
    stroke-width: 3;
    filter: drop-shadow(0 0 6px var(--sky));
  }

  .hidden-line .grip {
    fill: transparent;
  }

  .hidden-line .badge {
    fill: var(--sky);
    stroke: var(--board-deep);
    stroke-width: 1.5;
  }

  .hidden-line.lit .badge {
    filter: drop-shadow(0 0 6px var(--sky));
  }

  .badge-text {
    fill: var(--board-deep);
    font-size: 11.5px;
    font-weight: 700;
    text-anchor: middle;
    pointer-events: none;
  }

  .hidden-line .swing {
    fill: var(--board-deep);
    stroke: var(--sky);
    stroke-width: 2.5;
  }

  .hidden-line.movable .slide {
    cursor: grab;
    touch-action: none;
  }

  .hidden-line.movable .swing {
    cursor: crosshair;
    touch-action: none;
  }
</style>
