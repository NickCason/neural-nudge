<script lang="ts">
  import { onMount } from 'svelte';
  import { trace } from '../engine/net';
  import type { ParamInfo } from '../engine/net';
  import { DIAL_LIMIT, game } from '../game.svelte';
  import { answerInk, num, splitSubs } from './format';
  import { inputName, neuronName, paramLabel, paramTitle } from './names';
  import { paint } from './netPaint';
  import type { NeuronPaint, WirePaint } from './netPaint';
  import Subs from './Subs.svelte';

  const W = 560;

  /** Screen readers get "x1", not a subscript glyph. */
  const plain = (text: string) => splitSubs(text).map((r) => r.text).join('');

  interface Node {
    x: number;
    y: number;
    /** 0 for inputs, then one column per layer. */
    column: number;
    row: number;
  }

  interface DialPlace {
    info: ParamInfo;
    x: number;
    y: number;
    /** Wire endpoints: centre of the source, centre of the target. */
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  const visible = $derived(game.layout.filter((p) => !game.frozen.includes(p.index)));
  // Three sizes of drawing: big dials with names for a few, readable dials for up to nine,
  // and plain dots when there are too many to label. A level that grows stays at the smallest
  // size throughout, so nothing jumps when a neuron is added.
  const scale = $derived<'full' | 'medium' | 'small'>(
    game.level.grow ? 'small' : visible.length <= 4 ? 'full' : visible.length <= 9 ? 'medium' : 'small',
  );
  const compact = $derived(scale !== 'full');
  const medium = $derived(scale === 'medium');
  const tallest = $derived(Math.max(game.spec.inputs, ...game.spec.layers.map((l) => l.size)));
  const H = $derived(scale === 'small' ? 430 : medium ? 340 : tallest > 1 ? 370 : 270);
  const nodeR = $derived(scale === 'small' ? 24 : medium ? 30 : 34);
  const inputR = $derived(scale === 'small' ? 17 : medium ? 22 : 26);
  const dialR = $derived(scale === 'small' ? 10 : medium ? 16 : 24);
  const outLength = 50;

  const columns = $derived.by(() => {
    const sizes = [game.spec.inputs, ...game.spec.layers.map((l) => l.size)];
    const left = 62;
    const right = W - 132;
    return sizes.map((size, column) => {
      const x = sizes.length === 1 ? left : left + ((right - left) * column) / (sizes.length - 1);
      const gap = size > 1 ? Math.min(compact ? 200 : 170, (H - 130) / (size - 1)) : 0;
      const top = H / 2 - (gap * (size - 1)) / 2 - (scale === 'small' ? 10 : medium ? 18 : 28);
      return Array.from({ length: size }, (_, row): Node => ({ x, y: top + gap * row, column, row }));
    });
  });

  const dials = $derived.by(() =>
    visible.map((info): DialPlace => {
      const target = columns[info.layer + 1][info.neuron];
      if (info.kind === 'bias') {
        const drop = scale === 'small' ? nodeR + 15 : medium ? nodeR + 25 : nodeR + 46;
        return { info, x: target.x, y: target.y + drop, x1: target.x, y1: target.y, x2: target.x, y2: target.y + drop };
      }
      const source = columns[info.layer][info.from];
      const fanOut = columns[info.layer + 1].length;
      const t = compact && fanOut > 1 ? 0.3 + 0.13 * info.from : 0.5;
      return {
        info,
        x: source.x + (target.x - source.x) * t,
        y: source.y + (target.y - source.y) * t,
        x1: source.x,
        y1: source.y,
        x2: target.x,
        y2: target.y,
      };
    }),
  );

  /** Every value inside the network for the sample being inspected. */
  const probed = $derived.by(() => {
    if (game.probe === null) return null;
    const sample = game.level.data[game.probe];
    if (!sample) return null;
    return { sample, trace: trace(game.spec, game.params, sample.x) };
  });

  const output = $derived(columns[columns.length - 1][0]);

  function signColor(v: number): string {
    if (Math.abs(v) < 0.005) return 'var(--dust)';
    return v > 0 ? 'var(--sun)' : 'var(--rose)';
  }

  /** Length of the slope arrow, or 0 where the ground is flat. Positive points up (turn the dial up). */
  function arrow(index: number): number {
    if (game.fixed.includes(index)) return 0;
    const g = game.evaluation.grad[index];
    if (!Number.isFinite(g) || Math.abs(g) < 0.004) return 0;
    const size = Math.min(1, Math.sqrt(Math.abs(g) / 2));
    const length = scale === 'small' ? 5 + 9 * size : medium ? 6 + 14 * size : 9 + 30 * size;
    return g < 0 ? length : -length;
  }

  /** How far round its ring a dial's arc reaches. */
  const sweep = (v: number) => Math.min(1, Math.abs(v) / DIAL_LIMIT) * 2 * Math.PI * (dialR - 0.5);

  // ---- turning dials -------------------------------------------------------------------------

  let drag: { index: number; y: number; value: number } | null = null;

  function down(e: PointerEvent, index: number) {
    game.selected = index;
    if (game.tools.nudge) return;
    if (!game.tools.drag || game.fixed.includes(index)) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { index, y: e.clientY, value: game.params[index] };
    e.preventDefault();
  }

  function move(e: PointerEvent) {
    if (!drag) return;
    const sensitivity = e.shiftKey ? 0.003 : 0.012;
    game.setParam(drag.index, drag.value + (drag.y - e.clientY) * sensitivity);
  }

  function up() {
    drag = null;
  }

  function key(e: KeyboardEvent, index: number) {
    if (game.tools.nudge && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      game.selected = index;
      game.nudge(index);
      return;
    }
    const small = e.shiftKey ? 0.01 : 0.05;
    const delta =
      e.key === 'ArrowUp' || e.key === 'ArrowRight'
        ? small
        : e.key === 'ArrowDown' || e.key === 'ArrowLeft'
          ? -small
          : e.key === 'PageUp'
            ? 0.25
            : e.key === 'PageDown'
              ? -0.25
              : 0;
    if (!delta) return;
    e.preventDefault();
    game.selected = index;
    game.setParam(index, Math.round((game.params[index] + delta) * 100) / 100);
  }

  function click(index: number) {
    if (game.tools.nudge) game.nudge(index);
  }

  const canFocus = $derived(game.level.view === 'plane' && game.spec.layers.length > 1);
  /** Hidden neurons get numbers when their lines are drawn on the plot, so the two can be matched up. */
  const numbered = $derived(!!game.level.show?.lines && game.spec.layers.length > 1);

  function focusNeuron(layer: number, neuron: number) {
    if (!canFocus) return;
    game.focus = layer === game.spec.layers.length - 1 ? null : { layer, neuron };
  }

  function isFocused(layer: number, neuron: number): boolean {
    if (!canFocus) return false;
    if (game.focus === null) return layer === game.spec.layers.length - 1;
    return game.focus.layer === layer && game.focus.neuron === neuron;
  }

  // ---- the luminous layer --------------------------------------------------------------------

  let canvas: HTMLCanvasElement;
  let stage: HTMLDivElement;

  /** Wires stop at the rim of what they connect, not its centre. */
  function trim(d: DialPlace): [number, number, number, number] {
    if (d.info.kind === 'bias') return [d.x1, d.y1 + nodeR, d.x2, d.y2 - dialR];
    const length = Math.hypot(d.x2 - d.x1, d.y2 - d.y1) || 1;
    const ux = (d.x2 - d.x1) / length;
    const uy = (d.y2 - d.y1) / length;
    const from = d.info.layer === 0 ? inputR : nodeR;
    return [d.x1 + ux * from, d.y1 + uy * from, d.x2 - ux * nodeR, d.y2 - uy * nodeR];
  }

  const wires = $derived.by((): WirePaint[] => {
    const grad = game.evaluation.grad;
    const peak = Math.max(1e-9, ...visible.map((p) => Math.abs(grad[p.index]) || 0));
    return dials.map((d) => {
      const [x1, y1, x2, y2] = trim(d);
      const value = game.params[d.info.index];
      return {
        x1,
        y1,
        x2,
        y2,
        value,
        kind: d.info.kind,
        blame: Math.min(1, Math.abs(grad[d.info.index] || 0) / peak),
        carried: probed && d.info.kind === 'weight' ? value * probed.trace.a[d.info.layer][d.info.from] : null,
        seed: (d.info.index * 0.618) % 1,
      };
    });
  });

  const THUMB = 26;
  const CURVE = 21;

  /** A live picture, per neuron, of the answer it gives across all inputs. */
  const pictures = $derived.by(() => {
    const spec = game.spec;
    const params = [...game.params];
    const flat = spec.layers.flatMap((layer, l) => Array.from({ length: layer.size }, (_, j) => ({ l, j, act: layer.act })));
    if (spec.inputs === 2) {
      const images = flat.map(() => new ImageData(THUMB, THUMB));
      for (let r = 0; r < THUMB; r++) {
        for (let c = 0; c < THUMB; c++) {
          const t = trace(spec, params, [-1.1 + (2.2 * c) / (THUMB - 1), 1.1 - (2.2 * r) / (THUMB - 1)]);
          flat.forEach((n, k) => {
            const a = t.a[n.l + 1][n.j];
            const s = n.act === 'sigmoid' ? (a - 0.5) * 2 : Math.max(-1, Math.min(1, a));
            const ink = answerInk(s, 0.85);
            const i = (r * THUMB + c) * 4;
            images[k].data[i] = ink[0];
            images[k].data[i + 1] = ink[1];
            images[k].data[i + 2] = ink[2];
            images[k].data[i + 3] = 255;
          });
        }
      }
      return { images, curves: null };
    }
    const curves = flat.map(() => new Array<number>(CURVE));
    for (let i = 0; i < CURVE; i++) {
      const t = trace(spec, params, [-1.6 + (3.2 * i) / (CURVE - 1)]);
      flat.forEach((n, k) => (curves[k][i] = t.a[n.l + 1][n.j] / 1.6));
    }
    return { images: null, curves };
  });

  let thumbs: HTMLCanvasElement[] = [];

  $effect(() => {
    const images = pictures.images;
    if (!images) {
      thumbs = [];
      return;
    }
    thumbs = images.map((image, k) => {
      const c = thumbs[k] ?? document.createElement('canvas');
      c.width = THUMB;
      c.height = THUMB;
      c.getContext('2d')!.putImageData(image, 0, 0);
      return c;
    });
  });

  const neurons = $derived.by((): NeuronPaint[] => {
    let k = 0;
    return game.spec.layers.flatMap((layer, l) =>
      columns[l + 1].map((node) => {
        const index = k++;
        let value: number | null = null;
        if (probed) {
          const a = probed.trace.a[l + 1][node.row];
          value = layer.act === 'sigmoid' ? (a - 0.5) * 2 : Math.max(-1, Math.min(1, a));
        }
        return { x: node.x, y: node.y, r: nodeR, thumb: null, curve: pictures.curves?.[index] ?? null, value };
      }),
    );
  });

  // Training shows as blue sparks running backward. It lingers briefly after a single step.
  let lastStep = -Infinity;
  let seenSteps = 0;
  $effect(() => {
    if (game.steps > seenSteps) lastStep = performance.now();
    seenSteps = game.steps;
  });

  onMount(() => {
    const ctx = canvas.getContext('2d')!;
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(stage.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(stage.clientHeight * dpr));
    };
    const watcher = new ResizeObserver(fit);
    watcher.observe(stage);
    fit();

    const tick = (now: number) => {
      const since = now - lastStep;
      const training = game.running ? 1 : Math.max(0, 1 - since / 900);
      paint(ctx, {
        scale: canvas.width / W,
        width: canvas.width,
        height: canvas.height,
        time: now / 1000,
        motion: !still.matches,
        compact,
        wires,
        inputs: columns[0].map((n) => ({ x: n.x, y: n.y, r: inputR })),
        neurons: neurons.map((n, k) => ({ ...n, thumb: thumbs[k] ?? null })),
        out: { x: output.x + nodeR, y: output.y, length: outLength },
        training,
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      watcher.disconnect();
    };
  });
</script>

<div class="stage" bind:this={stage} style:aspect-ratio="{W} / {H}">
  <canvas bind:this={canvas} aria-hidden="true"></canvas>

  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <svg
    class="net"
    class:compact={scale === 'small'}
    class:medium
    viewBox="0 0 {W} {H}"
    role="group"
    aria-label="The network"
    onclick={(e) => {
      if (e.target === e.currentTarget) game.selected = null;
    }}
  >
    <!-- the guess leaving the network -->
    {#if probed}
      {@const guess = probed.trace.a[probed.trace.a.length - 1][0]}
      <text class="label" x={output.x + nodeR + 8} y={output.y - 13}>
        guess <tspan class="num value">{num(guess)}</tspan>
      </text>
      <text class="label" x={output.x + nodeR + 8} y={output.y + 25}>
        wanted <tspan class="num value">{num(probed.sample.y[0])}</tspan>
      </text>
    {:else}
      <text class="label" x={output.x + nodeR + 8} y={output.y - 13}>guess</text>
    {/if}

    <!-- inputs -->
    {#each columns[0] as node (node.row)}
      <g transform="translate({node.x},{node.y})">
        <circle class="input" r={inputR} />
        {#if probed}
          <text class="num inside" class:small={compact} dy="0.35em">{num(probed.sample.x[node.row])}</text>
        {:else}
          <text class="inside hand" class:small={compact} dy="0.35em"><Subs svg text={inputName(game.spec, node.row)} /></text>
        {/if}
      </g>
    {/each}

    <!-- neurons: the picture is painted underneath; this is the number and the click target -->
    {#each game.spec.layers as _, l (l)}
      {#each columns[l + 1] as node (node.row)}
        {@const value = probed ? probed.trace.a[l + 1][node.row] : null}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <g
          transform="translate({node.x},{node.y})"
          class="neuron"
          class:clickable={canFocus}
          role={canFocus ? 'button' : undefined}
          tabindex={canFocus ? 0 : undefined}
          aria-label={canFocus ? `Show the answer of ${neuronName(game.spec, l, node.row)}` : undefined}
          aria-pressed={canFocus ? isFocused(l, node.row) : undefined}
          onclick={() => focusNeuron(l, node.row)}
          onpointerenter={() => {
            if (numbered && l === 0) game.hover = node.row;
          }}
          onpointerleave={() => {
            if (numbered && l === 0) game.hover = null;
          }}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              focusNeuron(l, node.row);
            }
          }}
        >
          <circle class="target" r={nodeR} />
          {#if isFocused(l, node.row)}
            <circle class="focus-ring" r={nodeR + 6} />
          {/if}
          {#if numbered && l === 0 && game.hover === node.row}
            <circle class="hover-ring" r={nodeR + 4} />
          {/if}
          {#if value !== null}
            <text class="num inside" class:small={compact} dy="0.35em">{num(value)}</text>
          {/if}
          {#if numbered && l === 0}
            <g transform="translate({-nodeR * 0.78},{-nodeR * 0.78})">
              <circle class="badge" r="9" />
              <text class="num badge-text" dy="0.35em">{node.row + 1}</text>
            </g>
          {/if}
        </g>
      {/each}
    {/each}

    <!-- what each wire delivers for the inspected sample -->
    {#if probed && !compact}
      {#each dials as d (d.info.index)}
        {#if d.info.kind === 'weight'}
          {@const carried = game.params[d.info.index] * probed.trace.a[d.info.layer][d.info.from]}
          <text class="num carried" x={d.x + (d.x2 - d.x) * 0.5} y={d.y + (d.y2 - d.y) * 0.5 - 12}>
            {num(carried)}
          </text>
        {/if}
      {/each}
    {/if}

    <!-- dials -->
    {#each dials as d (d.info.index)}
      {@const i = d.info.index}
      {@const v = game.params[i]}
      {@const a = game.tools.hints ? arrow(i) : 0}
      <g
        class="dial"
        class:selected={game.selected === i}
        class:draggable={game.tools.drag}
        class:nudgeable={game.tools.nudge}
        class:locked={game.fixed.includes(i)}
        transform="translate({d.x},{d.y})"
        role="slider"
        tabindex="0"
        aria-label={plain(paramTitle(game.spec, d.info))}
        aria-valuenow={Math.round(v * 100) / 100}
        aria-valuemin={-DIAL_LIMIT}
        aria-valuemax={DIAL_LIMIT}
        aria-readonly={!game.tools.drag || game.fixed.includes(i)}
        onpointerdown={(e) => down(e, i)}
        onpointermove={move}
        onpointerup={up}
        onpointercancel={up}
        onclick={() => click(i)}
        onkeydown={(e) => key(e, i)}
      >
        <circle class="hit" r={game.tools.nudge && !compact ? dialR + 14 : Math.max(dialR + 4, 18)} />
        {#if game.selected === i}
          <circle class="select-ring" r={dialR + 5.5} />
        {/if}
        <circle class="face" r={dialR} />
        {#if scale === 'small'}
          <circle class="rim" r={dialR} stroke={signColor(v)} />
          <circle r={2 + Math.min(Math.abs(v), 3) * 1.9} fill={signColor(v)} />
        {:else}
          <!-- the arc grows clockwise for positive values and anticlockwise for negative ones -->
          <circle
            class="arc"
            r={dialR - 0.5}
            stroke="currentColor"
            style:color={signColor(v)}
            stroke-dasharray="{sweep(v)} 1000"
            transform="rotate(-90) scale(1,{v < 0 ? -1 : 1})"
          />
          <text class="num reading" class:tight={medium} dy="0.35em">{num(v)}</text>
          {#if !medium}
            <text class="name hand" x={-dialR - 6} y={-dialR + 2} text-anchor="end"><Subs svg text={paramLabel(game.spec, d.info)} /></text>
          {/if}
        {/if}
        {#if a !== 0}
          {@const dir = a > 0 ? -1 : 1}
          {@const length = Math.abs(a)}
          {@const beside = d.info.kind === 'bias'}
          {@const x = beside ? dialR + (scale === 'small' ? 7 : medium ? 9 : 14) : 0}
          {@const from = beside ? (-dir * length) / 2 : dir * (dialR + 6)}
          {@const to = from + dir * length}
          {@const head = scale === 'small' ? 3.5 : medium ? 4.5 : 6}
          <g class="slope">
            <line x1={x} y1={from} x2={x} y2={to} />
            <path d="M{x - head},{to - dir * head} L{x},{to} L{x + head},{to - dir * head}" />
          </g>
        {/if}
      </g>
    {/each}
  </svg>
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
  }

  canvas,
  .net {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .net {
    user-select: none;
    -webkit-user-select: none;
  }

  .label {
    fill: var(--dust);
    font-size: 13px;
  }

  .label .value {
    fill: var(--chalk);
  }

  .input {
    fill: none;
    stroke: var(--dust);
    stroke-width: 1.5;
    stroke-dasharray: 3 4;
  }

  .inside {
    fill: var(--chalk);
    font-size: 15px;
    text-anchor: middle;
    pointer-events: none;
    paint-order: stroke;
    stroke: var(--board-deep);
    stroke-width: 3px;
    stroke-linejoin: round;
  }

  .inside.hand {
    font-size: 20px;
    stroke: none;
  }

  .inside.small {
    font-size: 11.5px;
  }

  .inside.hand.small {
    font-size: 14px;
  }

  .target {
    fill: transparent;
  }

  .neuron.clickable {
    cursor: pointer;
  }

  .neuron:focus {
    outline: none;
  }

  .neuron:focus-visible .target {
    stroke: var(--sky);
    stroke-width: 3;
  }

  .focus-ring {
    fill: none;
    stroke: var(--sky);
    stroke-width: 2;
    filter: drop-shadow(0 0 5px var(--sky));
  }

  .carried {
    fill: var(--chalk);
    font-size: 12.5px;
    text-anchor: middle;
    pointer-events: none;
    paint-order: stroke;
    stroke: var(--board-deep);
    stroke-width: 4px;
    stroke-linejoin: round;
  }

  .dial {
    touch-action: none;
  }

  .dial:focus {
    outline: none;
  }

  .dial.draggable {
    cursor: ns-resize;
  }

  .dial.nudgeable {
    cursor: pointer;
  }

  .hit {
    fill: transparent;
  }

  .face {
    fill: var(--board-deep);
    stroke: var(--rule);
    stroke-width: 3;
  }

  .compact .face {
    stroke: none;
  }

  .rim {
    fill: none;
    stroke-width: 1.5;
  }

  .arc {
    fill: none;
    stroke-width: 3.5;
    stroke-linecap: round;
    filter: drop-shadow(0 0 4px currentColor);
  }

  .dial:focus-visible .face {
    stroke: var(--sky);
  }

  .select-ring {
    fill: none;
    stroke: var(--chalk);
    stroke-width: 1.5;
    stroke-dasharray: 2 4;
    stroke-linecap: round;
  }

  .reading {
    fill: var(--chalk);
    font-size: 13.5px;
    text-anchor: middle;
    pointer-events: none;
  }

  .reading.tight {
    font-size: 9.5px;
  }

  .medium .face {
    stroke-width: 2.5;
  }

  .medium .arc {
    stroke-width: 2.5;
  }

  .medium .slope {
    stroke-width: 2;
  }

  /* A locked dial can be read but not turned. */
  .dial.locked {
    cursor: default;
  }

  .dial.locked .face {
    stroke-dasharray: 2 3;
  }

  .dial.locked .arc,
  .dial.locked .rim {
    opacity: 0.45;
    filter: none;
  }

  .dial.locked .reading {
    fill: var(--dust);
  }

  .badge {
    fill: var(--sky);
  }

  .badge-text {
    fill: var(--board-deep);
    font-size: 11px;
    font-weight: 700;
    text-anchor: middle;
    pointer-events: none;
  }

  .hover-ring {
    fill: none;
    stroke: var(--sky);
    stroke-width: 2.5;
    filter: drop-shadow(0 0 6px var(--sky));
  }

  .name {
    fill: var(--dust);
    font-size: 16px;
    pointer-events: none;
  }

  .slope {
    stroke: var(--sky);
    stroke-width: 2.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    pointer-events: none;
    filter: drop-shadow(0 0 4px var(--sky));
  }

  .compact .slope {
    stroke-width: 1.5;
  }

  .dial.nudgeable:hover .slope,
  .dial.nudgeable:focus-visible .slope {
    stroke: var(--chalk);
  }
</style>
