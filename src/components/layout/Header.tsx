import { Menu } from "lucide-react";

import { Badge } from "../ui/Badge";

interface HeaderProps {
  onOpenNavigation: () => void;
}

export function Header({ onOpenNavigation }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenNavigation}
        aria-label="Open navigation"
        className="mr-3 flex size-9 items-center justify-center rounded-lg text-slate-600 outline-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600 lg:hidden"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-600">
            Resource capacity & availability
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className="size-1.5 rounded-full bg-blue-600"
            aria-hidden="true"
          />

          <Badge variant="neutral">Synthetic Data</Badge>
        </div>
      </div>
    </header>
  );
}
