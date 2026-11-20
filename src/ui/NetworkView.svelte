<script lang="ts">
  import { trace } from '../engine/net';
  import type { ParamInfo } from '../engine/net';
  import { DIAL_LIMIT, game } from '../game.svelte';
  import { num, splitSubs } from './format';
  import { inputName, neuronName, paramLabel, paramTitle } from './names';
  import Subs from './Subs.svelte';

  const W = 520;

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
    /** Wire endpoints, for weights. */
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  const visible = $derived(game.layout.filter((p) => !game.frozen.includes(p.index)));
  const compact = $derived(visible.length > 4);
  const tallest = $derived(Math.max(game.spec.inputs, ...game.spec.layers.map((l) => l.size)));
  const H = $derived(compact ? 400 : tallest > 1 ? 340 : 250);
  const nodeR = $derived(compact ? 20 : 30);
  const dialR = $derived(compact ? 10 : 24);

  const columns = $derived.by(() => {
    const sizes = [game.spec.inputs, ...game.spec.layers.map((l) => l.size)];
    const left = 64;
    const right = W - 124;
    return sizes.map((size, column) => {
      const x = sizes.length === 1 ? left : left + ((right - left) * column) / (sizes.length - 1);
      const gap = size > 1 ? Math.min(compact ? 130 : 160, (H - 110) / (size - 1)) : 0;
      const top = H / 2 - (gap * (size - 1)) / 2 - (compact ? 8 : 26);
      return Array.from({ length: size }, (_, row): Node => ({ x, y: top + gap * row, column, row }));
    });
  });

  const dials = $derived.by(() =>
    visible.map((info): DialPlace => {
      const target = columns[info.layer + 1][info.neuron];
      if (info.kind === 'bias') {
        const drop = compact ? nodeR + 15 : nodeR + 46;
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

  function wireWidth(v: number): number {
    const m = Math.min(Math.abs(v), 3);
    return compact ? 1 + m * 1.3 : 1.5 + m * 2.2;
  }

  /** Length of the slope arrow, or 0 where the ground is flat. Positive points up (turn the dial up). */
  function arrow(index: number): number {
    const g = game.evaluation.grad[index];
    if (!Number.isFinite(g) || Math.abs(g) < 0.004) return 0;
    const size = Math.min(1, Math.sqrt(Math.abs(g) / 2));
    const length = compact ? 5 + 9 * size : 9 + 30 * size;
    return g < 0 ? length : -length;
  }

  let drag: { index: number; y: number; value: number } | null = null;

  function down(e: PointerEvent, index: number) {
    game.selected = index;
    if (game.tools.nudge) return;
    if (!game.tools.drag) return;
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

  function focusNeuron(layer: number, neuron: number) {
    if (!canFocus) return;
    game.focus = layer === game.spec.layers.length - 1 ? null : { layer, neuron };
  }

  function isFocused(layer: number, neuron: number): boolean {
    if (!canFocus) return false;
    if (game.focus === null) return layer === game.spec.layers.length - 1;
    return game.focus.layer === layer && game.focus.neuron === neuron;
  }

  function glyph(act: string): string {
    if (act === 'linear') return 'M-9,7 L9,-7';
    if (act === 'relu') return 'M-10,6 L0,6 L9,-6';
    return 'M-10,7 C-1,7 1,-7 10,-7';
  }

  function tint(v: number): string {
    const strength = Math.min(1, Math.abs(v)) * 0.55;
    return `color-mix(in srgb, ${v >= 0 ? 'var(--sun)' : 'var(--rose)'} ${Math.round(strength * 100)}%, var(--board-deep))`;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<svg
  class="net"
  class:compact
  viewBox="0 0 {W} {H}"
  role="group"
  aria-label="The network"
  onclick={(e) => {
    if (e.target === e.currentTarget) game.selected = null;
  }}
>
  <!-- wires -->
  {#each dials as d (d.info.index)}
    {@const v = game.params[d.info.index]}
    <line
      class="wire"
      class:stem={d.info.kind === 'bias'}
      x1={d.x1}
      y1={d.y1}
      x2={d.x2}
      y2={d.y2}
      stroke={signColor(v)}
      stroke-width={d.info.kind === 'bias' ? (compact ? 1.5 : 2) : wireWidth(v)}
      opacity={d.info.kind === 'bias' ? 0.8 : 0.35 + 0.65 * Math.min(1, Math.abs(v))}
    />
  {/each}

  <!-- the guess leaving the network -->
  <line class="out" x1={output.x + nodeR} y1={output.y} x2={output.x + nodeR + 46} y2={output.y} />
  <path
    class="out head"
    d="M{output.x + nodeR + 38},{output.y - 6} L{output.x + nodeR + 47},{output.y} L{output.x + nodeR + 38},{output.y + 6}"
  />
  {#if probed}
    {@const guess = probed.trace.a[probed.trace.a.length - 1][0]}
    <text class="label" x={output.x + nodeR + 6} y={output.y - 12}>
      guess <tspan class="num value">{num(guess)}</tspan>
    </text>
    <text class="label" x={output.x + nodeR + 6} y={output.y + 24}>
      wanted <tspan class="num value">{num(probed.sample.y[0])}</tspan>
    </text>
  {:else}
    <text class="label" x={output.x + nodeR + 6} y={output.y - 12}>guess</text>
  {/if}

  <!-- inputs -->
  {#each columns[0] as node (node.row)}
    <g transform="translate({node.x},{node.y})">
      <circle class="input" r={nodeR - 3} />
      {#if probed}
        <text class="num inside" class:small={compact} dy="0.35em">{num(probed.sample.x[node.row])}</text>
      {:else}
        <text class="inside hand" class:small={compact} dy="0.35em"><Subs svg text={inputName(game.spec, node.row)} /></text>
      {/if}
    </g>
  {/each}

  <!-- neurons -->
  {#each game.spec.layers as layer, l (l)}
    {#each columns[l + 1] as node (node.row)}
      {@const value = probed ? probed.trace.a[l + 1][node.row] : null}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <g
        transform="translate({node.x},{node.y})"
        class="neuron"
        class:clickable={canFocus}
        class:focused={isFocused(l, node.row)}
        role={canFocus ? 'button' : undefined}
        tabindex={canFocus ? 0 : undefined}
        aria-label={canFocus ? `Show the answer of ${neuronName(game.spec, l, node.row)}` : undefined}
        aria-pressed={canFocus ? isFocused(l, node.row) : undefined}
        onclick={() => focusNeuron(l, node.row)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            focusNeuron(l, node.row);
          }
        }}
      >
        {#if isFocused(l, node.row)}
          <circle class="focus-ring" r={nodeR + 5} />
        {/if}
        <circle class="body" r={nodeR} style:fill={value === null ? undefined : tint(value)} />
        {#if value !== null}
          <text class="num inside" class:small={compact} dy="0.35em">{num(value)}</text>
        {:else}
          <path class="glyph" d={glyph(layer.act)} transform={compact ? 'scale(0.78)' : undefined} />
        {/if}
      </g>
    {/each}
  {/each}

  <!-- what each wire delivers for the inspected sample -->
  {#if probed && !compact}
    {#each dials as d (d.info.index)}
      {#if d.info.kind === 'weight'}
        {@const carried = game.params[d.info.index] * probed.trace.a[d.info.layer][d.info.from]}
        <text class="num carried" x={d.x + (d.x2 - d.x) * 0.52} y={d.y + (d.y2 - d.y) * 0.52 - 9}>
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
      transform="translate({d.x},{d.y})"
      role="slider"
      tabindex="0"
      aria-label={plain(paramTitle(game.spec, d.info))}
      aria-valuenow={Math.round(v * 100) / 100}
      aria-valuemin={-DIAL_LIMIT}
      aria-valuemax={DIAL_LIMIT}
      aria-readonly={!game.tools.drag}
      onpointerdown={(e) => down(e, i)}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
      onclick={() => click(i)}
      onkeydown={(e) => key(e, i)}
    >
      <circle class="hit" r={game.tools.nudge && !compact ? dialR + 14 : Math.max(dialR + 4, 18)} />
      {#if game.selected === i}
        <circle class="select-ring" r={dialR + 4.5} />
      {/if}
      <circle class="face" r={dialR} stroke={signColor(v)} />
      {#if compact}
        <circle r={2 + Math.min(Math.abs(v), 3) * 1.8} fill={signColor(v)} />
      {:else}
        <text class="num reading" dy="0.35em">{num(v)}</text>
        <text class="name hand" x={-dialR - 6} y={-dialR + 2} text-anchor="end"><Subs svg text={paramLabel(game.spec, d.info)} /></text>
      {/if}
      {#if a !== 0}
        {@const dir = a > 0 ? -1 : 1}
        {@const length = Math.abs(a)}
        {@const beside = d.info.kind === 'bias'}
        {@const x = beside ? dialR + (compact ? 6 : 13) : 0}
        {@const from = beside ? (-dir * length) / 2 : dir * (dialR + 5)}
        {@const to = from + dir * length}
        {@const head = compact ? 3.5 : 6}
        <g class="slope">
          <line x1={x} y1={from} x2={x} y2={to} />
          <path d="M{x - head},{to - dir * head} L{x},{to} L{x + head},{to - dir * head}" />
        </g>
      {/if}
    </g>
  {/each}
</svg>

<style>
  .net {
    width: 100%;
    height: auto;
    max-height: 100%;
    display: block;
    user-select: none;
    -webkit-user-select: none;
  }

  .wire {
    stroke-linecap: round;
    pointer-events: none;
  }

  .out {
    stroke: var(--dust);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
  }

  .label {
    fill: var(--dust);
    font-size: 13px;
  }

  .label .value {
    fill: var(--chalk);
  }

  .input {
    fill: var(--board);
    stroke: var(--dust);
    stroke-width: 1.5;
    stroke-dasharray: 3 4;
  }

  .inside {
    fill: var(--chalk);
    font-size: 14px;
    text-anchor: middle;
    pointer-events: none;
  }

  .inside.hand {
    font-size: 19px;
  }

  .inside.small {
    font-size: 10px;
  }

  .inside.hand.small {
    font-size: 13px;
  }

  .neuron .body {
    fill: var(--board-deep);
    stroke: var(--chalk);
    stroke-width: 2;
  }

  .neuron.clickable {
    cursor: pointer;
  }

  .neuron:focus {
    outline: none;
  }

  .neuron:focus-visible .body {
    stroke: var(--sky);
    stroke-width: 3;
  }

  .focus-ring {
    fill: none;
    stroke: var(--sky);
    stroke-width: 2;
  }

  .glyph {
    fill: none;
    stroke: var(--dust);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    pointer-events: none;
  }

  .carried {
    fill: var(--dust);
    font-size: 12px;
    text-anchor: middle;
    pointer-events: none;
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
    stroke-width: 2.5;
  }

  .compact .face {
    stroke-width: 1.5;
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
  }

  .compact .slope {
    stroke-width: 1.5;
  }

  .dial.nudgeable:hover .slope,
  .dial.nudgeable:focus-visible .slope {
    stroke: var(--chalk);
  }
</style>
