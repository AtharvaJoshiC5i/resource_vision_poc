import { useEffect, useId, useRef, useState } from "react";

const GAP = 10;
const MARGIN = 12;

export interface HoverCardPosition {
  left: number;
  top: number;
  maxHeight: number;
  side: "right" | "left";
}

/**
 * Places a tall, narrow card beside its anchor (right, or left near the window edge), running down
 * from the anchor's top so it uses the window's height instead of covering neighbouring tiles.
 */
export function placeHoverCard(anchor: DOMRect, width: number, maxHeight: number): HoverCardPosition {
  const fitsRight = anchor.right + GAP + width + MARGIN <= window.innerWidth;
  const left = fitsRight ? anchor.right + GAP : Math.max(MARGIN, anchor.left - GAP - width);
  const height = Math.min(maxHeight, window.innerHeight - 2 * MARGIN);
  const top = Math.min(Math.max(MARGIN, anchor.top - 48), window.innerHeight - MARGIN - height);
  return { left, top: Math.max(MARGIN, top), maxHeight: height, side: fitsRight ? "right" : "left" };
}

/**
 * Hover / focus / tap card state for a trigger button. Opens on enter or focus, closes shortly after
 * leaving (so the pointer can cross into the card), on Escape, on resize, and on page scroll.
 * Scrolling inside the card itself keeps it open.
 */
export function useHoverCard<T extends HTMLElement>(width: number, maxHeight: number) {
  const ref = useRef<T>(null);
  const timer = useRef<number | undefined>(undefined);
  const [position, setPosition] = useState<HoverCardPosition | null>(null);
  const cardId = useId();

  const show = () => {
    window.clearTimeout(timer.current);
    if (ref.current) setPosition(placeHoverCard(ref.current.getBoundingClientRect(), width, maxHeight));
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPosition(null), 120);
  };
  const toggle = () => (position ? setPosition(null) : show());

  useEffect(() => {
    if (!position) return;
    const onScroll = (event: Event) => {
      const card = document.getElementById(cardId);
      if (card && event.target instanceof Node && card.contains(event.target)) return;
      setPosition(null);
    };
    const onResize = () => setPosition(null);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPosition(null);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
    };
  }, [position, cardId]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { ref, position, show, hide, toggle, cardId };
}
