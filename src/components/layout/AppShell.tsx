import { useState } from "react";

import { Outlet } from "react-router-dom";

import { Header } from "./Header";
import { MobileNavigation } from "./MobileNavigation";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <Sidebar />
      </aside>

      <MobileNavigation
        open={mobileNavigationOpen}
        onClose={() => setMobileNavigationOpen(false)}
      />

      <div className="min-w-0 lg:pl-64">
        <Header onOpenNavigation={() => setMobileNavigationOpen(true)} />

        <main className="min-w-0">
          <div className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
