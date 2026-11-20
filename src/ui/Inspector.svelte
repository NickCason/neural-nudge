<script lang="ts">
  import { DIAL_LIMIT, game } from '../game.svelte';
  import { num } from './format';
  import { paramExplain, paramTitle } from './names';
  import Subs from './Subs.svelte';

  const info = $derived(game.selected === null ? null : (game.layout[game.selected] ?? null));
  const value = $derived(info ? game.params[info.index] : 0);
  const slope = $derived(info ? game.evaluation.grad[info.index] : 0);
  const name = $derived(game.level.errorName);

  const slopeText = $derived.by(() => {
    if (Math.abs(slope) < 0.004) return `Flat here. Turning this dial barely changes the ${name}.`;
    return slope > 0
      ? `Turning this up raises the ${name}, so downhill is down.`
      : `Turning this up lowers the ${name}, so downhill is up.`;
  });
</script>

<div class="inspector" aria-live="polite">
  {#if info}
    <h2><Subs text={paramTitle(game.spec, info)} /></h2>
    <p class="explain"><Subs text={paramExplain(game.spec, info)} /></p>
    <dl>
      <div>
        <dt>Value</dt>
        <dd>
          {#if game.tools.drag}
            <input
              class="num"
              type="number"
              step="0.05"
              min={-DIAL_LIMIT}
              max={DIAL_LIMIT}
              value={Math.round(value * 100) / 100}
              aria-label="Value"
              onchange={(e) => game.setParam(info.index, Number(e.currentTarget.value))}
            />
          {:else}
            <span class="num">{num(value)}</span>
          {/if}
        </dd>
      </div>
      {#if game.tools.hints}
        <div>
          <dt>Slope</dt>
          <dd><span class="num">{num(slope, 3)}</span></dd>
        </div>
      {/if}
    </dl>
    {#if game.tools.hints}
      <p class="explain">{slopeText}</p>
    {/if}
  {:else}
    <p class="empty">
      {#if game.tools.nudge}
        Click a dial to nudge it downhill.
      {:else if game.tools.drag}
        Drag a dial up or down to turn it. Click one to see what it does.
      {:else}
        Click a dial to see what it does.
      {/if}
    </p>
  {/if}
</div>

<style>
  .inspector {
    min-height: 6.5rem;
    max-width: 38ch;
    padding-top: 0.9rem;
    border-top: 1.5px solid var(--rule);
    font-size: var(--step--1);
  }

  h2 {
    font-size: var(--step-0);
    font-weight: 600;
  }

  .explain,
  .empty {
    color: var(--dust);
    max-width: 52ch;
  }

  dl {
    display: flex;
    gap: 1.75rem;
    margin: 0.4rem 0;
  }

  dl div {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  dt {
    color: var(--dust);
  }

  dd {
    margin: 0;
    font-size: var(--step-0);
  }

  input {
    width: 5.5rem;
    padding: 0.15rem 0.4rem;
    border: 1.5px solid var(--rule);
    border-radius: 6px;
    background: var(--board-deep);
    color: var(--chalk);
    font-size: var(--step-0);
    font-family: inherit;
  }
</style>
