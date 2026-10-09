import { CircleAlert } from "lucide-react";

import { Link } from "react-router-dom";

import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader } from "../ui/PageHeader";

export function NotFoundPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Page not found"
        description="The requested Resource Vision page does not exist."
      />

      <Card>
        <EmptyState
          icon={CircleAlert}
          title="We couldn't find that page"
          description="Check the address or return to the Resource Vision overview."
        />

        <div className="flex justify-center border-t border-slate-100 pt-5">
          <Link
            to="/"
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white outline-none hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            Return to Overview
          </Link>
        </div>
      </Card>
    </div>
  );
}
