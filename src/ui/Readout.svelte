<script lang="ts">
  import { game } from '../game.svelte';
  import { lossText } from './format';

  // The meter runs on a log scale from 0.001 to 10, so each tenfold drop moves it the same distance.
  const LOW = -3;
  const HIGH = 1;
  const at = (v: number) => Math.max(0, Math.min(1, (Math.log10(Math.max(v, 1e-9)) - LOW) / (HIGH - LOW)));

  const goal = $derived(game.level.goal);
  const counting = $derived(goal.kind !== 'loss');
  const name = $derived(game.level.errorName === 'loss' ? 'Loss' : 'Error');
  const stepping = $derived(game.tools.step || game.tools.nudge);

  const spark = $derived.by(() => {
    const shown = game.history.slice(-150).map((v) => Math.log10(Math.max(v, 1e-9)));
    if (shown.length < 2) return '';
    const low = Math.min(...shown);
    const span = Math.max(Math.max(...shown) - low, 0.05);
    return shown
      .map((v, i) => `${((i / (shown.length - 1)) * 100).toFixed(1)},${(22 - ((v - low) / span) * 20).toFixed(1)}`)
      .join(' ');
  });
</script>

<div class="readout">
  {#if counting}
    <div class="big">
      <span class="num figure" class:met={game.correct === game.level.data.length}>{game.correct}</span>
      <span class="of">of {game.level.data.length} dots right</span>
    </div>
    <div class="side">
      <span class="label">{name}</span>
      <span class="num">{lossText(game.loss)}</span>
    </div>
  {:else}
    <div class="big">
      <span class="label">{name}</span>
      <span class="num figure" class:met={goal.kind === 'loss' && game.loss < goal.below}>{lossText(game.loss)}</span>
    </div>
    <div class="meter" aria-hidden="true">
      <div class="fill" style:width="{at(game.loss) * 100}%"></div>
      {#if goal.kind === 'loss'}
        <div class="target" style:left="{at(goal.below) * 100}%"></div>
      {/if}
    </div>
  {/if}

  {#if stepping}
    <div class="steps">
      <span class="label">{game.tools.nudge ? 'Nudges' : 'Steps'}</span>
      <span class="num" class:spent={game.outOfSteps}>
        {game.steps}{#if game.level.stepBudget}<span class="of"> of {game.level.stepBudget}</span>{/if}
      </span>
      {#if spark}
        <svg class="spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
          <polyline points={spark} />
        </svg>
      {/if}
    </div>
  {/if}
</div>

<style>
  .readout {
    display: grid;
    gap: 0.5rem;
  }

  .big {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
  }

  .figure {
    font-size: var(--step-3);
    line-height: 1;
    font-weight: 600;
    transition: color 0.2s;
  }

  .figure.met {
    color: var(--sun);
  }

  .label,
  .of {
    color: var(--dust);
    font-size: var(--step--1);
  }

  .side,
  .steps {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .meter {
    position: relative;
    height: 8px;
    border-radius: 4px;
    background: var(--board-deep);
  }

  .fill {
    height: 100%;
    border-radius: 4px;
    background: var(--sky);
  }

  .target {
    position: absolute;
    top: -5px;
    bottom: -5px;
    width: 2px;
    background: var(--sun);
  }

  .spent {
    color: var(--rose);
  }

  .spark {
    flex: 1;
    height: 24px;
    min-width: 60px;
    align-self: center;
  }

  .spark polyline {
    fill: none;
    stroke: var(--sky);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
</style>
