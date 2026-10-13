import { TriangleAlert } from "lucide-react";

import { useResourceData } from "../../context/ResourceDataContext";

export function DataQualityBanner() {
  const { dataWarnings, error, mode } = useResourceData();

  const messages = [
    ...(error !== null ? [error] : []),
    ...dataWarnings,
  ];

  if (mode !== "organization" || messages.length === 0) {
    return null;
  }

  return (
    <div
      className="border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6 lg:px-8"
      role="status"
    >
      <div className="flex gap-3">
        <TriangleAlert
          className="mt-0.5 size-5 shrink-0 text-amber-700"
          aria-hidden="true"
        />

        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-amber-950">
            Organization data used estimates or fallbacks
          </p>

          <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900">
            {messages.slice(0, 4).map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>

          {messages.length > 4 && (
            <p className="text-xs text-amber-800">
              +{messages.length - 4} more notices
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
