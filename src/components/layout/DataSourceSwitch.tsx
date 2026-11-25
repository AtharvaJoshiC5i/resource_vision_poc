import { useEffect, useId, useRef, useState } from "react";

import { ApiError, bumpDataEpoch, getJson, postJson } from "../../api/client";
import type { DataSourceOptions, DataSourceStatus } from "../../api/types";

const POLL_MS = 1500;
const POLL_LIMIT_MS = 15 * 60 * 1000;

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

/** Polls until the server finishes (or fails) the background load. Kept outside the component. */
async function waitForSwitch(isActive: () => boolean): Promise<"ready" | "cancelled"> {
  const deadline = Date.now() + POLL_LIMIT_MS;
  while (isActive() && Date.now() < deadline) {
    await wait(POLL_MS);
    const status = await getJson<DataSourceStatus>("/data-source/status");
    if (status.status === "failed") throw new ApiError(status.error ?? "The data source could not be changed.", 0);
    if (status.status === "idle") return "ready";
  }
  if (!isActive()) return "cancelled";
  throw new ApiError("Loading is taking too long. Try again in a moment.", 0);
}

/**
 * Chooses which read-only source feeds the dashboard. A full API load can take a minute, so the server
 * loads it in the background while the current source keeps serving; this control polls until the new
 * source is ready, then reloads the page so every figure comes from it. A failed load changes nothing.
 */
export function DataSourceSwitch({ sources }: { sources: DataSourceOptions }) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const labelId = useId();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const serverLoading = sources.switch?.status === "loading" ? sources.switch.target : null;
  const busy = pending ?? serverLoading;

  const choose = async (id: string) => {
    if (id === sources.current || busy) return;
    setPending(id);
    setError(null);
    try {
      await postJson("/data-source", { source: id });
      const outcome = await waitForSwitch(() => mounted.current);
      if (outcome === "ready") {
        bumpDataEpoch();
        window.location.reload();
      }
    } catch (reason) {
      if (!mounted.current) return;
      setError(reason instanceof ApiError ? reason.message : "The data source could not be changed.");
      setPending(null);
    }
  };

  if (sources.options.length < 2) {
    const only = sources.options[0];
    return only ? (
      <p className="mt-2 text-xs text-muted">
        Data source: <span className="font-medium text-ink-soft">{only.label}</span>
      </p>
    ) : null;
  }

  const label = (id: string, text: string) => (busy === id ? "Loading..." : text);

  return (
    <div className="mt-2 space-y-1.5">
      <p id={labelId} className="text-xs text-muted">
        Data source
      </p>
      <div role="group" aria-labelledby={labelId} className="rv-segmented w-full">
        {sources.options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={sources.current === option.id}
            disabled={!option.available || busy !== null}
            title={option.available ? undefined : `${option.label} is not configured on the server`}
            onClick={() => void choose(option.id)}
            className="rv-segmented__option flex-1 whitespace-nowrap px-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {label(option.id, option.label)}
          </button>
        ))}
      </div>
      {busy ? (
        <p role="status" className="text-xs leading-snug text-muted">
          Loading the new source. This can take a minute, and the current data stays available meanwhile.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs leading-snug text-error-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
