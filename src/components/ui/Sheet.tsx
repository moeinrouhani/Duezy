import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';
import { useOverlay } from '../../hooks/useOverlay';
import { useMediaQuery } from '../../hooks/useMediaQuery';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name of what the sheet presents (usually the record's title). */
  label: string;
  children: ReactNode;
  className?: string;
}

/** Keep the panel mounted this long after `open` flips false so it can animate out. */
const EXIT_MS = 240;

/** Resting heights: collapsed = 45% of the viewport, expanded ≈ full height. */
const COLLAPSED_RATIO = 0.45;

/** Snap animations are spring-ish decels; release snaps are interruptible. */
const SNAP_TRANSITION = 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)';
const CLOSE_TRANSITION = 'transform 0.24s cubic-bezier(0.4, 0, 1, 1)';

/** Finger travel (px) before a content swipe commits to scroll vs sheet-drag. */
const LOCK_SLOPE = 8;
/** Travel (px) past the collapsed snap that still springs back on release. */
const DISMISS_SLACK = 72;
/** Downward flick (px/ms) that dismisses from around the collapsed snap. */
const DISMISS_VELOCITY = 0.55;
/** Release-projection window (ms) for velocity-based snapping. */
const PROJECT_MS = 130;

type Snap = 'collapsed' | 'expanded';

interface DragState {
  active: boolean;
  /** Set for grabber (pointer) drags; null for content (touch) drags. */
  pointerId: number | null;
  startY: number;
  startOffset: number;
  /** Trailing finger positions for release-velocity estimation. */
  samples: { y: number; t: number }[];
}

const IDLE_DRAG: DragState = {
  active: false,
  pointerId: null,
  startY: 0,
  startOffset: 0,
  samples: [],
};

/**
 * Phone presentation — Instagram-style bottom sheet: opens at a collapsed detent (~45dvh), can be
 * dragged to full height and back, and dismisses only from the collapsed
 * snap. The design (styling, radius, typography) is untouched — only the
 * interaction is new.
 *
 * Gesture rules:
 * - The grabber always drags the sheet (pointer events, mouse included).
 * - Inside the content, a swipe is locked to scroll or sheet-drag after ~8px:
 *   up from the top expands a collapsed sheet; down at scroll-top collapses /
 *   dismisses; anything else scrolls the content. When locked to the sheet,
 *   native scrolling is prevented via `preventDefault` (non-passive
 *   listeners) — React's synthetic touch handlers are passive and can't.
 * - While collapsed the scroller sets `touch-action: none`, so the browser
 *   never claims the gesture before the lock logic does; expanded it is
 *   `pan-y` and scrolling is native.
 */
function MobileSheet({ open, onClose, label, children, className }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const grabberRef = useRef<HTMLDivElement>(null);
  // Latest-callback ref: effects below must run only on open/close, not on
  // every parent render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // `mounted` outlives `open` by the exit animation.
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const id = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(id);
  }, [open]);
  const [snap, setSnap] = useState<Snap>('collapsed');

  const collapsedPx = useRef(0); // translateY of the collapsed detent
  const offset = useRef(0); // current translateY (source of truth while dragging)
  const snapRef = useRef<Snap>('collapsed');
  const drag = useRef<DragState>(IDLE_DRAG);
  const touch = useRef<{ y: number; scroll: number; lock: 'sheet' | 'scroll' | null }>({
    y: 0,
    scroll: 0,
    lock: null,
  });

  /** Panel's live translateY, read from the DOM (works mid-animation). */
  const currentOffset = (): number => {
    const panel = panelRef.current;
    if (!panel) return collapsedPx.current;
    const transform = getComputedStyle(panel).transform;
    if (!transform || transform === 'none') return 0;
    return new DOMMatrixReadOnly(transform).m42;
  };

  const applyOffset = (px: number, animate: boolean) => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.style.transition = animate ? SNAP_TRANSITION : 'none';
    panel.style.transform = `translateY(${px}px)`;
    offset.current = px;
  };

  const measure = () => {
    const panel = panelRef.current;
    if (!panel) return;
    const collapsedHeight = Math.min(window.innerHeight * COLLAPSED_RATIO, panel.offsetHeight);
    collapsedPx.current = Math.max(0, panel.offsetHeight - collapsedHeight);
  };

  const snapTo = (target: Snap) => {
    snapRef.current = target;
    setSnap(target);
    if (backdropRef.current) backdropRef.current.style.opacity = '';
    applyOffset(target === 'expanded' ? 0 : collapsedPx.current, true);
  };

  const moveDrag = (y: number) => {
    const d = drag.current;
    if (!d.active) return;
    const raw = d.startOffset + (y - d.startY); // finger down → sheet down
    const c = collapsedPx.current;
    // Above the expanded snap: rubber-band. Below collapsed: near-linear so
    // dismissal stays reachable, capped so the sheet can't be flung away.
    const shaped = raw < 0 ? raw * 0.2 : Math.min(raw, c + 140);
    applyOffset(shaped, false);
    d.samples.push({ y, t: performance.now() });
    if (d.samples.length > 6) d.samples.shift();
    // The page behind resurfaces as the sheet sinks toward dismissal.
    const backdrop = backdropRef.current;
    if (backdrop && shaped > c) {
      backdrop.style.opacity = String(Math.max(1 - ((shaped - c) / 160) * 0.7, 0.3));
    }
  };

  const endDrag = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    if (backdropRef.current) backdropRef.current.style.opacity = '';

    const c = collapsedPx.current;
    const samples = d.samples;
    let velocity = 0; // px/ms, downward positive
    const first = samples[0];
    const last = samples[samples.length - 1];
    if (first && last && last.t > first.t) velocity = (last.y - first.y) / (last.t - first.t);

    // From the expanded snap a downward fling collapses; dismissal needs the
    // release to already sit around the collapsed detent.
    const flungDown = velocity > DISMISS_VELOCITY && offset.current > c - 48;
    const draggedPast = offset.current > c + DISMISS_SLACK;
    if (flungDown || draggedPast) {
      onCloseRef.current(); // the close effect carries it the rest of the way
      return;
    }
    const projected = offset.current + velocity * PROJECT_MS;
    snapTo(projected > c / 2 ? 'collapsed' : 'expanded');
  };

  const beginDrag = (pointerId: number | null, y: number) => {
    drag.current = {
      active: true,
      pointerId,
      startY: y,
      startOffset: currentOffset(),
      samples: [{ y, t: performance.now() }],
    };
  };

  // Entrance/exit: slide from the bottom edge to the collapsed detent; the
  // close path plays from wherever the sheet currently sits.
  useEffect(() => {
    if (!open || !mounted) return;
    const panel = panelRef.current;
    if (!panel) return;
    measure();
    snapRef.current = 'collapsed';
    setSnap('collapsed');
    drag.current = IDLE_DRAG;
    panel.style.transition = 'none';
    panel.style.transform = 'translateY(100%)';
    offset.current = collapsedPx.current;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        panel.style.transition = SNAP_TRANSITION;
        panel.style.transform = `translateY(${collapsedPx.current}px)`;
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [open, mounted]);

  // Exit animation toward the bottom edge (also fired by drag dismissal).
  useEffect(() => {
    if (open) return;
    const panel = panelRef.current;
    if (!panel) return;
    drag.current = IDLE_DRAG;
    if (backdropRef.current) backdropRef.current.style.opacity = '';
    panel.style.transition = CLOSE_TRANSITION;
    panel.style.transform = 'translateY(100%)';
  }, [open]);

  // Escape (top-most overlay only), scroll lock, focus hand-off and trap.
  useOverlay(open, panelRef, onClose);

  // Orientation/viewport changes re-measure the detent and re-seat the sheet.
  useEffect(() => {
    if (!open || !mounted) return;
    const onResize = () => {
      measure();
      if (!drag.current.active) {
        applyOffset(snapRef.current === 'expanded' ? 0 : collapsedPx.current, false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, mounted]);

  // Content-area coordination (touch only — desktop uses wheel + grabber).
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!open || !mounted || !scroller) return;

    const onTouchStart = (e: TouchEvent) => {
      if (drag.current.active) return;
      touch.current = { y: e.touches[0].clientY, scroll: scroller.scrollTop, lock: null };
    };

    const onTouchMove = (e: TouchEvent) => {
      // A grabber (pointer) drag owns the sheet; ignore touch echoes.
      if (drag.current.active && drag.current.pointerId !== null) return;
      const t = touch.current;
      if (t.lock === 'sheet') {
        e.preventDefault();
        moveDrag(e.touches[0].clientY);
        return;
      }
      if (t.lock === 'scroll') return;
      const y = e.touches[0].clientY;
      const dyUp = t.y - y;
      if (dyUp < -LOCK_SLOPE) {
        // Downward: the sheet only takes over once the content sits at its
        // scroll-top — otherwise the swipe scrolls the content back up.
        if (scroller.scrollTop > 0) {
          t.lock = 'scroll';
        } else {
          t.lock = 'sheet';
          beginDrag(null, t.y); // from the touch start, not the lock point
          e.preventDefault();
        }
      } else if (dyUp > LOCK_SLOPE) {
        if (t.scroll > 0 || scroller.scrollTop > 0) {
          t.lock = 'scroll'; // scroll the content first
        } else if (snapRef.current === 'collapsed') {
          t.lock = 'sheet'; // expand before scrolling
          beginDrag(null, t.y);
          e.preventDefault();
        } else {
          t.lock = 'scroll'; // expanded at the top: this swipe scrolls
        }
      }
    };

    const onTouchEnd = () => {
      touch.current.lock = null;
      if (drag.current.active && drag.current.pointerId === null) endDrag();
    };

    scroller.addEventListener('touchstart', onTouchStart, { passive: true });
    scroller.addEventListener('touchmove', onTouchMove, { passive: false });
    scroller.addEventListener('touchend', onTouchEnd, { passive: true });
    scroller.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      scroller.removeEventListener('touchstart', onTouchStart);
      scroller.removeEventListener('touchmove', onTouchMove);
      scroller.removeEventListener('touchend', onTouchEnd);
      scroller.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [open, mounted]);

  const onGrabberPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (drag.current.active) return;
    e.preventDefault();
    grabberRef.current?.setPointerCapture(e.pointerId);
    beginDrag(e.pointerId, e.clientY);
  };

  const onGrabberPointerMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d.active || d.pointerId !== e.pointerId) return;
    moveDrag(e.clientY);
  };

  const onGrabberPointerEnd = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d.active || d.pointerId !== e.pointerId) return;
    endDrag();
  };

  // Keyboard affordance alongside Escape: arrows move between snap points.
  const onPanelKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      snapTo('expanded');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      snapTo('collapsed');
    }
  };

  if (!open && !mounted) return null;

  return createPortal(
    // touch-none: iOS otherwise routes touches on a fixed, non-scrollable
    // layer to the page beneath — the dimmed area must never scroll it.
    <div
      ref={backdropRef}
      data-state={open ? 'open' : 'closed'}
      className="overlay-backdrop fixed inset-0 z-50 flex touch-none items-end justify-center bg-black/45 backdrop-blur-[3px]"
      onClick={(event) => {
        // Dismiss on click, not mousedown: closing mid-gesture unmounts the
        // backdrop before the browser dispatches click, and the tap then
        // re-hit-tests onto whatever button sits behind it.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onPanelKeyDown}
        style={{
          height: 'calc(100dvh - env(safe-area-inset-top, 0px))',
          // First paint starts off-screen; the entrance effect animates up.
          transform: 'translateY(100%)',
        }}
        className={cn(
          // Fixed at the expanded height; the visible detent is purely the
          // translateY. Wide screens keep the centered column.
          'flex w-full flex-col rounded-t-3xl bg-surface text-fg-1 shadow-pop outline-none',
          className,
        )}
      >
        {/* Drag surface — pointer capture keeps the gesture ours on mouse,
            touch and pen; touch-none stops the browser claiming it. */}
        <div
          ref={grabberRef}
          onPointerDown={onGrabberPointerDown}
          onPointerMove={onGrabberPointerMove}
          onPointerUp={onGrabberPointerEnd}
          onPointerCancel={onGrabberPointerEnd}
          className="flex shrink-0 touch-none cursor-grab justify-center py-2.5 active:cursor-grabbing"
        >
          <span className="h-1 w-9 rounded-full bg-fg-2/25" aria-hidden />
        </div>
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
          style={{ touchAction: snap === 'collapsed' ? 'none' : 'pan-y' }}
        >
          {children}
          {/* Bottom sheets reach the physical screen edge — keep content above
              the gesture bar / home indicator on notched phones. */}
          <div className="shrink-0 pb-[max(1.25rem,env(safe-area-inset-bottom))]" aria-hidden />
        </div>
      </div>
    </div>,
    document.body,
  );
}

const DIALOG_EXIT_MS = 160;

/** Viewport width from which the detail view is a centered dialog (matches Modal's `sm`). */
const DIALOG_QUERY = '(min-width: 640px)';

/**
 * Wide-screen presentation: a centered, bounded dialog with a visible close
 * button, mouse-wheel scrolling and no drag/snap behavior. The bottom-sheet
 * detents only make sense under a thumb — on a monitor they left a narrow
 * column glued to the bottom edge with half its content below the fold.
 */
function DialogSheet({ open, onClose, label, children, className }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const id = setTimeout(() => setMounted(false), DIALOG_EXIT_MS);
    return () => clearTimeout(id);
  }, [open]);

  useOverlay(open, panelRef, onClose);

  if (!open && !mounted) return null;
  const state = open ? 'open' : 'closed';

  return createPortal(
    <div
      data-state={state}
      className="overlay-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6 backdrop-blur-[3px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'overlay-panel relative flex max-h-[min(88dvh,820px)] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-surface text-fg-1 shadow-pop outline-none',
          className,
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Detail presentation that adapts to the device: bottom sheet with snap
 * detents on phones, centered dialog on wide screens. Callers just render it.
 */
export function Sheet(props: SheetProps) {
  const wide = useMediaQuery(DIALOG_QUERY);
  return wide ? <DialogSheet {...props} /> : <MobileSheet {...props} />;
}
