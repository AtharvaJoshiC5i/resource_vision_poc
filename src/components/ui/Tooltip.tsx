import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const SHOW_MS = 400;
const HIDE_MS = 80;
const GAP = 6;
const VIEW_MARGIN = 10;

type Placement = "top" | "bottom";

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as React.RefObject<T | null>).current = node;
    }
  };
}

function hasTooltipContent(content: ReactNode): content is Exclude<ReactNode, null | undefined | false> {
  if (content === null || content === undefined || content === false) return false;
  if (typeof content === "string") return content.trim().length > 0;
  return true;
}

/**
 * Lightweight custom tooltip for truncated labels, matrix tiles, and chrome hints.
 * Replaces native `title` so copy is readable and timing is consistent.
 */
export function Tooltip({
  content,
  children,
  side = "auto",
  disabled = false,
}: {
  content: ReactNode;
  children: ReactElement;
  side?: Placement | "auto";
  disabled?: boolean;
}) {
  if (disabled || !hasTooltipContent(content)) {
    return children;
  }

  if (!isValidElement(children)) {
    return children;
  }

  return <TooltipActive content={content} side={side} children={children} />;
}

function TooltipActive({
  content,
  children,
  side,
}: {
  content: ReactNode;
  children: ReactElement;
  side: Placement | "auto";
}) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number; placement: Placement } | null>(null);
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const placement: Placement = side === "auto" ? (rect.top < 56 ? "bottom" : "top") : side;
    const x = rect.left + rect.width / 2;
    const y = placement === "top" ? rect.top - GAP : rect.bottom + GAP;
    setCoords((prev) => {
      if (prev && prev.x === x && prev.y === y && prev.placement === placement) {
        return prev;
      }
      return { x, y, placement };
    });
  }, [side]);

  const show = () => {
    window.clearTimeout(hideTimer.current);
    window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => {
      updatePosition();
      setOpen(true);
    }, SHOW_MS);
  };

  const hide = () => {
    window.clearTimeout(showTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setOpen(false);
      setCoords(null);
    }, HIDE_MS);
  };

  const showNow = () => {
    window.clearTimeout(hideTimer.current);
    window.clearTimeout(showTimer.current);
    updatePosition();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const dismiss = () => hide();
    const onResize = () => updatePosition();
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updatePosition]);

  useEffect(() => () => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
  }, []);

  type TriggerProps = HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> };
  const child = children as ReactElement<TriggerProps>;
  const childRef = child.props.ref;
  const { onMouseEnter, onMouseLeave, onFocus, onBlur } = child.props;

  const setTriggerRef = useCallback(
    (node: HTMLElement | null) => {
      triggerRef.current = node;
      mergeRefs(childRef)(node);
    },
    [childRef],
  );

  // The config holds a callback ref and event handlers. React calls them at commit time or on
  // events, never during render, so nothing here reads a ref while rendering. The compiler rule
  // can't see through cloneElement's ref merge.
  // eslint-disable-next-line react-hooks/refs
  const trigger = cloneElement(child, {
    ref: setTriggerRef,
    "aria-describedby": open ? tooltipId : undefined,
    onMouseEnter: (event) => {
      onMouseEnter?.(event);
      show();
    },
    onMouseLeave: (event) => {
      onMouseLeave?.(event);
      hide();
    },
    onFocus: (event) => {
      onFocus?.(event);
      if (event.target instanceof HTMLElement && event.target.matches(":focus-visible")) {
        showNow();
      }
    },
    onBlur: (event) => {
      onBlur?.(event);
      hide();
    },
  });

  const clampedX =
    coords == null
      ? 0
      : Math.min(Math.max(VIEW_MARGIN, coords.x), window.innerWidth - VIEW_MARGIN);

  return (
    <>
      {trigger}
      {open && coords
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              className={`rv-tooltip rv-tooltip--${coords.placement}`}
              style={{ left: clampedX, top: coords.y }}
            >
              {content}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}