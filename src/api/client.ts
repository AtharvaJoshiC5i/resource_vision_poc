export type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];
export type QueryParams = Record<string, QueryValue>;

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_BASE = (import.meta.env.VITE_RESOURCE_VISION_API_URL ?? "/api/rv").replace(/\/$/, "");

/**
 * Responses are cached by the browser for 30s. Switching the data source changes this stamp, which is
 * sent with every request, so data from the previous source is never reused.
 */
const EPOCH_KEY = "rv.data.epoch";

function readEpoch(): string {
  try {
    return window.localStorage.getItem(EPOCH_KEY) ?? "";
  } catch {
    return "";
  }
}

export function bumpDataEpoch(): void {
  try {
    window.localStorage.setItem(EPOCH_KEY, String(Date.now()));
  } catch {
    /* without storage the page reload alone still refetches */
  }
}

export function buildQuery(params: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) search.append(key, String(item));
    } else {
      search.append(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export async function getJson<T>(path: string, params: QueryParams = {}, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}${buildQuery({ ...params, _v: readEpoch() })}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("The server could not be reached. Check that the API is running.", 0);
  }

  if (!response.ok) {
    let detail = `The request failed (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}

/** Reads the server's suggested file name from a Content-Disposition header. */
function attachmentName(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      /* fall through to the plain name */
    }
  }
  const plain = /filename="([^"]+)"/i.exec(header);
  return plain ? plain[1] : fallback;
}

/** Fetches a generated file and hands it to the browser as a download. Errors surface as ApiError. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}${buildQuery({ _v: readEpoch() })}`);
  } catch {
    throw new ApiError("The server could not be reached. Check that the API is running.", 0);
  }
  if (!response.ok) {
    let detail = `The export failed (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(detail, response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachmentName(response.headers.get("Content-Disposition"), fallbackName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The only write the app makes: choosing which read-only source feeds the dashboard. */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("The server could not be reached. Check that the API is running.", 0);
  }
  if (!response.ok) {
    let detail = `The request failed (${response.status}).`;
    try {
      const parsed = (await response.json()) as { detail?: unknown };
      if (typeof parsed.detail === "string") detail = parsed.detail;
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(detail, response.status);
  }
  return (await response.json()) as T;
}
