<script lang="ts">
  import { trace } from '../engine/net';
  import { game } from '../game.svelte';
  import { num } from './format';

  // The two hidden lines cut the dots into groups: one group per combination of answers.
  // The output neuron never sees more than this, so its whole job fits in a small table.

  interface Group {
    key: string;
    /** Yellow dots or pink ones: a row only ever holds one kind. */
    yellow: boolean;
    count: number;
    members: number[];
    /** What each hidden neuron says about these dots on average, from -1 for no to +1 for yes. */
    says: [number, number];
    /** What each wire and the bias add to the output neuron's total, on average. */
    parts: [number, number, number];
    total: number;
    wrong: number;
    /** Another row, of the other kind, is getting the same yes and no from both neurons. */
    twin: boolean;
  }

  const params = $derived([...game.params]);
  /** The output neuron's three dials: weight from neuron 1, weight from neuron 2, bias. */
  const out = $derived(params.slice(game.spec.layers[0].size * (game.spec.inputs + 1)));

  const groups = $derived.by((): Group[] => {
    const found = new Map<string, { pattern: number; yellow: boolean; members: number[]; h: [number, number]; wrong: number }>();
    game.level.data.forEach((sample, i) => {
      const t = trace(game.spec, params, sample.x);
      const h = t.a[1];
      const pattern = (h[0] > 0 ? 1 : 0) + (h[1] > 0 ? 2 : 0);
      const yellow = sample.y[0] > 0.5;
      const key = `${pattern}${yellow ? 'y' : 'p'}`;
      let g = found.get(key);
      if (!g) found.set(key, (g = { pattern, yellow, members: [], h: [0, 0], wrong: 0 }));
      g.members.push(i);
      g.h[0] += h[0];
      g.h[1] += h[1];
      if (t.a[2][0] > 0.5 !== yellow) g.wrong++;
    });
    const rows = [...found.entries()].sort((a, b) => a[1].pattern - b[1].pattern || Number(b[1].yellow) - Number(a[1].yellow));
    return rows.map(([key, g]) => {
      const n = g.members.length;
      const says: [number, number] = [g.h[0] / n, g.h[1] / n];
      const parts: [number, number, number] = [out[0] * says[0], out[1] * says[1], out[2]];
      return {
        key,
        yellow: g.yellow,
        count: n,
        members: g.members,
        says,
        parts,
        total: parts[0] + parts[1] + parts[2],
        wrong: g.wrong,
        twin: rows.some(([, other]) => other.pattern === g.pattern && other.yellow !== g.yellow),
      };
    });
  });

  const signed = (v: number) => (v >= 0 ? '+' : '') + num(v);
</script>

<section class="tally">
  <h2>What the output neuron is told</h2>
  <table>
    <thead>
      <tr>
        <th scope="col">Dots</th>
        <th scope="col">1 says</th>
        <th scope="col">2 says</th>
        <th scope="col" class="sum">Adds up to</th>
        <th scope="col">So</th>
      </tr>
    </thead>
    <tbody>
      {#each groups as g (g.key)}
        <tr
          class:lit={game.probe !== null && g.members.includes(game.probe)}
          onpointerenter={() => (game.spotlight = g.members)}
          onpointerleave={() => (game.spotlight = null)}
        >
          <td class="dots">
            <svg viewBox="0 0 12 12" aria-hidden="true">
              {#if g.yellow}
                <circle class="yes-dot" cx="6" cy="6" r="4.4" />
              {:else}
                <rect class="no-dot" x="2" y="2" width="8" height="8" rx="1.2" />
              {/if}
            </svg>
            <span class="num">{g.count}</span>
            <span class="sr">{g.yellow ? 'yellow' : 'pink'}</span>
          </td>
          <!-- each answer is a strength, not only a side: +0.3 and +0.9 are both yes, and not the same -->
          <td><span class="chip num" class:yes={g.says[0] > 0}>{signed(g.says[0])}</span></td>
          <td><span class="chip num" class:yes={g.says[1] > 0}>{signed(g.says[1])}</span></td>
          <td class="num sum">
            <span class:pos={g.parts[0] > 0} class:neg={g.parts[0] < 0}>{signed(g.parts[0])}</span>
            <span class:pos={g.parts[1] > 0} class:neg={g.parts[1] < 0}>{signed(g.parts[1])}</span>
            <span class:pos={g.parts[2] > 0} class:neg={g.parts[2] < 0}>{signed(g.parts[2])}</span>
            <span class="total">= {signed(g.total)}</span>
          </td>
          <td class="verdict">
            <span class="chip" class:yes={g.total > 0}>{g.total > 0 ? 'yes' : 'no'}</span>
            {#if g.wrong === 0}
              <span class="right" title="right">✓</span><span class="sr">right</span>
            {:else}
              <span class="trouble">wrong</span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="note">
    Each answer runs from −1 for no to +1 for yes. The three numbers are what neuron 1, neuron 2 and the bias add to
    the total; above zero means yes.
    {#if groups.some((g) => g.twin)}
      Some yellow and pink rows are getting the same yes and no, so only the strengths tell them apart.
    {/if}
  </p>
</section>

<style>
  .tally {
    display: grid;
    gap: 0.5rem;
    overflow-x: auto;
  }

  h2 {
    font-size: var(--step-0);
    font-weight: 600;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: clamp(0.72rem, 0.95vw, var(--step--1));
  }

  th {
    padding: 0.25rem 0.3rem 0.35rem 0;
    color: var(--dust);
    font-weight: 400;
    text-align: left;
    white-space: nowrap;
    border-bottom: 1.5px solid var(--rule);
  }

  td {
    padding: 0.5rem 0.3rem 0.5rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--rule) 60%, transparent);
    white-space: nowrap;
    vertical-align: middle;
  }

  tr.lit td,
  tbody tr:hover td {
    background: color-mix(in srgb, var(--sky) 9%, transparent);
  }

  .dots svg {
    display: inline-block;
    width: 12px;
    height: 12px;
    vertical-align: -1px;
    margin-right: 0.2rem;
  }

  .yes-dot {
    fill: var(--sun);
  }

  .no-dot {
    fill: var(--rose);
  }

  .chip {
    display: inline-block;
    min-width: 2.2rem;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    text-align: center;
    font-weight: 600;
    color: var(--board-deep);
    background: var(--rose);
  }

  .chip.yes {
    background: var(--sun);
  }

  .sum span {
    display: inline-block;
    min-width: 2.45rem;
    color: var(--dust);
  }

  .sum .pos {
    color: var(--sun);
  }

  .sum .neg {
    color: var(--rose);
  }

  .sum .total {
    min-width: 0;
    margin-left: 0.15rem;
    color: var(--chalk);
    font-weight: 700;
  }

  th:last-child,
  td:last-child {
    padding-right: 0;
  }

  .verdict .right {
    margin-left: 0.25rem;
    color: var(--sun);
  }

  .verdict .trouble {
    margin-left: 0.4rem;
    color: var(--chalk);
    font-weight: 600;
    text-decoration: underline wavy var(--rose);
    text-underline-offset: 3px;
  }

  .note {
    color: var(--dust);
    font-size: var(--step--1);
    max-width: 60ch;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
