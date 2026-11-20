<script lang="ts" generics="T extends string">
  // A two- or three-way switch between views of the same thing.
  let { value = $bindable(), options, label }: { value: T; options: { id: T; text: string }[]; label: string } = $props();
</script>

<div class="switch" role="group" aria-label={label}>
  {#each options as option (option.id)}
    <button class:on={value === option.id} aria-pressed={value === option.id} onclick={() => (value = option.id)}>
      {option.text}
    </button>
  {/each}
</div>

<style>
  .switch {
    display: inline-flex;
    padding: 2px;
    border: 1.5px solid var(--rule);
    border-radius: 999px;
    justify-self: start;
  }

  button {
    min-height: 1.9rem;
    padding: 0.1rem 0.85rem;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--dust);
    font-size: var(--step--1);
    cursor: pointer;
  }

  button:hover {
    color: var(--chalk);
  }

  button.on {
    background: var(--chalk);
    color: var(--board-deep);
    font-weight: 600;
  }
</style>
