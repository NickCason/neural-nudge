<script lang="ts">
  import { game } from '../game.svelte';
  import type { ToolName } from '../levels/types';

  const fresh = (tool: ToolName) => game.level.fresh?.includes(tool) ?? false;

  // The slider works in log space, so small step sizes get as much room as large ones.
  const range = $derived(game.level.rate ?? { value: 0.1, min: 0.01, max: 1 });
  const toSlider = (rate: number) => Math.log(rate / range.min) / Math.log(range.max / range.min);
  const fromSlider = (t: number) => range.min * Math.pow(range.max / range.min, t);

  function tidy(rate: number): number {
    const digits = rate < 0.1 ? 3 : 2;
    return Number(rate.toFixed(digits));
  }
</script>

{#snippet tag(tool: ToolName)}
  {#if fresh(tool)}<span class="tag hand" aria-hidden="true">new</span>{/if}
{/snippet}

<div class="tray">
  {#if game.tools.grow && game.level.grow}
    <div class="group">
      {@render tag('grow')}
      <span class="label">Hidden neurons</span>
      <button
        class="tool square"
        aria-label="Remove a hidden neuron"
        disabled={game.hiddenSize === 0}
        onclick={() => game.setHidden(game.hiddenSize - 1)}>−</button
      >
      <span class="num count">{game.hiddenSize}</span>
      <button
        class="tool square"
        aria-label="Add a hidden neuron"
        disabled={game.hiddenSize >= game.level.grow.max}
        onclick={() => game.setHidden(game.hiddenSize + 1)}>+</button
      >
    </div>
  {/if}

  {#if game.tools.step}
    <button class="tool" disabled={!game.canStep || game.running} onclick={() => game.step()}>
      {@render tag('step')}Step
    </button>
  {/if}

  {#if game.tools.run}
    <button
      class="tool primary"
      disabled={!game.canStep && !game.running}
      onclick={() => game.toggleRun()}
    >
      {@render tag('run')}{game.running ? 'Pause' : 'Run'}
    </button>
  {/if}

  {#if game.tools.rate}
    <label class="group rate">
      {@render tag('rate')}
      <span class="label">Step size</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.005"
        value={toSlider(game.rate)}
        oninput={(e) => (game.rate = tidy(fromSlider(Number(e.currentTarget.value))))}
      />
      <span class="num">{game.rate < 0.1 ? game.rate.toFixed(3) : game.rate.toFixed(2)}</span>
    </label>
  {/if}

  {#if game.tools.shuffle}
    <button class="tool" onclick={() => game.shuffle()}>
      {@render tag('shuffle')}Shuffle
    </button>
  {/if}

  <button class="tool quiet" onclick={() => game.reset()}>Start over</button>
</div>

<style>
  .tray {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1.3rem 0.75rem;
  }

  .tool {
    position: relative;
    min-height: 2.5rem;
    padding: 0.35rem 1rem;
    border: 1.5px solid var(--dust);
    border-radius: 999px;
    background: transparent;
    font-weight: 600;
    cursor: pointer;
  }

  .tool:hover:not(:disabled) {
    background: var(--board-lift);
    border-color: var(--chalk);
  }

  .tool:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .tool.primary {
    background: var(--chalk);
    border-color: var(--chalk);
    color: var(--board-deep);
    min-width: 5.2rem;
  }

  .tool.primary:hover:not(:disabled) {
    background: #fff;
  }

  .tool.square {
    min-width: 2.5rem;
    padding: 0;
    font-size: var(--step-1);
    line-height: 1;
  }

  .tool.quiet {
    margin-left: auto;
    border-color: transparent;
    color: var(--dust);
    font-weight: 400;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .tool.quiet:hover {
    color: var(--chalk);
    background: transparent;
    border-color: transparent;
  }

  .group {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .label {
    color: var(--dust);
    font-size: var(--step--1);
  }

  .count {
    min-width: 1.2rem;
    text-align: center;
  }

  .rate input {
    width: 8.5rem;
    accent-color: var(--sky);
  }

  .rate .num {
    min-width: 3.2rem;
  }

  /* Tools that are new this level get a chalk note above them. */
  .tag {
    position: absolute;
    top: -1.05rem;
    left: 50%;
    transform: translateX(-50%) rotate(-4deg);
    color: var(--sky);
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1;
    pointer-events: none;
  }
</style>
