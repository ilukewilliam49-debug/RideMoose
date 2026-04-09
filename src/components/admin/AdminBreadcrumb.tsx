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
import React from "react";

const SEGMENT_LABELS: Record<string, string> = {
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
  /** Override the label for the last segment */
  pageTitle?: string;
  /** Override labels for intermediate segments: { "users": "User Management" } */
  segmentLabels?: Record<string, string>;
}

export default function AdminBreadcrumb({ pageTitle, segmentLabels }: AdminBreadcrumbProps) {
  const { pathname } = useLocation();

  // Split path into segments after "/admin"
  const segments = pathname
    .replace(/^\/admin\/?/, "")
    .split("/")
    .filter(Boolean);

  const resolveLabel = (segment: string, index: number, isLast: boolean) => {
    if (isLast && pageTitle) return pageTitle;
    return segmentLabels?.[segment] ?? SEGMENT_LABELS[segment] ?? decodeURIComponent(segment);
  };

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

        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const href = "/admin/" + segments.slice(0, index + 1).join("/");
          const label = resolveLabel(segment, index, isLast);

          return (
            <React.Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={href}>{label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
