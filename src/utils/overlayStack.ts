/**
 * Registry of the overlays (modals, sheets) currently on screen.
 *
 * Every overlay used to attach its own Escape listener and save/restore
 * `body.style.overflow` independently, so a single Escape press closed a
 * confirm dialog AND the sheet beneath it, and closing in any order other
 * than LIFO left the page scroll-locked. Routing everything through one
 * stack fixes both: only the top-most overlay reacts, and the scroll lock is
 * reference-counted.
 */
const stack: symbol[] = [];
let savedOverflow = '';

export interface OverlayHandle {
  isTop: () => boolean;
  release: () => void;
}

export function pushOverlay(): OverlayHandle {
  const id = Symbol('overlay');
  if (stack.length === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  stack.push(id);
  return {
    isTop: () => stack[stack.length - 1] === id,
    release: () => {
      const index = stack.indexOf(id);
      if (index === -1) return;
      stack.splice(index, 1);
      if (stack.length === 0) document.body.style.overflow = savedOverflow;
    },
  };
}

/** True while any modal/sheet is open (used to mute global shortcuts). */
export function hasOpenOverlay(): boolean {
  return stack.length > 0;
}
