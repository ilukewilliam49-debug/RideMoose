import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

const PAGE_LABELS: Record<string, string> = {
  verifications: "Verifications",
  reports: "Reports",
  users: "Users",
  pricing: "Pricing",
  zones: "Zones",
  corporate: "Corporate",
  support: "Support",
  bookings: "Bookings",
  simulator: "Simulator",
};

interface AdminBreadcrumbProps {
  /** Override the auto-detected page label */
  pageTitle?: string;
}

export default function AdminBreadcrumb({ pageTitle }: AdminBreadcrumbProps) {
  const { pathname } = useLocation();
  const segment = pathname.split("/").filter(Boolean).pop() || "";
  const label = pageTitle || PAGE_LABELS[segment] || segment;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/admin" className="flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
              Dashboard
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
