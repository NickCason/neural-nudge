<script lang="ts">
  import { splitSubs } from './format';

  /** Text that may contain subscript digits. `svg` draws them as tspans instead of sub elements. */
  let { text, svg = false }: { text: string; svg?: boolean } = $props();
  const runs = $derived(splitSubs(text));
</script>

{#each runs as run, i (i)}{#if !run.sub}{#if svg && i > 0}<tspan dy="-0.28em">{run.text}</tspan>{:else}{run.text}{/if}{:else if svg}<tspan
      dy="0.28em"
      font-size="0.68em">{run.text}</tspan
    >{:else}<sub>{run.text}</sub>{/if}{/each}

<style>
  sub {
    font-size: 0.72em;
    line-height: 0;
  }
</style>
