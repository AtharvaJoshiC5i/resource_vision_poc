import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Filter state kept in the URL (shareable, survives reloads and the back button).
 * Multi-value filters use repeated parameters, e.g. ?months=202611&months=202612.
 */
export function useUrlFilters() {
  const [params, setParams] = useSearchParams();

  const getAll = useCallback((key: string) => params.getAll(key), [params]);
  const getOne = useCallback((key: string) => params.get(key) ?? "", [params]);

  const setValues = useCallback(
    (updates: Record<string, string[] | string | null>) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          for (const [key, value] of Object.entries(updates)) {
            next.delete(key);
            const list = Array.isArray(value) ? value : value ? [value] : [];
            for (const item of list) next.append(key, item);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const reset = useCallback((keep: string[] = []) => {
    setParams(
      (previous) => {
        const next = new URLSearchParams();
        for (const key of keep) for (const value of previous.getAll(key)) next.append(key, value);
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  return useMemo(() => ({ getAll, getOne, setValues, reset, params }), [getAll, getOne, setValues, reset, params]);
}
