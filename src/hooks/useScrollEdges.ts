import { useEffect, useRef } from "react";

/**
 * Ref for a table scroll shell. Sets `data-scrolled-x` / `data-scrolled-y` when the user
 * scrolls away from the top-left so CSS can lift the sticky header and pinned column.
 */
export function useScrollEdges<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => {
      node.dataset.scrolledX = node.scrollLeft > 0 ? "true" : "false";
      node.dataset.scrolledY = node.scrollTop > 0 ? "true" : "false";
    };

    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);

    return () => {
      node.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return ref;
}
