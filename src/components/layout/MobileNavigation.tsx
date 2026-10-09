import { useEffect } from "react";

import { X } from "lucide-react";

import { Sidebar } from "./Sidebar";

interface MobileNavigationProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNavigation({ open, onClose }: MobileNavigationProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/30"
        onClick={onClose}
        aria-label="Close navigation"
      />

      <div className="relative h-full w-64 border-r border-slate-200 bg-white shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-lg text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        <Sidebar onNavigate={onClose} />
      </div>
    </div>
  );
}
