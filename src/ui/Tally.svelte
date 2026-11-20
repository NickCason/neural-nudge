<script lang="ts">
  import { trace } from '../engine/net';
  import { game } from '../game.svelte';
  import { num } from './format';

  // The two hidden lines cut the dots into groups: one group per combination of answers.
  // The output neuron never sees more than this, so its whole job fits in a small table.

  interface Group {
    key: number;
    says: [boolean, boolean];
    yellow: number;
    pink: number;
    members: number[];
    /** What each wire and the bias add to the output neuron's total, on average over the group. */
    parts: [number, number, number];
    total: number;
    wrong: number;
  }

  const params = $derived([...game.params]);
  /** The output neuron's three dials: weight from neuron 1, weight from neuron 2, bias. */
  const out = $derived(params.slice(game.spec.layers[0].size * (game.spec.inputs + 1)));

  const groups = $derived.by((): Group[] => {
    const found = new Map<number, Group & { h: [number, number] }>();
    game.level.data.forEach((sample, i) => {
      const t = trace(game.spec, params, sample.x);
      const h = t.a[1];
      const guess = t.a[2][0];
      const key = (h[0] > 0 ? 1 : 0) + (h[1] > 0 ? 2 : 0);
      let g = found.get(key);
      if (!g) {
        g = { key, says: [h[0] > 0, h[1] > 0], yellow: 0, pink: 0, members: [], parts: [0, 0, 0], total: 0, wrong: 0, h: [0, 0] };
        found.set(key, g);
      }
      if (sample.y[0] > 0.5) g.yellow++;
      else g.pink++;
      g.members.push(i);
      g.h[0] += h[0];
      g.h[1] += h[1];
      if (guess > 0.5 !== sample.y[0] > 0.5) g.wrong++;
    });
    return [...found.values()]
      .sort((a, b) => a.key - b.key)
      .map((g) => {
        const n = g.members.length;
        const parts: [number, number, number] = [(out[0] * g.h[0]) / n, (out[1] * g.h[1]) / n, out[2]];
        return { ...g, parts, total: parts[0] + parts[1] + parts[2] };
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
        <th scope="col" class="sum">From 1, from 2, bias</th>
        <th scope="col">Total</th>
        <th scope="col">So it says</th>
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
            <svg viewBox="0 0 {Math.max(1, g.yellow + g.pink) * 9} 12" style:width="{(g.yellow + g.pink) * 9}px" aria-hidden="true">
              {#each { length: g.yellow } as _, i (i)}
                <circle class="yes-dot" cx={i * 9 + 4.5} cy="6" r="3.6" />
              {/each}
              {#each { length: g.pink } as _, i (i)}
                <rect class="no-dot" x={(g.yellow + i) * 9 + 1.2} y="2.7" width="6.6" height="6.6" rx="1" />
              {/each}
            </svg>
            <span class="sr">{g.yellow} yellow, {g.pink} pink</span>
          </td>
          <td><span class="chip" class:yes={g.says[0]}>{g.says[0] ? 'yes' : 'no'}</span></td>
          <td><span class="chip" class:yes={g.says[1]}>{g.says[1] ? 'yes' : 'no'}</span></td>
          <td class="num sum">
            <span class:pos={g.parts[0] > 0} class:neg={g.parts[0] < 0}>{signed(g.parts[0])}</span>
            <span class:pos={g.parts[1] > 0} class:neg={g.parts[1] < 0}>{signed(g.parts[1])}</span>
            <span class:pos={g.parts[2] > 0} class:neg={g.parts[2] < 0}>{signed(g.parts[2])}</span>
          </td>
          <td class="num total">{signed(g.total)}</td>
          <td class="verdict">
            <span class="chip" class:yes={g.total > 0}>{g.total > 0 ? 'yes' : 'no'}</span>
            {#if g.wrong === 0}
              <span class="right">right</span>
            {:else if g.yellow > 0 && g.pink > 0}
              <span class="trouble">mixed group</span>
            {:else}
              <span class="trouble">wrong</span>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="note">Above zero means yes. Point at a row to see its dots.</p>
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
    font-size: var(--step--1);
  }

  th {
    padding: 0.25rem 0.45rem 0.35rem 0;
    color: var(--dust);
    font-weight: 400;
    text-align: left;
    white-space: nowrap;
    border-bottom: 1.5px solid var(--rule);
  }

  td {
    padding: 0.5rem 0.45rem 0.5rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--rule) 60%, transparent);
    white-space: nowrap;
    vertical-align: middle;
  }

  tr.lit td,
  tbody tr:hover td {
    background: color-mix(in srgb, var(--sky) 9%, transparent);
  }

  .dots svg {
    display: block;
    height: 12px;
  }

  .yes-dot {
    fill: var(--sun);
  }

  .no-dot {
    fill: var(--rose);
  }

  .chip {
    display: inline-block;
    min-width: 2.3rem;
    padding: 0.05rem 0.45rem;
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
    min-width: 2.85rem;
    color: var(--dust);
  }

  .sum .pos {
    color: var(--sun);
  }

  .sum .neg {
    color: var(--rose);
  }

  .total {
    font-weight: 700;
  }

  th:last-child,
  td:last-child {
    padding-right: 0;
  }

  .verdict .right {
    margin-left: 0.4rem;
    color: var(--dust);
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
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
