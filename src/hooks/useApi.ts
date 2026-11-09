import { useCallback, useEffect, useState } from "react";

import { ApiError, getJson, type QueryParams } from "../api/client";

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

interface Settled<T> {
  key: string | null;
  data: T | null;
  error: string | null;
}

/** Responses are reused across pages for this long before a quiet background refresh. */
const FRESH_MS = 30_000;
const cache = new Map<string, { data: unknown; at: number }>();

/**
 * Fetches `path` with `params`; aborts the previous request when inputs change.
 * Responses are cached per URL, so returning to a page shows its data instantly
 * (and refreshes quietly when older than FRESH_MS). Previous data stays visible
 * while a new filter loads so the layout does not jump.
 */
export function useApi<T>(path: string | null, params: QueryParams = {}): ApiState<T> {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({ key: null, data: null, error: null });
  const paramsKey = JSON.stringify(params);
  const cacheKey = path === null ? null : `${path}|${paramsKey}`;
  const requestKey = cacheKey === null ? null : `${cacheKey}|${nonce}`;

  useEffect(() => {
    if (path === null || requestKey === null || cacheKey === null) return;
    const hit = cache.get(cacheKey);
    if (hit && nonce === 0 && Date.now() - hit.at < FRESH_MS) return;
    const controller = new AbortController();
    getJson<T>(path, JSON.parse(paramsKey) as QueryParams, controller.signal)
      .then((result) => {
        cache.set(cacheKey, { data: result, at: Date.now() });
        setSettled({ key: requestKey, data: result, error: null });
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        const message = reason instanceof ApiError ? reason.message : "Something went wrong while loading data.";
        setSettled((previous) => ({ key: requestKey, data: previous.data, error: message }));
      });
    return () => controller.abort();
  }, [path, paramsKey, cacheKey, requestKey, nonce]);

  const reload = useCallback(() => {
    if (cacheKey !== null) cache.delete(cacheKey);
    setNonce((value) => value + 1);
  }, [cacheKey]);

  const cached = cacheKey === null ? undefined : (cache.get(cacheKey)?.data as T | undefined);
  const current = requestKey !== null && settled.key === requestKey;
  return {
    data: requestKey === null ? null : (cached ?? settled.data),
    error: current ? settled.error : null,
    loading: requestKey !== null && cached === undefined && !current,
    reload,
  };
}
