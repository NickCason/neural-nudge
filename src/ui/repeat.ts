/**
 * Press-and-hold for nudge buttons: fires once on press, then keeps firing while held,
 * speeding up after a moment. `fire` gets 0 for the first press and a rising count after.
 */
export function repeat(node: Element, fire: (tick: number) => void) {
  let current = fire;
  let timer = 0;
  let tick = 0;

  const stop = () => {
    clearTimeout(timer);
    timer = 0;
  };
  const loop = () => {
    current(++tick);
    timer = window.setTimeout(loop, tick > 22 ? 28 : 55);
  };
  const press = (e: Event) => {
    // The button sits on top of a dial; the dial shouldn't also treat this as a drag or a click.
    e.preventDefault();
    e.stopPropagation();
    stop();
    tick = 0;
    current(0);
    timer = window.setTimeout(loop, 380);
  };
  const swallow = (e: Event) => e.stopPropagation();

  node.addEventListener('pointerdown', press);
  node.addEventListener('pointerup', stop);
  node.addEventListener('pointerleave', stop);
  node.addEventListener('pointercancel', stop);
  node.addEventListener('click', swallow);

  return {
    update(next: (tick: number) => void) {
      current = next;
    },
    destroy() {
      stop();
      node.removeEventListener('pointerdown', press);
      node.removeEventListener('pointerup', stop);
      node.removeEventListener('pointerleave', stop);
      node.removeEventListener('pointercancel', stop);
      node.removeEventListener('click', swallow);
    },
  };
}
